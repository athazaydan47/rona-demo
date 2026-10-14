// Impor katalog dari CSV (Fase 8B): pekerjaan pertama di setiap proyek klien. Satu baris CSV = satu varian; baris dengan
// slug produk yang sama digabung menjadi satu produk. Modul ini murni (parse dan validasi), diuji di katalog.test.ts.
// Penulisan ke database ada di scripts/impor-katalog.ts lewat saveProduct (admin produk) dan receiveStock (modul
// inventory, menulis stock_movements). Templat kolom: docs/templat-katalog.csv.
import { packagingValues, type Packaging } from "@/db/schema/enums";
import { validateProduct, type ProductInput } from "@/lib/admin/products";
import { slugify } from "@/lib/utils";

export const KOLOM_WAJIB = ["merek", "kategori", "produk", "kemasan", "shade", "hex", "sku", "harga_normal", "harga_jual", "berat_gram"] as const;
export const KOLOM_OPSIONAL = ["slug_produk", "deskripsi_singkat", "bahan_aktif", "jenis_kulit", "masalah_kulit", "finish", "spf", "netto", "bpom", "status"] as const;
// Kolom stok awal per lokasi: stok_<slug lokasi>, misal stok_gudang-online.
export const AWALAN_STOK = "stok_";

export type BarisGagal = { baris: number; pesan: string };
export type ProdukImpor = {
  slug: string;
  brandName: string;
  categorySlug: string;
  input: Omit<ProductInput, "brandId" | "categoryId">;
  stok: { sku: string; lokasi: string; jumlah: number }[];
  baris: number[];
};
export type HasilParse = { produk: ProdukImpor[]; gagal: BarisGagal[]; lokasiDipakai: string[]; jumlahBaris: number };

// Parser CSV kecil (RFC 4180): koma, kutip ganda, kutip di dalam kutip ditulis "". Tanpa dependensi.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const daftar = (v: string) =>
  v
    .split(/[;|]/)
    .map((x) => x.trim())
    .filter(Boolean);

const bulat = (v: string) => {
  const s = v.replace(/[.\s]/g, "").replace(/^Rp/i, "");
  return /^\d+$/.test(s) ? Number(s) : NaN;
};

