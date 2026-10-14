// Satu sumber angka laporan: fungsi agregasi murni di atas data pesanan yang sudah dimuat (lihat load.ts).
// Dashboard, halaman Laporan, unduhan Excel, dan asisten AI (Fase 7) wajib memakai fungsi di sini.
// Omzet (BRIEF, Fase 6A): total pesanan yang sudah mencapai Dibayar, dikurangi yang kemudian Dibatalkan atau Diretur,
// dikelompokkan per tanggal bayar dalam WIB. Semua batas hari memakai WIB.
import { toWibParts, wibDate } from "@/lib/format";

const DAY = 24 * 60 * 60_000;
export const REVENUE_EXCLUDED = ["dibatalkan", "diretur"] as const;
export const MAX_CUSTOM_DAYS = 366;

// ---------- Hari dan periode WIB ----------

// Kunci hari WIB "2026-10-14" untuk sebuah waktu UTC.
export function wibDayKey(d: Date) {
  const p = toWibParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Awal hari WIB (dalam UTC) untuk `now` dikurangi `daysBack` hari.
export function wibDayStart(now: Date, daysBack = 0) {
  const p = toWibParts(new Date(now.getTime() - daysBack * DAY));
  return wibDate(p.year, p.month, p.day);
}

const dayFromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return wibDate(y, m, d);
};

// Rentang setengah terbuka [from, to) dengan batas awal hari WIB.
export type ReportRange = { from: Date; to: Date };
export type PeriodPreset = "hari_ini" | "7_hari" | "30_hari" | "bulan_ini" | "bulan_lalu" | "kustom";
export const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "hari_ini", label: "Hari ini" },
  { key: "7_hari", label: "7 hari" },
  { key: "30_hari", label: "30 hari" },
  { key: "bulan_ini", label: "Bulan ini" },
  { key: "bulan_lalu", label: "Bulan lalu" },
  { key: "kustom", label: "Kustom" },
];

export type ResolvedPeriod = ReportRange & { preset: PeriodPreset; firstDay: string; lastDay: string; days: number; error?: string };

export function rangeDays(r: ReportRange) {
  return Math.round((r.to.getTime() - r.from.getTime()) / DAY);
}

function finish(preset: PeriodPreset, from: Date, to: Date, error?: string): ResolvedPeriod {
  return { preset, from, to, firstDay: wibDayKey(from), lastDay: wibDayKey(new Date(to.getTime() - 1)), days: rangeDays({ from, to }), ...(error ? { error } : {}) };
}

// Periode laporan dari pilihan pengguna. Kustom memakai tanggal WIB "YYYY-MM-DD" (inklusif) dan maksimal 366 hari.
export function resolvePeriod(preset: string | undefined, now: Date, custom: { from?: string; to?: string } = {}): ResolvedPeriod {
  const today = wibDayStart(now);
  const tomorrow = wibDayStart(now, -1);
  const p = toWibParts(now);
  switch (preset) {
    case "hari_ini":
      return finish("hari_ini", today, tomorrow);
    case "7_hari":
      return finish("7_hari", wibDayStart(now, 6), tomorrow);
    case "bulan_ini":
      return finish("bulan_ini", wibDate(p.year, p.month, 1), tomorrow);
    case "bulan_lalu":
      return finish("bulan_lalu", wibDate(p.year, p.month - 1, 1), wibDate(p.year, p.month, 1));
    case "kustom": {
      const ok = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");
      if (!ok(custom.from) || !ok(custom.to)) return { ...finish("30_hari", wibDayStart(now, 29), tomorrow), error: "Isi tanggal mulai dan selesai." };
      const from = dayFromKey(custom.from!);
      const to = new Date(dayFromKey(custom.to!).getTime() + DAY);
      if (to.getTime() <= from.getTime()) return { ...finish("30_hari", wibDayStart(now, 29), tomorrow), error: "Tanggal selesai harus sama atau setelah tanggal mulai." };
      if (rangeDays({ from, to }) > MAX_CUSTOM_DAYS) return { ...finish("30_hari", wibDayStart(now, 29), tomorrow), error: `Periode kustom maksimal ${MAX_CUSTOM_DAYS} hari.` };
      return finish("kustom", from, to);
    }
    default:
      return finish("30_hari", wibDayStart(now, 29), tomorrow);
  }
}

