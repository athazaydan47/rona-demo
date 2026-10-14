// Tanya Rona (Fase 8C), bagian murni: pengenal niat (link di tengah kalimat, link yang belum didukung, lacak, ongkir,
// kuis), kota tujuan dari teks bebas, pencarian varian shade dari kalimat, dan penjaga kalimat "tidak bisa membuka link".
import { describe, expect, it } from "vitest";
import { LINK_REFUSAL, sentenceProblem } from "@/lib/ai/guard";
import { cariKotaTujuan } from "@/lib/regions";
import { resolveShadeText, type ShadeSourceProduct } from "@/lib/skin/tafsir-shade";
import { judulDupe } from "./kartu";
import { kenaliNiat, kotaDiTeks, nomorWaDiTeks } from "./niat";

describe("pengenal niat", () => {
  it("link TikTok atau YouTube di tengah kalimat menjadi niat link", () => {
    expect(kenaliNiat("kak ini dong https://vt.tiktok.com/ZSgewBdCV/ ada yang mirip?")).toMatchObject({ jenis: "link", raw: "https://vt.tiktok.com/ZSgewBdCV/", link: { kind: "tiktok" } });
    expect(kenaliNiat("liat www.youtube.com/shorts/zuoAuMkPOSY warnanya cakep")).toMatchObject({ jenis: "link", link: { kind: "youtube", videoId: "zuoAuMkPOSY" } });
  });
  it("link yang belum didukung (Instagram, Shopee) tetap dikenali sebagai link lain", () => {
    expect(kenaliNiat("https://www.instagram.com/reel/C0ntoh/ ini ada?")).toMatchObject({ jenis: "link", link: { kind: "lainnya", host: "www.instagram.com" } });
    expect(kenaliNiat("shopee.co.id/lipstik-123 yang ini")).toMatchObject({ jenis: "link", link: { kind: "lainnya" } });
  });
  it("lacak dengan dan tanpa nomor, nomor WA dibaca dari teks", () => {
    expect(kenaliNiat("lacak pesananku")).toEqual({ jenis: "lacak", nomor: null, wa: null });
    expect(kenaliNiat("cek rona-2610-000123 ya, wa 0812-3456-7890")).toEqual({ jenis: "lacak", nomor: "RONA-2610-000123", wa: "081234567890" });
    expect(nomorWaDiTeks("+62 812 3456 7890")).toBe("6281234567890");
    expect(nomorWaDiTeks("harganya 129000")).toBeNull();
  });
  it("ongkir, kuis, rutinitas, shade, cabang, promo, bantuan", () => {
    expect(kenaliNiat("ongkir ke Kab. Malang berapa kak?")).toEqual({ jenis: "ongkir", kota: "Kab Malang" });
    expect(kotaDiTeks("berapa ongkos kirim ke surabaya dong")).toBe("surabaya");
    expect(kenaliNiat("bantu aku pilih skincare")).toEqual({ jenis: "kuis" });
    expect(kenaliNiat("kenali kulitku")).toEqual({ jenis: "kuis" });
    expect(kenaliNiat("susunin rutinitas pagi malam")).toEqual({ jenis: "rutinitas" });
    expect(kenaliNiat("Aku pakai cushion Pualam 02, yang setara apa?")?.jenis).toBe("shade");
    expect(kenaliNiat("jam buka cabang Dinoyo")?.jenis).toBe("cabang");
    expect(kenaliNiat("ada voucher apa?")).toEqual({ jenis: "promo" });
    expect(kenaliNiat("bisa retur kalau barangnya rusak?")).toEqual({ jenis: "bantuan", topik: "retur" });
  });
  it("pertanyaan produk biasa diteruskan ke model", () => {
    for (const q of ["Sunscreen buat kulit berminyak di bawah 100 ribu", "kado di bawah 200 ribu", "Kulitku sensitif, pelembap yang aman apa?", "harganya jadi Rp 1.000 ya"]) expect(kenaliNiat(q), q).toBeNull();
  });
});

describe("kota tujuan dari teks bebas", () => {
  it("cocok, salah ketik, alias, dan provinsi satu zona", () => {
    expect(cariKotaTujuan("Bandung")).toMatchObject({ status: "cocok", kota: { nama: "Kota Bandung", zona: "jawa" } });
    expect(cariKotaTujuan("surabya")).toMatchObject({ status: "cocok", kota: { nama: "Kota Surabaya", zona: "jatim" } });
    expect(cariKotaTujuan("jogja")).toMatchObject({ status: "cocok", kota: { kode: "34.71" } });
    expect(cariKotaTujuan("Bali")).toMatchObject({ status: "cocok", kota: { nama: "Bali", zona: "luar_jawa" } });
  });
  it("kota dengan zona berbeda ditanya balik, kota tak dikenal dilaporkan", () => {
    const r = cariKotaTujuan("malang");
    expect(r.status).toBe("ambigu");
    if (r.status === "ambigu") expect(r.pilihan.map((k) => k.zona).sort()).toEqual(["dalam_kota", "jatim"]);
    expect(cariKotaTujuan("Atlantis")).toEqual({ status: "tidak_dikenal", teks: "Atlantis" });
    expect(cariKotaTujuan("jawa timur").status).toBe("tidak_dikenal");
  });
});