export function parseKatalog(text: string): HasilParse {
  const rows = parseCsv(text);
  const gagal: BarisGagal[] = [];
  if (rows.length < 2) return { produk: [], gagal: [{ baris: 1, pesan: "Berkas kosong atau hanya berisi judul kolom." }], lokasiDipakai: [], jumlahBaris: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const kurang = KOLOM_WAJIB.filter((k) => !header.includes(k));
  if (kurang.length) return { produk: [], gagal: [{ baris: 1, pesan: `Kolom wajib belum ada: ${kurang.join(", ")}.` }], lokasiDipakai: [], jumlahBaris: rows.length - 1 };
  const kolomStok = header.filter((h) => h.startsWith(AWALAN_STOK)).map((h) => ({ kolom: h, lokasi: h.slice(AWALAN_STOK.length) }));
  const ambil = (r: string[], k: string) => (r[header.indexOf(k)] ?? "").trim();

  const grup = new Map<string, ProdukImpor>();
  const skuDiFile = new Map<string, number>();
  rows.slice(1).forEach((r, idx) => {
    const n = idx + 2; // nomor baris di berkas (baris 1 = judul)
    const masalah: string[] = [];
    const produk = ambil(r, "produk");
    const slug = (ambil(r, "slug_produk") || slugify(produk)).toLowerCase();
    const kemasan = ambil(r, "kemasan") as Packaging;
    if (!packagingValues.includes(kemasan)) masalah.push(`kemasan "${ambil(r, "kemasan")}" tidak dikenal (pilihan: ${packagingValues.join(", ")})`);
    const hexRaw = ambil(r, "hex");
    const hex = hexRaw ? `#${hexRaw.replace(/^#/, "").toUpperCase()}` : "";
    const normal = bulat(ambil(r, "harga_normal"));
    const jual = bulat(ambil(r, "harga_jual"));
    const berat = bulat(ambil(r, "berat_gram"));
    const sku = ambil(r, "sku").toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex)) masalah.push(`hex "${hexRaw}" harus kode warna 6 digit, misal #D9A98B`);
    if (!Number.isNaN(normal) && !Number.isNaN(jual) && jual > normal) masalah.push("harga_jual tidak boleh melebihi harga_normal");
    if (!ambil(r, "merek")) masalah.push("merek kosong");
    if (!ambil(r, "kategori")) masalah.push("kategori kosong");
    if (Number.isNaN(normal) || Number.isNaN(jual)) masalah.push("harga harus angka bulat rupiah, misal 129000");
    if (Number.isNaN(berat)) masalah.push("berat_gram harus angka bulat");
    if (sku && skuDiFile.has(sku)) masalah.push(`SKU ${sku} sudah dipakai di baris ${skuDiFile.get(sku)}`);
    const spfRaw = ambil(r, "spf");
    const spf = spfRaw ? Number(spfRaw) : null;
    const finishRaw = ambil(r, "finish").toLowerCase();
    if (finishRaw && !["matte", "satin", "glowy"].includes(finishRaw)) masalah.push(`finish "${finishRaw}" harus matte, satin, atau glowy`);
    const statusRaw = (ambil(r, "status") || "draf").toLowerCase();
    if (!["aktif", "draf", "arsip"].includes(statusRaw)) masalah.push(`status "${statusRaw}" harus aktif, draf, atau arsip`);
    const stok: ProdukImpor["stok"] = [];
    for (const s of kolomStok) {
      const v = ambil(r, s.kolom);
      if (!v) continue;
      const q = bulat(v);
      if (Number.isNaN(q) || q < 0) masalah.push(`stok ${s.lokasi} harus angka bulat 0 atau lebih`);
      else if (q > 0) stok.push({ sku, lokasi: s.lokasi, jumlah: q });
    }
    if (masalah.length) {
      gagal.push({ baris: n, pesan: masalah.join("; ") });
      return;
    }
    skuDiFile.set(sku, n);
    const varian = { shadeName: ambil(r, "shade") || "Standar", hex, sku, weightGram: berat, normalPrice: normal, salePrice: jual, isActive: true };
    const ada = grup.get(slug);
    if (!ada) {
      grup.set(slug, {
        slug,
        brandName: ambil(r, "merek"),
        categorySlug: ambil(r, "kategori").toLowerCase(),
        input: {
          name: produk,
          slug,
          packaging: kemasan,
          shortDescription: ambil(r, "deskripsi_singkat"),
          activeIngredients: daftar(ambil(r, "bahan_aktif")),
          skinTypes: daftar(ambil(r, "jenis_kulit")),
          skinConcerns: daftar(ambil(r, "masalah_kulit")),
          finish: (finishRaw || null) as ProductInput["finish"],
          spf: spf != null && Number.isFinite(spf) ? spf : null,
          netto: ambil(r, "netto"),
          bpom: ambil(r, "bpom"),
          status: statusRaw as ProductInput["status"],
          variants: [varian],
        },
        stok,
        baris: [n],
      });
      return;
    }
    // Kolom tingkat produk di baris berikutnya harus sama dengan baris pertama produk itu.
    const beda = [ada.brandName !== ambil(r, "merek") && "merek", ada.categorySlug !== ambil(r, "kategori").toLowerCase() && "kategori", ada.input.packaging !== kemasan && "kemasan", ada.input.name !== produk && "nama produk"].filter(Boolean);
    if (beda.length) {
      gagal.push({ baris: n, pesan: `${beda.join(", ")} berbeda dengan baris ${ada.baris[0]} untuk produk ${slug}` });
      return;
    }
    ada.input.variants.push(varian);
    ada.stok.push(...stok);
    ada.baris.push(n);
  });

  // Validasi produk dengan aturan yang sama seperti formulir admin (merek dan kategori dicek terhadap database nanti).
  const produk: ProdukImpor[] = [];
  for (const p of grup.values()) {
    const issues = validateProduct({ ...p.input, brandId: 1, categoryId: 1 });
    if (issues.length) gagal.push({ baris: p.baris[0], pesan: `${p.slug}: ${issues.map((i) => i.message).join("; ")}` });
    else produk.push(p);
  }
  const lokasiDipakai = [...new Set(produk.flatMap((p) => p.stok.map((s) => s.lokasi)))];
  return { produk, gagal: gagal.sort((a, b) => a.baris - b.baris), lokasiDipakai, jumlahBaris: rows.length - 1 };
}