// Periode pembanding: panjang sama, tepat sebelum periode ini.
export function previousRange(r: ReportRange): ReportRange {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: r.from };
}

const inRange = (d: Date | null, r: ReportRange) => d != null && d.getTime() >= r.from.getTime() && d.getTime() < r.to.getTime();

// Persen naik atau turun dibanding periode sebelumnya; null bila pembandingnya 0.
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ---------- Bentuk data ----------

export type ReportOrder = {
  id: number;
  number: string;
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  method: "kirim" | "ambil";
  locationId: number;
  locationName: string;
  paymentMethod: string | null;
  courier: string | null;
  customerId: number | null;
  buyerKey: string; // "c:<id>" untuk pembeli terdaftar, "t:<nomor>" untuk tamu
  buyerName: string;
  subtotal: number;
  productDiscount: number;
  voucherDiscount: number;
  shippingCost: number;
  shippingDiscount: number; // gratis ongkir otomatis + voucher gratis ongkir
  voucherShippingDiscount: number; // bagian shippingDiscount yang berasal dari voucher bertipe ongkir
  pointsUsed: number;
  total: number;
  voucherCode: string | null;
};

export type ReportItem = {
  orderId: number;
  variantId: number;
  sku: string;
  productId: number;
  productName: string;
  productSlug: string;
  shadeName: string;
  hex: string;
  packaging: string;
  brandId: number;
  brandName: string;
  brandColor: string;
  categoryId: number;
  categoryName: string;
  parentCategoryName: string;
  quantity: number;
  unitPrice: number;
  normalPrice: number;
  priceSource: string;
  flashSaleItemId: number | null;
};

export type ReportFlashSlot = { id: number; name: string; startsAt: Date; endsAt: Date; source: string; items: { id: number; quota: number; sold: number }[] };
export type ReportVoucher = { code: string; title: string; quota: number | null; used: number };

export type ReportData = {
  range: ReportRange;
  orders: ReportOrder[]; // pesanan yang dibuat ATAU dibayar dalam rentang
  items: ReportItem[]; // item dari pesanan di atas
  firstRevenueAt: Map<string, Date>; // pesanan omzet pertama per pembeli, sepanjang masa
  flashSlots: ReportFlashSlot[];
  vouchers: ReportVoucher[];
};

export const isRevenueOrder = (o: Pick<ReportOrder, "paidAt" | "status">) => o.paidAt != null && !(REVENUE_EXCLUDED as readonly string[]).includes(o.status);

// Pesanan yang dihitung dalam omzet periode ini: sudah dibayar dalam rentang, tidak batal atau retur.
export function revenueOrders(data: Pick<ReportData, "orders" | "range">) {
  return data.orders.filter((o) => isRevenueOrder(o) && inRange(o.paidAt, data.range));
}

function revenueItems(data: ReportData) {
  const ids = new Set(revenueOrders(data).map((o) => o.id));
  return data.items.filter((i) => ids.has(i.orderId));
}

// ---------- Ringkasan dan harian ----------

export type ReportSummary = {
  revenue: number;
  orders: number;
  averageOrder: number;
  itemsSold: number;
  productDiscount: number;
  voucherDiscount: number;
  pointsUsed: number;
  shippingCharged: number; // ongkir yang dibayar pembeli
  shippingDiscount: number; // potongan ongkir (gratis ongkir otomatis dan voucher ongkir)
  created: number;
  cancelled: number;
  cancelRate: number; // persen dari pesanan yang dibuat dalam periode
  paid: number;
  returned: number;
  returnRate: number; // persen dari pesanan yang dibayar dalam periode
};

