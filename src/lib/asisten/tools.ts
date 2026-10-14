// Tool baca Asisten Admin. Semua tool hanya membaca dan membungkus fungsi yang sudah ada (src/lib/reports, stok,
// pesanan, pelanggan, ulasan, saran). Aturan:
// - Agregasi di kode: hasil sudah dijumlahkan dan dibulatkan, baris dibatasi (10 teratas plus "lainnya").
// - Periode diterjemahkan penerjemah periode (WIB), bukan model; hasil selalu menyebut periode dan tanda sementara.
// - Nama dicocokkan di kode (cocok.ts); hasil ambigu atau tidak ditemukan dikembalikan apa adanya.
// - Daftar tool dan eksekutor disaring can(); staf cabang terkunci ke lokasinya; kolom rupiah (akhiran Rp) dihapus
//   tanpa laporan.keuangan; kontak disamarkan tanpa pelanggan.kontak (peran.ts).
// - "Omzet" hanya dari ringkasan_penjualan. Tool lain yang menyentuh uang menyebut bahwa ia bukan tool omzet.
import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Schema } from "@/lib/ai/client";
import { dashboardData } from "@/lib/admin/dashboard";
import { segmentCounts, SEGMENT_LABELS } from "@/lib/admin/customers";
import { listAdminOrders } from "@/lib/admin/orders";
import { can, canAll, type PermissionKey, type StaffPrincipal } from "@/lib/admin/permissions";
import { lowStockThreshold } from "@/lib/admin/stock";
import type { AnyDb } from "@/lib/db-types";
import { flashDraftHref, flashSuggestions } from "@/lib/flash/saran";
import { formatDateTimeWib } from "@/lib/format";
import { transferDraftHref, transferSuggestions } from "@/lib/inventory/saran";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { advisorPerformance, byBrand, byCategory, byChannel, byHour, byLocation, flashPerformance, newVsReturning, percentChange, summarize, topProducts, voucherPerformance, type ReportData } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";
import { loadSettings } from "@/lib/settings/db";
import { brandCandidates, categoryCandidates, locationCandidates, matchName, productCandidates, variantCandidates, type Candidate } from "./cocok";
import { findGuide, loadGuides } from "./panduan";
import { applyRole, lockedLocations } from "./peran";
import { parsePembanding, parsePeriode, PERIODE_CONTOH, type Periode } from "./periode";

export type ToolCtx = { db: AnyDb; staff: StaffPrincipal; now: Date };
export type ToolResult = Record<string, unknown>;
export type ToolDef = { name: string; description: string; parameters: Schema; izin: PermissionKey[] | null; run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<ToolResult> };

// Daftar izin baca yang ditulis tetap. Uji penjaga memastikan registri sama persis dengan daftar ini dan tidak ada nama
// tool berkata kerja mutasi.
export const READ_ONLY_TOOLS = [
  "ringkasan_penjualan",
  "penjualan_per",
  "produk_terlaris",
  "stok_varian",
  "stok_menipis",
  "permintaan_kabari_aku",
  "pesanan_perlu_tindakan",
  "cari_pesanan",
  "ringkasan_pelanggan",
  "ringkasan_ulasan",
  "kinerja_voucher",
  "kinerja_flash_sale",
  "kinerja_advisor",
  "saran_transfer_stok",
  "saran_flash_sale",
  "panduan_admin",
] as const;
export type ToolName = (typeof READ_ONLY_TOOLS)[number];

export const DEFINISI_OMZET = "Omzet = total pesanan yang sudah dibayar dalam periode, tidak termasuk yang kemudian dibatalkan atau diretur, menurut tanggal bayar WIB. Sama dengan Dashboard, Laporan, dan Excel.";
const BUKAN_OMZET = "Bukan tool bawaan untuk omzet; untuk omzet pakai ringkasan_penjualan.";
export const TOP_N = 10;

const str = (description: string, values?: readonly string[]): Schema => ({ type: "STRING", description, ...(values ? { enum: [...values] } : {}) });
const PERIODE = str(`periode, salin kata dari pertanyaan apa adanya (diterjemahkan server), contoh: ${PERIODE_CONTOH}. Jangan mengubah nama hari raya atau istilah lain menjadi tanggal sendiri.`);
const CABANG = str("nama cabang atau lokasi (misal Dinoyo), kosongkan untuk semua yang boleh kamu lihat");
const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "OBJECT", properties, ...(required.length ? { required } : {}) });

// ---------- Bantu ----------

class ToolProblem extends Error {
  constructor(readonly result: ToolResult) {
    super("tool");
  }
}