const SOURCES: ShadeSourceProduct[] = [
  { id: 1, name: "Pualam Velvet Matte Cushion SPF 50", brandName: "Pualam", categorySlug: "cushion", variants: [{ id: 11, shadeName: "01C Porselen", hex: "#F1D9C6" }, { id: 12, shadeName: "02N Gading", hex: "#E9CBAE" }] },
  { id: 2, name: "Pualam Dewy Glow Cushion SPF 40", brandName: "Pualam", categorySlug: "cushion", variants: [{ id: 21, shadeName: "02N Gading", hex: "#E9CBAE" }, { id: 22, shadeName: "09W Sawo Matang", hex: "#9C6B4C" }] },
  { id: 3, name: "Lumi Velvet Matte Lipstick", brandName: "Lumi", categorySlug: "lipstick", variants: [{ id: 31, shadeName: "05 Mawar Tua", hex: "#8E3B4A" }] },
];

describe("varian shade dari kalimat", () => {
  it("satu cocok, beberapa cocok ditanya balik, produk tanpa shade menawarkan shade, tidak dikenal", () => {
    expect(resolveShadeText("pualam velvet matte 02N", SOURCES)).toEqual({ status: "cocok", pilih: { varianId: 12, label: "Pualam Velvet Matte Cushion SPF 50, shade 02N Gading" } });
    const dua = resolveShadeText("Aku pakai cushion Pualam 02", SOURCES);
    expect(dua.status).toBe("pilih");
    if (dua.status === "pilih") expect(dua.pilihan.map((p) => p.varianId).sort()).toEqual([12, 21]);
    expect(resolveShadeText("cushion pualam dewy glow sawo matang", SOURCES)).toMatchObject({ status: "cocok", pilih: { varianId: 22 } });
    expect(resolveShadeText("lipstik lumi velvet matte", SOURCES)).toMatchObject({ status: "cocok", pilih: { varianId: 31 } });
    expect(resolveShadeText("aku pakai cushion merek lain", SOURCES)).toEqual({ status: "tidak" });
  });
});

describe("penjaga dan teks kartu", () => {
  it("kalimat model yang mengaku tidak bisa membuka link dibuang", () => {
    expect(LINK_REFUSAL.test("Maaf, aku tidak bisa membuka link TikTok.")).toBe(true);
    expect(sentenceProblem("Aku tidak bisa membuka video dari tautan itu.", { catalogNames: [], allowedNames: new Set(), allowedPrices: new Set() })).toBe("menolak link");
    expect(sentenceProblem("Ini pilihan yang mirip dari katalog.", { catalogNames: [], allowedNames: new Set(), allowedPrices: new Set() })).toBeNull();
  });
  it("judul hasil dupe sama untuk halaman dan chat", () => {
    expect(judulDupe({ tipe: "mirip", namaTerbaca: "Wardah Colorfit", jenisProduk: "lipstik" })).toMatch(/tidak menjual Wardah Colorfit, ini yang paling mirip$/);
    expect(judulDupe({ tipe: "tidak_dikenali", namaTerbaca: null, jenisProduk: null })).toBe("Produknya belum bisa kami kenali");
  });
});

describe("modul yang dipakai browser tidak menarik kode database", () => {
  // Fase 8C: regions.ts sempat mengimpor pencocok dari modul asisten (Drizzle), sehingga formulir alamat checkout gagal
  // terhidrasi di Safari. Modul berikut dipakai komponen klien, jadi hanya boleh impor tipe dari database.
  it("regions, shipping, kartu Tanya, data rutinitas, dan kemiripan teks", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/lib/regions.ts", "src/lib/shipping/index.ts", "src/lib/tanya/kartu.ts", "src/lib/skin/routine-view.ts", "src/lib/teks/mirip.ts"]) {
      const src = readFileSync(f, "utf8");
      const valueImports = [...src.matchAll(/^import\s+(?!type\b)[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
      expect(valueImports.filter((m) => /^drizzle-orm|^postgres|^@\/db(\/|$)|^@\/lib\/asisten|^@\/lib\/db-types|^node:/.test(m)), f).toEqual([]);
    }
  });
});