const rate = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function summarize(data: ReportData): ReportSummary {
  const rev = revenueOrders(data);
  const revenue = rev.reduce((s, o) => s + o.total, 0);
  const ids = new Set(rev.map((o) => o.id));
  const created = data.orders.filter((o) => inRange(o.createdAt, data.range));
  const paid = data.orders.filter((o) => inRange(o.paidAt, data.range));
  const cancelled = created.filter((o) => o.status === "dibatalkan").length;
  const returned = paid.filter((o) => o.status === "diretur").length;
  return {
    revenue,
    orders: rev.length,
    averageOrder: rev.length ? Math.round(revenue / rev.length) : 0,
    itemsSold: data.items.filter((i) => ids.has(i.orderId)).reduce((s, i) => s + i.quantity, 0),
    productDiscount: rev.reduce((s, o) => s + o.productDiscount, 0),
    voucherDiscount: rev.reduce((s, o) => s + o.voucherDiscount, 0),
    pointsUsed: rev.reduce((s, o) => s + o.pointsUsed, 0),
    shippingCharged: rev.reduce((s, o) => s + o.shippingCost - o.shippingDiscount, 0),
    shippingDiscount: rev.reduce((s, o) => s + o.shippingDiscount, 0),
    created: created.length,
    cancelled,
    cancelRate: rate(cancelled, created.length),
    paid: paid.length,
    returned,
    returnRate: rate(returned, paid.length),
  };
}

export type DailyRow = { day: string; revenue: number; orders: number };

// Seri harian: satu baris per hari WIB dalam rentang, termasuk hari tanpa penjualan.
export function dailySeries(data: Pick<ReportData, "orders" | "range">): DailyRow[] {
  const keys: string[] = [];
  for (let t = data.range.from.getTime(); t < data.range.to.getTime(); t += DAY) keys.push(wibDayKey(new Date(t)));
  const sums = new Map(keys.map((k) => [k, { revenue: 0, orders: 0 }]));
  for (const o of revenueOrders(data)) {
    const b = sums.get(wibDayKey(o.paidAt!));
    if (!b) continue;
    b.revenue += o.total;
    b.orders += 1;
  }
  return keys.map((k) => ({ day: k, ...sums.get(k)! }));
}

// Bentuk yang dipakai Dashboard sejak Fase 6A: N hari terakhir termasuk hari ini (WIB).
export function dailyRevenue(orders: Pick<ReportOrder, "total" | "paidAt" | "status">[], now: Date, days = 30) {
  const range = { from: wibDayStart(now, days - 1), to: wibDayStart(now, -1) };
  const series = dailySeries({ orders: orders as ReportOrder[], range });
  const today = series[series.length - 1];
  const total = series.reduce((s, d) => s + d.revenue, 0);
  const paidOrders = series.reduce((s, d) => s + d.orders, 0);
  return { series, today: today.revenue, todayOrders: today.orders, total, paidOrders, averageOrder: paidOrders ? Math.round(total / paidOrders) : 0 };
}

// ---------- Rincian ----------

export type BreakdownRow = { key: string; label: string; orders: number; quantity: number; sales: number };

// Penjualan barang (harga satuan x jumlah) dari pesanan omzet, dikelompokkan per kunci.
function groupItems(data: ReportData, keyOf: (i: ReportItem) => [string, string]): BreakdownRow[] {
  const map = new Map<string, BreakdownRow & { orderIds: Set<number> }>();
  for (const i of revenueItems(data)) {
    const [key, label] = keyOf(i);
    const row = map.get(key) ?? { key, label, orders: 0, quantity: 0, sales: 0, orderIds: new Set<number>() };
    row.quantity += i.quantity;
    row.sales += i.unitPrice * i.quantity;
    row.orderIds.add(i.orderId);
    map.set(key, row);
  }
  return [...map.values()].map(({ orderIds, ...r }) => ({ ...r, orders: orderIds.size })).sort((a, b) => b.sales - a.sales || b.quantity - a.quantity || a.label.localeCompare(b.label));
}

export const byBrand = (data: ReportData) => groupItems(data, (i) => [String(i.brandId), i.brandName]);
export const byCategory = (data: ReportData) => groupItems(data, (i) => [String(i.categoryId), i.parentCategoryName ? `${i.parentCategoryName}, ${i.categoryName}` : i.categoryName]);

export type OrderGroupRow = { key: string; label: string; orders: number; revenue: number; share: number };

// Omzet (total pesanan) dikelompokkan per atribut pesanan; share dalam persen omzet.
function groupOrders(data: ReportData, keyOf: (o: ReportOrder) => [string, string]): OrderGroupRow[] {
  const rev = revenueOrders(data);
  const total = rev.reduce((s, o) => s + o.total, 0);
  const map = new Map<string, OrderGroupRow>();
  for (const o of rev) {
    const [key, label] = keyOf(o);
    const row = map.get(key) ?? { key, label, orders: 0, revenue: 0, share: 0 };
    row.orders += 1;
    row.revenue += o.total;
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({ ...r, share: rate(r.revenue, total) })).sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));
}