function periodeOf(raw: unknown, now: Date, fallback?: string): Periode {
  const r = parsePeriode(typeof raw === "string" ? raw : undefined, now, fallback);
  if (!r.ok) throw new ToolProblem({ status: "periode_tidak_dikenal", pesan: r.message });
  return r.periode;
}

const periodeInfo = (p: Periode) => ({ periode: p.label, sementara: p.sementara, ...(p.sementara ? { catatanSementara: "Periode memuat hari ini yang belum selesai, angka bisa masih bertambah." } : {}) });

function pick<T>(query: unknown, list: Candidate<T>[], what: string): Candidate<T> | null {
  if (typeof query !== "string" || !query.trim()) return null;
  const m = matchName(query, list);
  if (m.status === "cocok") return m.item;
  if (m.status === "ambigu") throw new ToolProblem({ status: "ambigu", jenis: what, dicari: query, kandidat: m.kandidat.map((k) => k.name), pesan: `Ada beberapa ${what} yang cocok dengan "${query}". Tanyakan pembeli yang mana.` });
  throw new ToolProblem({ status: "tidak_ditemukan", jenis: what, dicari: query, pesan: `Tidak ada ${what} bernama "${query}".` });
}

// Lokasi untuk tool: cocokkan nama, lalu kunci sesuai cakupan staf.
async function locationScope(ctx: ToolCtx, raw: unknown) {
  const locs = await locationCandidates(ctx.db);
  const chosen = pick(raw, locs, "cabang");
  const l = lockedLocations(ctx.staff, chosen?.id ?? null);
  const label = l.ids == null ? "Semua cabang" : locs.filter((x) => l.ids!.includes(x.id)).map((x) => x.name).join(", ");
  return { ids: l.ids, label, catatanLokasi: l.ignored ? `Kamu hanya bisa melihat ${label}, jadi cabang lain tidak ditampilkan.` : undefined, locs };
}

function topWithRest<T extends Record<string, unknown>>(rows: T[], sumKeys: (keyof T)[], label: (rest: number) => Record<string, unknown>) {
  if (rows.length <= TOP_N) return rows as Record<string, unknown>[];
  const rest = rows.slice(TOP_N);
  const sum = Object.fromEntries(sumKeys.map((k) => [k, rest.reduce((s, r) => s + Number(r[k] ?? 0), 0)]));
  return [...rows.slice(0, TOP_N), { ...label(rest.length), ...sum }] as Record<string, unknown>[];
}

const reportHref = (p: Periode, tab: string, lokasi?: number[] | null) => `/admin/laporan?tab=${tab}&periode=kustom&dari=${p.firstDay}&sampai=${p.lastDay}${lokasi && lokasi.length === 1 ? `&lokasi=${lokasi[0]}` : ""}`;

async function report(ctx: ToolCtx, p: Periode, ids: number[] | null): Promise<ReportData> {
  return loadReportData(ctx.db, p, { locationIds: ids });
}

// ---------- Tool ----------

