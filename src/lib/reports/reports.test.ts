// Fungsi laporan terhadap data uji yang dihitung manual, termasuk batas hari WIB.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { wibDate } from "@/lib/format";
import { buildReportWorkbook, MONEY_FORMAT, REPORT_SHEETS, reportFileName } from "./excel";
import { buildReport, dailyRevenue, percentChange, previousRange, resolvePeriod, type ReportData, type ReportItem, type ReportOrder } from "./index";

const NOW = wibDate(2026, 10, 14, 10, 0);
let seq = 0;
const order = (over: Partial<ReportOrder>): ReportOrder => {
  seq += 1;
  return {
    id: seq,
    number: `RONA-2610-${String(seq).padStart(6, "0")}`,
    createdAt: over.paidAt ?? wibDate(2026, 10, 12, 9),
    paidAt: null,
    status: "selesai",
    method: "kirim",
    locationId: 1,
    locationName: "Gudang Online",
    paymentMethod: "qris",
    courier: "jne_reg",
    customerId: null,
    buyerKey: `t:${seq}`,
    buyerName: "Uji",
    subtotal: 0,
    productDiscount: 0,
    voucherDiscount: 0,
    shippingCost: 0,
    shippingDiscount: 0,
    voucherShippingDiscount: 0,
    pointsUsed: 0,
    total: 0,
    voucherCode: null,
    ...over,
  };
};
const item = (orderId: number, over: Partial<ReportItem>): ReportItem => ({
  orderId,
  source: null,
  variantId: 1,
  sku: "LUMI-001-01",
  productId: 10,
  productName: "Lumi Matte",
  productSlug: "lumi-matte",
  shadeName: "Mawar",
  hex: "#B8475D",
  packaging: "lipstick",
  brandId: 1,
  brandName: "Lumi",
  brandColor: "#C2416B",
  categoryId: 5,
  categoryName: "Lipstik",
  parentCategoryName: "Bibir",
  quantity: 1,
  unitPrice: 100_000,
  normalPrice: 120_000,
  priceSource: "promo",
  flashSaleItemId: null,
  ...over,
});

// Periode 7 hari: 8 Okt 00.00 WIB sampai 15 Okt 00.00 WIB.
const period = resolvePeriod("7_hari", NOW);
const o1 = order({ paidAt: wibDate(2026, 10, 14, 0, 30), total: 110_000, subtotal: 100_000, productDiscount: 20_000, shippingCost: 10_000, customerId: 7, buyerKey: "c:7", voucherCode: "HEMAT", voucherDiscount: 0 }); // hari ini WIB (UTC masih 13 Okt)
const o2 = order({ paidAt: wibDate(2026, 10, 13, 23, 59), total: 250_000, subtotal: 260_000, voucherDiscount: 20_000, pointsUsed: 5_000, shippingCost: 15_000, shippingDiscount: 0, method: "ambil", locationId: 2, locationName: "Rona Dinoyo", paymentMethod: "bayar_di_toko", courier: null, voucherCode: "HEMAT", customerId: 8, buyerKey: "c:8" });
const o3 = order({ paidAt: wibDate(2026, 10, 10, 12), total: 70_000, subtotal: 60_000, shippingCost: 10_000, status: "dibatalkan" }); // batal setelah bayar
const o4 = order({ paidAt: wibDate(2026, 10, 9, 12), total: 90_000, subtotal: 80_000, shippingCost: 10_000, status: "diretur" });
const o5 = order({ createdAt: wibDate(2026, 10, 11, 8), paidAt: null, total: 40_000, status: "dibatalkan" }); // kedaluwarsa
const o6 = order({ createdAt: wibDate(2026, 10, 7, 23, 59), paidAt: wibDate(2026, 10, 8, 0, 1), total: 60_000, subtotal: 60_000, customerId: 7, buyerKey: "c:7" }); // dibuat sebelum periode, dibayar di dalam
const o7 = order({ paidAt: wibDate(2026, 10, 7, 23, 59), total: 999_000, subtotal: 999_000 }); // di luar periode