const PAYMENT_LABELS: Record<string, string> = { qris: "QRIS", va_bca: "VA BCA", va_bni: "VA BNI", va_bri: "VA BRI", va_mandiri: "VA Mandiri", bayar_di_toko: "Bayar di Toko" };
const COURIER_LABELS: Record<string, string> = { jne_reg: "JNE REG", jne_yes: "JNE YES", jnt_ez: "J&T EZ", sicepat_reg: "SiCepat REG", instan: "Kurir Instan", ambil_di_toko: "Ambil di Toko" };

export const byLocation = (data: ReportData) => groupOrders(data, (o) => [String(o.locationId), o.locationName]);
export function byChannel(data: ReportData) {
  return {
    method: groupOrders(data, (o) => [o.method, o.method === "kirim" ? "Kirim" : "Ambil di Toko"]),
    payment: groupOrders(data, (o) => [o.paymentMethod ?? "-", PAYMENT_LABELS[o.paymentMethod ?? ""] ?? o.paymentMethod ?? "Tidak diketahui"]),
    courier: groupOrders(data, (o) => (o.method === "ambil" ? ["ambil_di_toko", "Ambil di Toko"] : [o.courier ?? "-", COURIER_LABELS[o.courier ?? ""] ?? o.courier ?? "Tidak diketahui"])),
  };
}

export type ProductRow = BreakdownRow & { productId: number; slug: string; brandName: string; brandColor: string; packaging: string; hex: string };
// Urutan bawaan menurut penjualan rupiah; Dashboard memakai "quantity" (unit terjual).
export function topProducts(data: ReportData, sortBy: "sales" | "quantity" = "sales"): ProductRow[] {
  const meta = new Map<string, ReportItem>();
  for (const i of data.items) if (!meta.has(String(i.productId))) meta.set(String(i.productId), i);
  const rows = groupItems(data, (i) => [String(i.productId), i.productName]);
  if (sortBy === "quantity") rows.sort((a, b) => b.quantity - a.quantity || b.sales - a.sales || a.label.localeCompare(b.label));
  return rows.map((r) => {
    const m = meta.get(r.key)!;
    return { ...r, productId: m.productId, slug: m.productSlug, brandName: m.brandName, brandColor: m.brandColor, packaging: m.packaging, hex: m.hex };
  });
}

export type VariantRow = BreakdownRow & { sku: string; productName: string; shadeName: string; hex: string };
export function topVariants(data: ReportData): VariantRow[] {
  const meta = new Map<string, ReportItem>();
  for (const i of data.items) if (!meta.has(String(i.variantId))) meta.set(String(i.variantId), i);
  return groupItems(data, (i) => [String(i.variantId), `${i.productName}, ${i.shadeName}`]).map((r) => {
    const m = meta.get(r.key)!;
    return { ...r, sku: m.sku, productName: m.productName, shadeName: m.shadeName, hex: m.hex };
  });
}

export type VoucherRow = { code: string; title: string; orders: number; revenue: number; discount: number; quota: number | null; used: number };
export function voucherPerformance(data: ReportData): VoucherRow[] {
  const map = new Map<string, VoucherRow>();
  for (const o of revenueOrders(data)) {
    if (!o.voucherCode) continue;
    const v = data.vouchers.find((x) => x.code === o.voucherCode);
    const row = map.get(o.voucherCode) ?? { code: o.voucherCode, title: v?.title ?? "", orders: 0, revenue: 0, discount: 0, quota: v?.quota ?? null, used: v?.used ?? 0 };
    row.orders += 1;
    row.revenue += o.total;
    // Potongan voucher ongkir tercatat di potongan ongkir; potongan voucher produk di voucherDiscount.
    row.discount += o.voucherDiscount;
    map.set(o.voucherCode, row);
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders || a.code.localeCompare(b.code));
}