const TOOLS: ToolDef[] = [
  {
    name: "ringkasan_penjualan",
    description: `SATU-SATUNYA tool untuk omzet. Ringkasan penjualan satu periode: omzet, pesanan, rata-rata nilai pesanan, diskon, pembatalan, retur, dan perbandingan dengan periode pembanding. ${DEFINISI_OMZET}`,
    parameters: obj({ periode: PERIODE, pembanding: str("periode pembanding, misal minggu lalu; kosongkan untuk periode sebelumnya dengan panjang sama"), cabang: CABANG }),
    izin: ["laporan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const b = parsePembanding(typeof a.pembanding === "string" ? a.pembanding : undefined, p, ctx.now);
      if (!b.ok) throw new ToolProblem({ status: "periode_tidak_dikenal", pesan: b.message });
      const loc = await locationScope(ctx, a.cabang);
      const [cur, prev] = await Promise.all([report(ctx, p, loc.ids), report(ctx, b.periode, loc.ids)]);
      const s = summarize(cur);
      const q = summarize(prev);
      return {
        ...periodeInfo(p),
        cabang: loc.label,
        catatanLokasi: loc.catatanLokasi,
        definisiOmzet: DEFINISI_OMZET,
        omzetRp: s.revenue,
        pesanan: s.orders,
        rataRataPesananRp: s.averageOrder,
        unitTerjual: s.itemsSold,
        diskonProdukRp: s.productDiscount,
        diskonVoucherRp: s.voucherDiscount,
        pesananDibuat: s.created,
        dibatalkan: s.cancelled,
        persenBatal: s.cancelRate,
        diretur: s.returned,
        persenRetur: s.returnRate,
        pembanding: { periode: b.periode.label, omzetRp: q.revenue, pesanan: q.orders, rataRataPesananRp: q.averageOrder, dibatalkan: q.cancelled },
        perubahanPersen: { omzet: percentChange(s.revenue, q.revenue), pesanan: percentChange(s.orders, q.orders) },
        selisih: { omzetRp: s.revenue - q.revenue, pesanan: s.orders - q.orders },
        sumber: "summarize() di src/lib/reports",
        tautan: { label: "Lihat di Laporan", href: reportHref(p, "ringkasan", loc.ids) },
      };
    },
  },
  {
    name: "penjualan_per",
    description: `Rincian penjualan per dimensi (merek, kategori, cabang, kanal, metode_bayar, kurir, atau jam) dalam satu periode, 10 teratas plus lainnya. ${BUKAN_OMZET}`,
    parameters: obj({ dimensi: str("dimensi rincian", ["merek", "kategori", "cabang", "kanal", "metode_bayar", "kurir", "jam"]), periode: PERIODE, cabang: CABANG }, ["dimensi"]),
    izin: ["laporan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const loc = await locationScope(ctx, a.cabang);
      const data = await report(ctx, p, loc.ids);
      const dim = String(a.dimensi ?? "merek");
      let rows: Record<string, unknown>[];
      if (dim === "merek" || dim === "kategori") {
        const list = (dim === "merek" ? byBrand(data) : byCategory(data)).map((r) => ({ nama: r.label, pesanan: r.orders, unit: r.quantity, penjualanBarangRp: r.sales }));
        rows = topWithRest(list, ["unit", "penjualanBarangRp"], (n) => ({ nama: `${n} lainnya` }));
      } else {
        const ch = byChannel(data);
        const src = dim === "cabang" ? byLocation(data) : dim === "kanal" ? ch.method : dim === "metode_bayar" ? ch.payment : dim === "kurir" ? ch.courier : byHour(data);
        rows = topWithRest(
          src.map((r) => ({ nama: r.label, pesanan: r.orders, nilaiPesananRp: r.revenue, persenNilai: r.share })),
          ["pesanan", "nilaiPesananRp"],
          (n) => ({ nama: `${n} lainnya` }),
        );
      }
      return { ...periodeInfo(p), cabang: loc.label, catatanLokasi: loc.catatanLokasi, dimensi: dim, catatan: dim === "merek" || dim === "kategori" ? "penjualanBarangRp = harga barang x jumlah, sebelum voucher, poin, dan ongkir." : BUKAN_OMZET, baris: rows, sumber: "src/lib/reports", tautan: { label: "Lihat di Laporan", href: reportHref(p, dim === "merek" ? "merek" : dim === "kategori" ? "kategori" : dim === "cabang" ? "cabang" : "kanal", loc.ids) } };
    },
  },
  {
    name: "produk_terlaris",
    description: `Produk terlaris dalam satu periode menurut unit terjual, bisa disaring cabang, merek, atau kategori. ${BUKAN_OMZET}`,
    parameters: obj({ periode: PERIODE, cabang: CABANG, merek: str("nama merek, opsional"), kategori: str("nama kategori, opsional") }),
    izin: ["laporan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const loc = await locationScope(ctx, a.cabang);
      const brand = pick(a.merek, await brandCandidates(ctx.db), "merek");
      const cat = pick(a.kategori, await categoryCandidates(ctx.db), "kategori");
      const data = await report(ctx, p, loc.ids);
      const items = data.items.filter((i) => (!brand || i.brandId === brand.id) && (!cat || i.categoryId === cat.id || i.parentCategoryName === cat.name));
      const rows = topProducts({ ...data, items }, "quantity").map((r) => ({ produk: r.label, merek: r.brandName, unit: r.quantity, pesanan: r.orders, penjualanBarangRp: r.sales }));
      return { ...periodeInfo(p), cabang: loc.label, catatanLokasi: loc.catatanLokasi, merek: brand?.name ?? "semua", kategori: cat?.name ?? "semua", baris: topWithRest(rows, ["unit", "penjualanBarangRp"], (n) => ({ produk: `${n} produk lainnya` })), catatan: BUKAN_OMZET, sumber: "topProducts() di src/lib/reports", tautan: { label: "Lihat di Laporan", href: reportHref(p, "produk", loc.ids) } };
    },
  },
  {
    name: "stok_varian",
    description: "Stok tersedia (fisik dikurangi dipesan) per lokasi untuk produk atau varian yang dicari. Bila nama cocok dengan beberapa produk, hasilnya ambigu dan kamu wajib bertanya balik.",
    parameters: obj({ cari: str("nama produk, shade, atau SKU, misal cushion 02N"), lokasi: CABANG }, ["cari"]),
    izin: ["stok.lihat"],
    async run(a, ctx) {
      const q = String(a.cari ?? "").trim();
      if (!q) throw new ToolProblem({ status: "kurang_informasi", pesan: "Produk atau varian apa yang dicek?" });
      const loc = await locationScope(ctx, a.lokasi);
      const variants = await variantCandidates(ctx.db);
      const m = matchName(q, variants);
      let chosen: typeof variants = [];
      if (m.status === "cocok") chosen = [m.item];
      else if (m.status === "ambigu") {
        // Semua kandidat dari satu produk: tampilkan semua shadenya. Lintas produk: tanya balik.
        const all = variants.filter((v) => m.kandidat.some((k) => k.data!.productId === v.data!.productId));
        const products = new Set(m.kandidat.map((k) => k.data!.productId));
        if (products.size === 1) chosen = m.kandidat.length >= 5 ? all.slice(0, 12) : m.kandidat;
        else return { status: "ambigu", jenis: "produk", dicari: q, kandidat: [...new Set(m.kandidat.map((k) => k.data!.productName))], pesan: "Nama ini cocok dengan beberapa produk. Tanyakan yang mana." };
      } else {
        const p = matchName(q, await productCandidates(ctx.db));
        if (p.status === "cocok") chosen = variants.filter((v) => v.data!.productId === p.item.id).slice(0, 12);
        else if (p.status === "ambigu") return { status: "ambigu", jenis: "produk", dicari: q, kandidat: p.kandidat.map((k) => k.name), pesan: "Tanyakan produk yang mana." };
        else return { status: "tidak_ditemukan", dicari: q, pesan: `Tidak ada produk atau varian "${q}".` };
      }
      const ids = chosen.map((v) => v.id);
      const locIds = loc.ids ?? loc.locs.map((l) => l.id);
      const inv = await ctx.db.select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved }).from(schema.inventory).where(and(inArray(schema.inventory.variantId, ids.length ? ids : [-1]), inArray(schema.inventory.locationId, locIds.length ? locIds : [-1])));
      const threshold = await lowStockThreshold(ctx.db);
      return {
        cabang: loc.label,
        catatanLokasi: loc.catatanLokasi,
        waktu: formatDateTimeWib(ctx.now),
        ambangMenipis: threshold,
        varian: chosen.map((v) => ({
          produk: v.data!.productName,
          shade: v.data!.shadeName,
          sku: v.data!.sku,
          lokasi: loc.locs.filter((l) => locIds.includes(l.id)).map((l) => {
            const r = inv.find((x) => x.variantId === v.id && x.locationId === l.id);
            // tersedia null = varian tidak dijual di lokasi itu (bukan habis).
            return r ? { nama: l.name, tersedia: Math.max(0, r.onHand - r.reserved), dipesan: r.reserved } : { nama: l.name, tersedia: null, dipesan: 0, catatan: "tidak dijual di lokasi ini" };
          }),
          tautan: `/admin/stok/${v.id}`,
        })),
        sumber: "tabel inventory (stok saat ini)",
      };
    },
  },
  {
    name: "stok_menipis",
    description: "Varian yang stoknya habis atau menipis per lokasi (ambang dari Pengaturan), 10 teratas plus jumlah per lokasi.",
    parameters: obj({ lokasi: CABANG }),
    izin: ["stok.lihat"],
    async run(a, ctx) {
      const loc = await locationScope(ctx, a.lokasi);
      const threshold = await lowStockThreshold(ctx.db);
      const locIds = loc.ids ?? loc.locs.map((l) => l.id);
      const rows = await ctx.db
        .select({ locationId: schema.inventory.locationId, available: sql<number>`(${schema.inventory.onHand} - ${schema.inventory.reserved})::int`, productName: schema.products.name, shadeName: schema.variants.shadeName, variantId: schema.variants.id })
        .from(schema.inventory)
        .innerJoin(schema.variants, eq(schema.inventory.variantId, schema.variants.id))
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .where(and(inArray(schema.inventory.locationId, locIds.length ? locIds : [-1]), lte(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`, threshold), eq(schema.variants.isActive, true), eq(schema.products.status, "aktif")))
        .orderBy(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`, schema.products.name);
      const per = loc.locs.filter((l) => locIds.includes(l.id)).map((l) => ({ lokasi: l.name, habis: rows.filter((r) => r.locationId === l.id && r.available <= 0).length, menipis: rows.filter((r) => r.locationId === l.id && r.available > 0).length }));
      const name = (id: number) => loc.locs.find((l) => l.id === id)?.name ?? "";
      return { cabang: loc.label, catatanLokasi: loc.catatanLokasi, waktu: formatDateTimeWib(ctx.now), ambangMenipis: threshold, perLokasi: per, contoh: rows.slice(0, TOP_N).map((r) => ({ produk: r.productName, shade: r.shadeName, lokasi: name(r.locationId), tersedia: Math.max(0, r.available) })), totalBaris: rows.length, tautan: { label: "Buka Stok", href: "/admin/stok?status=menipis" } };
    },
  },
  {
    name: "permintaan_kabari_aku",
    description: "Varian habis yang ditunggu pembeli lewat Kabari aku, diurutkan jumlah peminat terbanyak.",
    parameters: obj({ periode: str(`opsional, hanya permintaan yang dibuat dalam periode ini. ${PERIODE_CONTOH}`) }),
    izin: ["stok.lihat"],
    async run(a, ctx) {
      const p = a.periode ? periodeOf(a.periode, ctx.now) : null;
      const rows = await ctx.db
        .select({ variantId: schema.variants.id, productName: schema.products.name, shadeName: schema.variants.shadeName, n: sql<number>`count(*)::int` })
        .from(schema.restockRequests)
        .innerJoin(schema.variants, eq(schema.restockRequests.variantId, schema.variants.id))
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .where(and(eq(schema.restockRequests.status, "menunggu"), p ? gte(schema.restockRequests.createdAt, p.from) : undefined, p ? lt(schema.restockRequests.createdAt, p.to) : undefined))
        .groupBy(schema.variants.id, schema.products.name, schema.variants.shadeName)
        .orderBy(desc(sql`count(*)`), schema.products.name);
      return { ...(p ? periodeInfo(p) : { periode: "semua permintaan yang masih menunggu" }), totalVarian: rows.length, totalPeminat: rows.reduce((s, r) => s + Number(r.n), 0), baris: rows.slice(0, TOP_N).map((r) => ({ produk: r.productName, shade: r.shadeName, peminat: Number(r.n), tautan: `/admin/stok/${r.variantId}` })), sumber: "tabel restock_requests (Kabari aku)" };
    },
  },
  {
    name: "pesanan_perlu_tindakan",
    description: "Pesanan yang perlu tindakan (belum diproses lebih dari 2 jam, Bayar di Toko yang kedaluwarsa hari ini, siap diambil lama), jumlah per status, dan pesanan ambil di toko yang aktif.",
    parameters: obj({ cabang: CABANG }),
    izin: ["pesanan.lihat"],
    async run(a, ctx) {
      const loc = await locationScope(ctx, a.cabang);
      const scoped: StaffPrincipal = loc.ids ? { ...ctx.staff, locationIds: loc.ids } : ctx.staff;
      const d = await dashboardData(ctx.db, scoped, ctx.now);
      const pickups = await listAdminOrders(ctx.db, scoped, { method: "ambil", pageSize: 30 });
      const active = pickups.rows.filter((o) => ["dibayar", "diproses", "siap_diambil", "menunggu_pembayaran"].includes(o.status));
      const orderActions = d.actions.filter((x) => x.kind === "belum_diproses" || x.kind === "bayar_di_toko" || x.kind === "siap_lama");
      return {
        cabang: loc.label,
        catatanLokasi: loc.catatanLokasi,
        waktu: formatDateTimeWib(ctx.now),
        perluTindakan: orderActions.slice(0, TOP_N).map((x) => ({ judul: x.title, detail: x.detail, tautan: x.href })),
        jumlahPerStatus: Object.fromEntries(Object.entries(d.counts).filter(([k]) => ["menunggu_pembayaran", "dibayar", "diproses", "siap_diambil", "dikirim"].includes(k)).map(([k, v]) => [statusLabels[k as OrderStatus], v])),
        ambilDiToko: active.slice(0, TOP_N).map((o) => ({ nomor: o.number, status: statusLabels[o.status], cabang: o.locationName, nama: o.name, dibuat: formatDateTimeWib(o.createdAt) })),
        totalAmbilAktif: active.length,
        tautan: { label: "Buka Pesanan", href: "/admin/pesanan" },
      };
    },
  },
  {
    name: "cari_pesanan",
    description: `Cari pesanan dengan nomor pesanan (RONA-...) atau nomor WA pembeli. Maksimal 5 pesanan terbaru. ${BUKAN_OMZET}`,
    parameters: obj({ cari: str("nomor pesanan atau nomor WA") }, ["cari"]),
    izin: ["pesanan.lihat"],
    async run(a, ctx) {
      const q = String(a.cari ?? "").trim();
      if (q.length < 4) throw new ToolProblem({ status: "kurang_informasi", pesan: "Sebutkan nomor pesanan atau nomor WA pembeli." });
      const digits = q.replace(/\D/g, "");
      const term = /rona-/i.test(q) ? q.toUpperCase() : digits.length >= 6 ? digits.slice(-9) : q;
      const r = await listAdminOrders(ctx.db, ctx.staff, { q: term, pageSize: 5 });
      if (!r.rows.length) return { status: "tidak_ditemukan", dicari: q, pesan: "Tidak ada pesanan yang cocok di lokasi yang boleh kamu lihat." };
      return { ditemukan: r.total, pesanan: r.rows.map((o) => ({ nomor: o.number, status: statusLabels[o.status], metode: o.method === "kirim" ? "Kirim" : "Ambil di toko", cabang: o.locationName, dibuat: formatDateTimeWib(o.createdAt), totalRp: o.total, jumlahBarang: o.itemCount, nama: o.name, nomorWa: o.phone, tautan: `/admin/pesanan/${o.number}` })) };
    },
  },
  {
    name: "ringkasan_pelanggan",
    description: "Ringkasan pelanggan: pembeli baru dibanding kembali dalam periode, dan jumlah pelanggan terdaftar per segmen (baru, setia, tidak aktif, lainnya). Tanpa data pribadi.",
    parameters: obj({ periode: PERIODE, segmen: str("opsional", ["baru", "setia", "tidak_aktif", "lainnya"]) }),
    izin: ["pelanggan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const [data, seg] = await Promise.all([report(ctx, p, lockedLocations(ctx.staff, null).ids), segmentCounts(ctx.db, ctx.now)]);
      const c = newVsReturning(data);
      const segmen = Object.fromEntries(Object.entries(seg).filter(([k]) => !a.segmen || k === a.segmen).map(([k, v]) => [SEGMENT_LABELS[k as keyof typeof SEGMENT_LABELS], v]));
      return { ...periodeInfo(p), pembeliBaru: c.newBuyers, pembeliKembali: c.returningBuyers, pesananPembeliBaru: c.newOrders, pesananPembeliKembali: c.returningOrders, nilaiPesananPembeliBaruRp: c.newRevenue, nilaiPesananPembeliKembaliRp: c.returningRevenue, segmenTerdaftar: segmen, catatan: `Segmen dihitung untuk pelanggan terdaftar sepanjang waktu. ${BUKAN_OMZET}`, tautan: { label: "Buka Pelanggan", href: a.segmen ? `/admin/pelanggan?segmen=${a.segmen}` : "/admin/pelanggan" } };
    },
  },
  {
    name: "ringkasan_ulasan",
    description: "Ringkasan ulasan dalam periode: jumlah, rata-rata bintang, sebaran bintang, yang belum dibalas, dan keluhan yang sering muncul (dari ringkasan ulasan AI bila ada). Bisa disaring bintang dan produk.",
    parameters: obj({ periode: PERIODE, bintang: { type: "INTEGER", description: "1 sampai 5, opsional" }, produk: str("nama produk, opsional") }),
    izin: ["ulasan.kelola"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const prod = pick(a.produk, await productCandidates(ctx.db), "produk");
      const star = Number.isInteger(Number(a.bintang)) && Number(a.bintang) >= 1 && Number(a.bintang) <= 5 ? Number(a.bintang) : null;
      const rows = await ctx.db
        .select({ id: schema.reviews.id, rating: schema.reviews.rating, body: schema.reviews.body, authorName: schema.reviews.authorName, replied: sql<boolean>`${schema.reviews.storeReply} is not null`, productId: schema.reviews.productId, productName: schema.products.name, createdAt: schema.reviews.createdAt })
        .from(schema.reviews)
        .innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
        .where(and(eq(schema.reviews.status, "tampil"), gte(schema.reviews.createdAt, p.from), lt(schema.reviews.createdAt, p.to), prod ? eq(schema.reviews.productId, prod.id) : undefined, star ? eq(schema.reviews.rating, star) : undefined))
        .orderBy(desc(schema.reviews.createdAt));
      const productIds = [...new Set(rows.map((r) => r.productId))];
      const summaries = productIds.length ? await ctx.db.select({ productId: schema.reviewSummaries.productId, summary: schema.reviewSummaries.summary }).from(schema.reviewSummaries).where(inArray(schema.reviewSummaries.productId, productIds)) : [];
      const complaints = new Map<string, number>();
      for (const s of summaries) for (const c of s.summary.cons) complaints.set(c, (complaints.get(c) ?? 0) + 1);
      const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : 0;
      return {
        ...periodeInfo(p),
        produk: prod?.name ?? "semua",
        jumlah: rows.length,
        rataRataBintang: avg,
        perBintang: Object.fromEntries([5, 4, 3, 2, 1].map((n) => [`${n} bintang`, rows.filter((r) => r.rating === n).length])),
        belumDibalas: rows.filter((r) => !r.replied).length,
        keluhanSering: [...complaints.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k]) => k),
        rendahBelumDibalas: rows.filter((r) => !r.replied && r.rating <= 2).slice(0, 5).map((r) => ({ produk: r.productName, bintang: r.rating, penulis: r.authorName, cuplikan: r.body.slice(0, 120) })),
        tautan: { label: "Buka Ulasan", href: "/admin/ulasan?belum=1" },
      };
    },
  },
  {
    name: "kinerja_voucher",
    description: `Kinerja voucher dalam periode: pesanan, nilai pesanan, potongan, kuota terpakai. ${BUKAN_OMZET}`,
    parameters: obj({ periode: PERIODE }),
    izin: ["laporan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const data = await report(ctx, p, lockedLocations(ctx.staff, null).ids);
      const rows = voucherPerformance(data).map((v) => ({ kode: v.code, judul: v.title, pesanan: v.orders, nilaiPesananRp: v.revenue, potonganRp: v.discount, kuota: v.quota, terpakai: v.used }));
      return { ...periodeInfo(p), baris: topWithRest(rows, ["pesanan", "nilaiPesananRp", "potonganRp"], (n) => ({ kode: `${n} voucher lainnya` })), catatan: BUKAN_OMZET, tautan: { label: "Lihat di Laporan", href: reportHref(p, "promo", null) } };
    },
  },
  {
    name: "kinerja_flash_sale",
    description: `Kinerja slot flash sale yang mulai dalam periode: unit, penjualan barang, potongan dari harga normal, kuota terjual. ${BUKAN_OMZET}`,
    parameters: obj({ periode: PERIODE }),
    izin: ["laporan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const data = await report(ctx, p, lockedLocations(ctx.staff, null).ids);
      const rows = flashPerformance(data).map((f) => ({ slot: f.name, mulai: formatDateTimeWib(f.startsAt), unit: f.quantity, penjualanBarangRp: f.sales, potonganRp: f.discount, kuota: f.quota, terjual: f.sold }));
      return { ...periodeInfo(p), baris: topWithRest(rows, ["unit", "penjualanBarangRp", "potonganRp"], (n) => ({ slot: `${n} slot lainnya` })), catatan: BUKAN_OMZET, tautan: { label: "Lihat di Laporan", href: reportHref(p, "promo", null) } };
    },
  },
  {
    name: "kinerja_advisor",
    description: `Kinerja Rona Advisor dalam periode: pesan ke Advisor, tambah ke keranjang dari Advisor, pesanan berisi item Advisor, penjualan item itu, rata-rata nilai pesanan dengan dan tanpa item Advisor. Korelasi, bukan sebab-akibat. ${BUKAN_OMZET}`,
    parameters: obj({ periode: PERIODE }),
    izin: ["laporan.lihat"],
    async run(a, ctx) {
      const p = periodeOf(a.periode, ctx.now, "30 hari terakhir");
      const data = await report(ctx, p, lockedLocations(ctx.staff, null).ids);
      const r = advisorPerformance(data);
      return { ...periodeInfo(p), pesanKeAdvisor: r.conversations, tambahKeKeranjang: r.cartAdds, pesananDenganItemAdvisor: r.orders, persenDariPesanan: r.ordersShare, penjualanItemAdvisorRp: r.itemSales, rataRataPesananDenganAdvisorRp: r.aovWith, rataRataPesananTanpaAdvisorRp: r.aovWithout, catatan: "Ini korelasi, bukan bukti bahwa Advisor menyebabkan pembelian.", tautan: { label: "Lihat di Laporan", href: reportHref(p, "advisor", null) } };
    },
  },
  {
    name: "saran_transfer_stok",
    description: "Saran transfer stok (deterministik) dari laju jual 14 hari: cabang yang akan habis dan lokasi yang berlebih, dengan jumlah dan alasannya, plus tautan draf transfer. Tidak memindahkan stok.",
    parameters: obj({ lokasi: CABANG }),
    izin: ["stok.lihat"],
    async run(a, ctx) {
      const loc = await locationScope(ctx, a.lokasi);
      const settings = await loadSettings(ctx.db);
      const r = await transferSuggestions(ctx.db, { now: ctx.now, kurangHari: settings.saran.kurangHari, lebihHari: settings.saran.lebihHari, keepMin: settings.lowStock, locationIds: loc.ids, limit: 5 });
      return {
        cabang: loc.label,
        catatanLokasi: loc.catatanLokasi,
        aturan: `Cabang dianggap akan habis bila stoknya cukup kurang dari ${r.kurangHari} hari; asal harus berlebih lebih dari ${r.lebihHari} hari. Laju jual dari ${r.windowDays} hari terakhir.`,
        totalSaran: r.total,
        saran: r.suggestions.map((s) => ({ produk: s.productName, shade: s.shadeName, dari: s.fromName, ke: s.toName, jumlah: s.quantity, alasan: s.alasan, ...(canAll(ctx.staff, "stok.transfer", [s.fromId, s.toId]) ? { tautanDraf: transferDraftHref([s]) } : {}) })),
        tautan: { label: "Buka saran transfer", href: "/admin/stok#saran-transfer" },
      };
    },
  },
  {
    name: "saran_flash_sale",
    description: `Saran kandidat flash sale (deterministik): lambat laku, stok online tinggi, rating baik, belum ikut flash sale 30 hari, dengan usulan harga flash dan kuota, plus tautan draf. Tidak membuat slot. ${BUKAN_OMZET}`,
    parameters: obj({ periode: str("opsional, abaikan; jendela penjualan selalu 30 hari terakhir") }),
    izin: ["promo.kelola"],
    async run(_a, ctx) {
      const settings = await loadSettings(ctx.db);
      const r = await flashSuggestions(ctx.db, { now: ctx.now, minDiscount: settings.saran.flashDiskonMin, maxDiscount: settings.saran.flashDiskonMaks, limit: 5 });
      return { aturan: `Diskon ${settings.saran.flashDiskonMin} sampai ${settings.saran.flashDiskonMaks} persen dari harga normal, jendela penjualan ${r.windowDays} hari.`, saran: r.suggestions.map((s) => ({ produk: s.productName, shade: s.shadeName, hargaNormalRp: s.normalPrice, hargaFlashRp: s.flashPrice, diskonPersen: s.discountPercent, kuota: s.quota, alasan: s.alasan, tautanDraf: flashDraftHref(s) })), tautan: { label: "Buka Promo", href: "/admin/promo?tab=flash" } };
    },
  },
  {
    name: "panduan_admin",
    description: "Cara pakai panel admin (membuat voucher, transfer stok, opname, flash sale, balas ulasan, laporan, Kabar Harian, staf, asisten). Jawab pertanyaan cara pakai HANYA dari hasil tool ini.",
    parameters: obj({ topik: str("topik cara pakai, misal membuat voucher") }, ["topik"]),
    izin: null,
    async run(a) {
      const guides = await loadGuides();
      const g = findGuide(guides, String(a.topik ?? ""));
      if (!g) return { status: "tidak_ditemukan", topikTersedia: guides.map((x) => x.title), pesan: "Panduan untuk topik itu belum ada." };
      return { judul: g.title, isi: g.body.slice(0, 1800), sumber: `docs/panduan-admin/${g.slug}.md` };
    },
  },
];