const data: ReportData = {
  range: period,
  orders: [o1, o2, o3, o4, o5, o6, o7],
  items: [
    item(o1.id, { quantity: 1, unitPrice: 100_000, normalPrice: 120_000 }),
    item(o2.id, { quantity: 2, unitPrice: 80_000, normalPrice: 100_000, variantId: 2, sku: "PUAL-002-01", productId: 20, productName: "Pualam Cushion", productSlug: "pualam-cushion", shadeName: "Langsat", brandId: 2, brandName: "Pualam", categoryId: 6, categoryName: "Cushion", parentCategoryName: "Wajah", flashSaleItemId: 501, priceSource: "flash" }),
    item(o2.id, { quantity: 1, unitPrice: 100_000, normalPrice: 100_000 }),
    item(o3.id, { quantity: 1, unitPrice: 60_000 }),
    item(o6.id, { quantity: 1, unitPrice: 60_000, variantId: 3, sku: "PUAL-002-02", shadeName: "Kuning Langsat", brandId: 2, brandName: "Pualam", productId: 20, productName: "Pualam Cushion", productSlug: "pualam-cushion" }),
  ],
  firstRevenueAt: new Map([
    ["c:7", wibDate(2026, 9, 1, 10)], // pembeli lama
    ["c:8", o2.paidAt!],
  ]),
  flashSlots: [{ id: 50, name: "Flash Sale Malam", startsAt: wibDate(2026, 10, 13, 20), endsAt: wibDate(2026, 10, 13, 22), source: "otomatis", items: [{ id: 501, quota: 20, sold: 2 }] }],
  vouchers: [{ code: "HEMAT", title: "Hemat 20 ribu", quota: 100, used: 31 }],
};