export type FlashRow = { id: number; name: string; startsAt: Date; endsAt: Date; source: string; quantity: number; sales: number; discount: number; quota: number; sold: number };
// Kinerja slot flash sale yang mulai dalam rentang: penjualan, kuota terpakai, potongan dari harga normal.
export function flashPerformance(data: ReportData): FlashRow[] {
  const items = revenueItems(data);
  return data.flashSlots
    .filter((s) => inRange(s.startsAt, data.range) && s.items.length > 0)
    .map((s) => {
      const ids = new Set(s.items.map((i) => i.id));
      const lines = items.filter((i) => i.flashSaleItemId != null && ids.has(i.flashSaleItemId));
      return {
        id: s.id,
        name: s.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        source: s.source,
        quantity: lines.reduce((t, i) => t + i.quantity, 0),
        sales: lines.reduce((t, i) => t + i.unitPrice * i.quantity, 0),
        discount: lines.reduce((t, i) => t + Math.max(0, i.normalPrice - i.unitPrice) * i.quantity, 0),
        quota: s.items.reduce((t, i) => t + i.quota, 0),
        sold: s.items.reduce((t, i) => t + i.sold, 0),
      };
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

// Pembeli baru: pesanan omzet pertamanya (sepanjang masa) jatuh di periode ini. Kembali: sudah pernah sebelumnya.
export function newVsReturning(data: ReportData) {
  const out = { newBuyers: 0, returningBuyers: 0, newRevenue: 0, returningRevenue: 0, newOrders: 0, returningOrders: 0 };
  const seen = new Map<string, boolean>();
  for (const o of revenueOrders(data)) {
    const first = data.firstRevenueAt.get(o.buyerKey) ?? o.paidAt!;
    const isNew = first.getTime() >= data.range.from.getTime();
    if (!seen.has(o.buyerKey)) {
      seen.set(o.buyerKey, isNew);
      if (isNew) out.newBuyers += 1;
      else out.returningBuyers += 1;
    }
    if (isNew) {
      out.newRevenue += o.total;
      out.newOrders += 1;
    } else {
      out.returningRevenue += o.total;
      out.returningOrders += 1;
    }
  }
  return out;
}

// Rekonsiliasi omzet: penjualan barang - potongan voucher belanja - poin + ongkir dibayar = omzet.
// Voucher gratis ongkir TIDAK masuk potongan voucher belanja (orders.voucher_discount = 0 untuk voucher ongkir);
// potongannya bagian dari potongan ongkir, jadi ditampilkan terpisah di baris ongkir dan tidak terhitung dua kali.
export type Reconciliation = {
  itemSales: number;
  voucherDiscount: number;
  pointsUsed: number;
  shippingCost: number;
  autoFreeShipping: number;
  voucherShipping: number;
  shippingPaid: number;
  revenue: number;
  computed: number;
  balanced: boolean;
};

export function reconcile(data: ReportData): Reconciliation {
  const rev = revenueOrders(data);
  const ids = new Set(rev.map((o) => o.id));
  const itemSales = data.items.filter((i) => ids.has(i.orderId)).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const sum = (f: (o: ReportOrder) => number) => rev.reduce((s, o) => s + f(o), 0);
  const voucherDiscount = sum((o) => o.voucherDiscount);
  const pointsUsed = sum((o) => o.pointsUsed);
  const shippingCost = sum((o) => o.shippingCost);
  const voucherShipping = sum((o) => o.voucherShippingDiscount);
  const autoFreeShipping = sum((o) => o.shippingDiscount) - voucherShipping;
  const shippingPaid = shippingCost - autoFreeShipping - voucherShipping;
  const revenue = sum((o) => o.total);
  const computed = itemSales - voucherDiscount - pointsUsed + shippingPaid;
  return { itemSales, voucherDiscount, pointsUsed, shippingCost, autoFreeShipping, voucherShipping, shippingPaid, revenue, computed, balanced: computed === revenue };
}

// Laporan lengkap untuk satu periode (dipakai halaman Laporan dan Excel).
export function buildReport(data: ReportData) {
  return {
    summary: summarize(data),
    reconciliation: reconcile(data),
    daily: dailySeries(data),
    brands: byBrand(data),
    categories: byCategory(data),
    locations: byLocation(data),
    channels: byChannel(data),
    products: topProducts(data),
    variants: topVariants(data),
    vouchers: voucherPerformance(data),
    flash: flashPerformance(data),
    customers: newVsReturning(data),
  };
}
export type Report = ReturnType<typeof buildReport>;