export const TOOL_REGISTRY: ReadonlyMap<string, ToolDef> = new Map(TOOLS.map((t) => [t.name, t]));

export const toolAllowed = (staff: StaffPrincipal, t: Pick<ToolDef, "izin">) => !t.izin || t.izin.some((k) => can(staff, k));

// Daftar tool yang diberikan ke model untuk staf ini (disaring can()).
export function toolsFor(staff: StaffPrincipal): ToolDef[] {
  return TOOLS.filter((t) => (READ_ONLY_TOOLS as readonly string[]).includes(t.name) && toolAllowed(staff, t));
}

export type ExecOutcome = { name: string; ok: boolean; denied?: boolean; result: ToolResult };

// Eksekutor: hanya tool di daftar izin baca, diperiksa lagi dengan can() sebelum dijalankan, lalu hasilnya disaring
// sesuai izin (kolom rupiah dan kontak).
export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<ExecOutcome> {
  const tool = (READ_ONLY_TOOLS as readonly string[]).includes(name) ? TOOL_REGISTRY.get(name) : undefined;
  if (!tool) return { name, ok: false, denied: true, result: { status: "ditolak", pesan: `Tool ${name} tidak ada di daftar tool baca.` } };
  if (!toolAllowed(ctx.staff, tool)) return { name, ok: false, denied: true, result: { status: "ditolak", pesan: "Kamu tidak punya izin untuk data ini." } };
  try {
    const raw = await tool.run(args, ctx);
    return { name, ok: true, result: applyRole(ctx.staff, JSON.parse(JSON.stringify(raw)) as ToolResult) };
  } catch (e) {
    if (e instanceof ToolProblem) return { name, ok: true, result: e.result };
    return { name, ok: false, result: { status: "galat", pesan: "Data belum bisa dibaca sekarang." } };
  }
}