describe("periode WIB", () => {
  it("preset dan batasnya", () => {
    expect(period).toMatchObject({ firstDay: "2026-10-08", lastDay: "2026-10-14", days: 7 });
    expect(resolvePeriod("hari_ini", NOW)).toMatchObject({ firstDay: "2026-10-14", lastDay: "2026-10-14", days: 1 });
    expect(resolvePeriod("30_hari", NOW)).toMatchObject({ firstDay: "2026-09-15", lastDay: "2026-10-14", days: 30 });
    expect(resolvePeriod("bulan_ini", NOW)).toMatchObject({ firstDay: "2026-10-01", lastDay: "2026-10-14" });
    expect(resolvePeriod("bulan_lalu", NOW)).toMatchObject({ firstDay: "2026-09-01", lastDay: "2026-09-30", days: 30 });
    expect(resolvePeriod("bulan_lalu", wibDate(2027, 1, 5))).toMatchObject({ firstDay: "2026-12-01", lastDay: "2026-12-31" });
    expect(period.from.toISOString()).toBe("2026-10-07T17:00:00.000Z");
  });
  it("kustom maksimal 366 hari, tanggal terbalik ditolak", () => {
    expect(resolvePeriod("kustom", NOW, { from: "2026-01-01", to: "2026-03-31" })).toMatchObject({ preset: "kustom", days: 90, lastDay: "2026-03-31" });
    expect(resolvePeriod("kustom", NOW, { from: "2025-01-01", to: "2026-01-02" }).error).toMatch(/366/);
    expect(resolvePeriod("kustom", NOW, { from: "2026-02-01", to: "2026-01-01" }).error).toMatch(/setelah/);
    expect(resolvePeriod("kustom", NOW, { from: "2025-10-14", to: "2026-10-14" })).toMatchObject({ days: 366 });
  });
  it("periode pembanding dan persen perubahan", () => {
    const prev = previousRange(period);
    expect(prev.to).toEqual(period.from);
    expect(prev.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(75, 100)).toBe(-25);
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe("agregasi laporan", () => {
  const r = buildReport(data);
  it("ringkasan: omzet per tanggal bayar, tanpa batal dan retur", () => {
    expect(r.summary).toMatchObject({
      revenue: 110_000 + 250_000 + 60_000,
      orders: 3,
      averageOrder: 140_000,
      itemsSold: 1 + 3 + 1,
      productDiscount: 20_000,
      voucherDiscount: 20_000,
      pointsUsed: 5_000,
      shippingCharged: 25_000,
      created: 5, // o1 sampai o5 dibuat dalam periode; o6 dibuat sebelumnya
      cancelled: 2,
      cancelRate: 40,
      paid: 5, // o1, o2, o3, o4, o6
      returned: 1,
      returnRate: 20,
    });
  });
  it("harian: satu baris per hari WIB, 23.59 dan 00.30 jatuh di hari berbeda", () => {
    expect(r.daily).toHaveLength(7);
    expect(r.daily.find((d) => d.day === "2026-10-13")).toEqual({ day: "2026-10-13", revenue: 250_000, orders: 1 });
    expect(r.daily.find((d) => d.day === "2026-10-14")).toEqual({ day: "2026-10-14", revenue: 110_000, orders: 1 });
    expect(r.daily.find((d) => d.day === "2026-10-08")).toEqual({ day: "2026-10-08", revenue: 60_000, orders: 1 });
    expect(r.daily.reduce((s, d) => s + d.revenue, 0)).toBe(r.summary.revenue);
  });
  it("per merek, kategori, cabang, dan kanal", () => {
    expect(r.brands).toEqual([
      { key: "2", label: "Pualam", orders: 2, quantity: 3, sales: 220_000 },
      { key: "1", label: "Lumi", orders: 2, quantity: 2, sales: 200_000 },
    ]);
    expect(r.categories.map((c) => c.label)).toContain("Bibir, Lipstik");
    expect(r.locations).toEqual([
      { key: "2", label: "Rona Dinoyo", orders: 1, revenue: 250_000, share: 59.5 },
      { key: "1", label: "Gudang Online", orders: 2, revenue: 170_000, share: 40.5 },
    ]);
    expect(r.channels.method.map((m) => [m.label, m.orders])).toEqual([
      ["Ambil di Toko", 1],
      ["Kirim", 2],
    ]);
    expect(r.channels.payment.find((p) => p.key === "bayar_di_toko")?.label).toBe("Bayar di Toko");
    expect(r.channels.courier.find((c) => c.key === "ambil_di_toko")?.orders).toBe(1);
  });
  it("produk dan varian terlaris, voucher, flash sale", () => {
    expect(r.products[0]).toMatchObject({ productId: 20, quantity: 3, sales: 220_000 });
    expect(r.variants[0]).toMatchObject({ sku: "LUMI-001-01", quantity: 2, sales: 200_000 });
    expect(r.variants[1]).toMatchObject({ sku: "PUAL-002-01", quantity: 2, sales: 160_000 });
    expect(r.vouchers).toEqual([{ code: "HEMAT", title: "Hemat 20 ribu", orders: 2, revenue: 360_000, discount: 20_000, quota: 100, used: 31 }]);
    expect(r.flash).toEqual([expect.objectContaining({ id: 50, quantity: 2, sales: 160_000, discount: 40_000, quota: 20, sold: 2 })]);
  });
  it("pembeli baru dibanding kembali", () => {
    // c:7 sudah membeli sejak September (kembali, 2 pesanan); c:8 pertama kali di periode ini (baru).
    expect(r.customers).toEqual({ newBuyers: 1, returningBuyers: 1, newRevenue: 250_000, returningRevenue: 170_000, newOrders: 1, returningOrders: 2 });
  });
  it("bentuk lama dashboard (30 hari) sama dengan seri harian laporan", () => {
    const d = dailyRevenue(data.orders, NOW, 30);
    const r30 = buildReport({ ...data, range: resolvePeriod("30_hari", NOW) });
    expect(d.series).toEqual(r30.daily);
    expect(d.total).toBe(r30.summary.revenue);
    expect(d.paidOrders).toBe(r30.summary.orders);
    expect(d.today).toBe(110_000);
  });
});

describe("Excel laporan", () => {
  const report = buildReport(data);
  const meta = { periodLabel: "8 Okt 2026 sampai 14 Okt 2026", locationLabel: "Semua cabang", printedBy: "Owner Demo", printedAt: NOW, finance: true };
  const readBack = async (finance: boolean) => {
    const wb = await buildReportWorkbook(report, data, { ...meta, finance });
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    return back;
  };
  const col = (ws: ExcelJS.Worksheet, header: string) => {
    const row = ws.getRow(4);
    for (let i = 1; i <= ws.columnCount; i++) if (row.getCell(i).value === header) return i;
    throw new Error(`kolom ${header} tidak ada`);
  };

  it("nama sheet sesuai urutan dan nama file", async () => {
    const wb = await readBack(true);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...REPORT_SHEETS]);
    expect(reportFileName(period.firstDay, period.lastDay)).toBe("laporan-rona-20261008-20261014.xlsx");
  });
  it("judul, header beku, autofilter", async () => {
    const ws = (await readBack(true)).getWorksheet("Detail Pesanan")!;
    expect(String(ws.getCell("A1").value)).toContain("Laporan Rona Beauty");
    expect(String(ws.getCell("A2").value)).toContain("Dicetak oleh Owner Demo");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
    expect(ws.autoFilter).toBeTruthy();
  });
  it("rupiah berupa angka berformat, tanggal berupa tanggal Excel dalam WIB", async () => {
    const ws = (await readBack(true)).getWorksheet("Detail Pesanan")!;
    const row = ws.getRow(5); // pesanan pertama: o1, dibayar 14 Okt 00.30 WIB
    const total = row.getCell(col(ws, "Total"));
    expect(typeof total.value).toBe("number");
    expect(total.value).toBe(110_000);
    expect(total.numFmt).toBe(MONEY_FORMAT);
    const paid = row.getCell(col(ws, "Dibayar")).value as Date;
    expect(paid).toBeInstanceOf(Date);
    expect([paid.getUTCDate(), paid.getUTCHours(), paid.getUTCMinutes()]).toEqual([14, 0, 30]);
  });
  it("total di Excel sama dengan fungsi laporan", async () => {
    const wb = await readBack(true);
    const ringkasan = wb.getWorksheet("Ringkasan")!;
    const value = (label: string) => {
      for (let r = 5; r <= ringkasan.rowCount; r++) if (ringkasan.getRow(r).getCell(1).value === label) return ringkasan.getRow(r);
      throw new Error(label);
    };
    expect(value("Omzet").getCell(2).value).toBe(report.summary.revenue);
    expect(value("Pesanan dalam omzet").getCell(3).value).toBe(report.summary.orders);
    const harian = wb.getWorksheet("Harian")!;
    const last = harian.getRow(harian.rowCount);
    expect(last.getCell(1).value).toBe("Total");
    expect(last.getCell(3).value).toBe(report.summary.revenue);
    const merek = wb.getWorksheet("Per Merek")!;
    expect(merek.getRow(merek.rowCount).getCell(4).value).toBe(report.brands.reduce((s, b) => s + b.sales, 0));
    const detail = wb.getWorksheet("Detail Pesanan")!;
    let sum = 0;
    for (let r = 5; r <= detail.rowCount; r++) if (detail.getRow(r).getCell(col(detail, "Dalam omzet")).value === "Ya") sum += Number(detail.getRow(r).getCell(col(detail, "Total")).value);
    expect(sum).toBe(report.summary.revenue);
  });
  it("tanpa izin keuangan kolom rupiah tidak ikut", async () => {
    const wb = await readBack(false);
    const detail = wb.getWorksheet("Detail Pesanan")!;
    const headers = (detail.getRow(4).values as unknown[]).filter(Boolean);
    expect(headers).not.toContain("Total");
    expect(headers).toContain("Nomor");
    expect(String(detail.getCell("A3").value)).toMatch(/tidak ditampilkan/);
  });
});

describe("rekonsiliasi omzet", () => {
  it("penjualan barang - voucher belanja - poin + ongkir dibayar = omzet; voucher gratis ongkir tidak terhitung dua kali", () => {
    // Pesanan dengan voucher gratis ongkir: tarif 20 ribu, gratis ongkir otomatis 0, voucher ongkir 15 ribu.
    const ship = order({ paidAt: wibDate(2026, 10, 12, 10), subtotal: 120_000, shippingCost: 20_000, shippingDiscount: 15_000, voucherShippingDiscount: 15_000, voucherCode: "ONGKIR", total: 125_000 });
    const d: ReportData = { ...data, orders: [...data.orders, ship], items: [...data.items, item(ship.id, { quantity: 1, unitPrice: 120_000 })] };
    const rc = buildReport(d).reconciliation;
    expect(rc.balanced).toBe(true);
    expect(rc.computed).toBe(rc.revenue);
    expect(rc.voucherShipping).toBe(15_000);
    expect(rc.voucherDiscount).toBe(20_000); // hanya voucher belanja (o2), voucher ongkir tidak ikut
    expect(rc.itemSales - rc.voucherDiscount - rc.pointsUsed + rc.shippingCost - rc.autoFreeShipping - rc.voucherShipping).toBe(rc.revenue);
  });
  it("selisih terdeteksi bila total pesanan tidak cocok dengan rinciannya", () => {
    const bad = order({ paidAt: wibDate(2026, 10, 12, 10), subtotal: 50_000, total: 51_000 });
    const d: ReportData = { ...data, orders: [...data.orders, bad], items: [...data.items, item(bad.id, { unitPrice: 50_000 })] };
    expect(buildReport(d).reconciliation.balanced).toBe(false);
  });
});
