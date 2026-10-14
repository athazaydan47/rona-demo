// Unduhan Excel multi-sheet dari fungsi laporan yang sama dengan layar. Rupiah ditulis sebagai angka berformat,
// tanggal sebagai tanggal Excel sungguhan dalam WIB. Tanpa izin laporan.keuangan, kolom rupiah tidak ikut.
// Data pembeli (nama, nomor, email) sengaja tidak diekspor.
import ExcelJS from "exceljs";
import { formatDateTimeWib, formatDateWib, toWibParts } from "@/lib/format";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { isRevenueOrder, type Report, type ReportData } from "./index";

export const REPORT_SHEETS = ["Ringkasan", "Harian", "Per Merek", "Per Kategori", "Per Cabang", "Per Kanal", "Produk", "Voucher", "Detail Pesanan", "Detail Item"] as const;
export const MONEY_FORMAT = '"Rp "#,##0';
const DATE_FORMAT = "dd/mm/yyyy";
const DATETIME_FORMAT = "dd/mm/yyyy hh:mm";
const HEADER_ROW = 4;

export type ExcelMeta = { periodLabel: string; locationLabel: string; printedBy: string; printedAt: Date; finance: boolean };

// Excel tidak punya zona waktu: tanggal ditulis dengan jam dinding WIB.
export function excelWibDate(d: Date) {
  const p = toWibParts(d);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, d.getUTCSeconds()));
}
const dayDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

type Col = { header: string; width: number; kind?: "money" | "date" | "datetime" | "percent" | "int" | "text"; money?: boolean };

function sheet(wb: ExcelJS.Workbook, name: string, meta: ExcelMeta, columns: Col[], rows: unknown[][], totals?: unknown[]) {
  const cols = columns.filter((c) => meta.finance || !c.money);
  const keep = columns.map((c) => meta.finance || !c.money);
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: HEADER_ROW }] });
  ws.getCell("A1").value = `Laporan Rona Beauty: ${name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Periode ${meta.periodLabel} · Cabang: ${meta.locationLabel} · Dicetak oleh ${meta.printedBy} · ${formatDateTimeWib(meta.printedAt)}`;
  ws.getCell("A2").font = { color: { argb: "FF6B5E5A" } };
  if (!meta.finance) ws.getCell("A3").value = "Angka rupiah tidak ditampilkan karena akun ini tidak punya izin laporan keuangan.";
  const header = ws.getRow(HEADER_ROW);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2A1F1D" } };
    cell.alignment = { vertical: "middle" };
    ws.getColumn(i + 1).width = c.width;
  });
  const write = (values: unknown[], rowNo: number, bold = false) => {
    const row = ws.getRow(rowNo);
    let j = 0;
    values.forEach((v, i) => {
      if (!keep[i]) return;
      const c = columns[i];
      const cell = row.getCell(++j);
      cell.value = v as ExcelJS.CellValue;
      if (c.kind === "money") cell.numFmt = MONEY_FORMAT;
      else if (c.kind === "date") cell.numFmt = DATE_FORMAT;
      else if (c.kind === "datetime") cell.numFmt = DATETIME_FORMAT;
      else if (c.kind === "percent") cell.numFmt = '0.0"%"';
      else if (c.kind === "int") cell.numFmt = "#,##0";
      if (bold) cell.font = { bold: true };
    });
  };
  rows.forEach((r, i) => write(r, HEADER_ROW + 1 + i));
  const last = HEADER_ROW + Math.max(rows.length, 1);
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: last, column: cols.length } };
  if (totals) write(totals, last + 1, true);
  return ws;
}

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

export async function buildReportWorkbook(report: Report, data: ReportData, meta: ExcelMeta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rona Beauty (demo)";
  wb.created = meta.printedAt;
  const s = report.summary;
  const rc = report.reconciliation;

  sheet(
    wb,
    "Ringkasan",
    meta,
    [
      { header: "Ukuran", width: 34 },
      { header: "Nilai", width: 18, kind: "money", money: true },
      { header: "Jumlah", width: 14, kind: "int" },
    ],
    [
      ["Omzet", s.revenue, null],
      ["Pesanan dalam omzet", null, s.orders],
      ["Rata-rata nilai pesanan", s.averageOrder, null],
      ["Barang terjual (unit)", null, s.itemsSold],
      ["Diskon produk", s.productDiscount, null],
      ["Potongan voucher", s.voucherDiscount, null],
      ["Poin dipakai (Rp)", s.pointsUsed, null],
      ["Ongkir dibayar pembeli", s.shippingCharged, null],
      ["Potongan ongkir", s.shippingDiscount, null],
      ["Pesanan dibuat", null, s.created],
      ["Pesanan dibatalkan", null, s.cancelled],
      ["Tingkat pembatalan (%)", null, s.cancelRate],
      ["Pesanan dibayar", null, s.paid],
      ["Pesanan diretur", null, s.returned],
      ["Tingkat retur (%)", null, s.returnRate],
      ["Pembeli baru", null, report.customers.newBuyers],
      ["Pembeli kembali", null, report.customers.returningBuyers],
      [null, null, null],
      ["Rekonsiliasi: penjualan barang", rc.itemSales, null],
      ["Dikurangi potongan voucher belanja", -rc.voucherDiscount, null],
      ["Dikurangi poin dipakai", -rc.pointsUsed, null],
      ["Ditambah tarif ongkir", rc.shippingCost, null],
      ["Dikurangi gratis ongkir otomatis", -rc.autoFreeShipping, null],
      ["Dikurangi voucher gratis ongkir", -rc.voucherShipping, null],
      ["Sama dengan omzet", rc.computed, null],
    ],
  );

  sheet(
    wb,
    "Harian",
    meta,
    [
      { header: "Tanggal", width: 14, kind: "date" },
      { header: "Pesanan", width: 12, kind: "int" },
      { header: "Omzet", width: 18, kind: "money", money: true },
    ],
    report.daily.map((d) => [dayDate(d.day), d.orders, d.revenue]),
    ["Total", sum(report.daily, (d) => d.orders), sum(report.daily, (d) => d.revenue)],
  );

  const breakdownCols = (first: string): Col[] => [
    { header: first, width: 34 },
    { header: "Pesanan", width: 12, kind: "int" },
    { header: "Unit", width: 10, kind: "int" },
    { header: "Penjualan barang", width: 20, kind: "money", money: true },
  ];
  sheet(wb, "Per Merek", meta, breakdownCols("Merek"), report.brands.map((r) => [r.label, r.orders, r.quantity, r.sales]), ["Total", null, sum(report.brands, (r) => r.quantity), sum(report.brands, (r) => r.sales)]);
  sheet(wb, "Per Kategori", meta, breakdownCols("Kategori"), report.categories.map((r) => [r.label, r.orders, r.quantity, r.sales]), ["Total", null, sum(report.categories, (r) => r.quantity), sum(report.categories, (r) => r.sales)]);

  const groupCols = (first: string): Col[] => [
    { header: first, width: 26 },
    { header: "Pesanan", width: 12, kind: "int" },
    { header: "Omzet", width: 18, kind: "money", money: true },
    { header: "Porsi omzet", width: 14, kind: "percent", money: true },
  ];
  sheet(wb, "Per Cabang", meta, groupCols("Cabang asal"), report.locations.map((r) => [r.label, r.orders, r.revenue, r.share]), ["Total", sum(report.locations, (r) => r.orders), sum(report.locations, (r) => r.revenue), null]);
  const ch = report.channels;
  sheet(
    wb,
    "Per Kanal",
    meta,
    [{ header: "Kelompok", width: 18 }, ...groupCols("Kanal")],
    [...ch.method.map((r) => ["Metode", r.label, r.orders, r.revenue, r.share]), ...ch.payment.map((r) => ["Pembayaran", r.label, r.orders, r.revenue, r.share]), ...ch.courier.map((r) => ["Kurir", r.label, r.orders, r.revenue, r.share])],
  );

  sheet(
    wb,
    "Produk",
    meta,
    [
      { header: "SKU", width: 18 },
      { header: "Produk", width: 34 },
      { header: "Shade", width: 18 },
      { header: "Pesanan", width: 10, kind: "int" },
      { header: "Unit", width: 10, kind: "int" },
      { header: "Penjualan barang", width: 20, kind: "money", money: true },
    ],
    report.variants.map((r) => [r.sku, r.productName, r.shadeName, r.orders, r.quantity, r.sales]),
    ["Total", null, null, null, sum(report.variants, (r) => r.quantity), sum(report.variants, (r) => r.sales)],
  );

  sheet(
    wb,
    "Voucher",
    meta,
    [
      { header: "Kode", width: 16 },
      { header: "Judul", width: 28 },
      { header: "Pesanan", width: 10, kind: "int" },
      { header: "Omzet", width: 18, kind: "money", money: true },
      { header: "Potongan voucher", width: 18, kind: "money", money: true },
      { header: "Kuota", width: 10, kind: "int" },
      { header: "Terpakai (total)", width: 16, kind: "int" },
    ],
    report.vouchers.map((v) => [v.code, v.title, v.orders, v.revenue, v.discount, v.quota, v.used]),
    ["Total", null, sum(report.vouchers, (v) => v.orders), sum(report.vouchers, (v) => v.revenue), sum(report.vouchers, (v) => v.discount), null, null],
  );

  sheet(
    wb,
    "Detail Pesanan",
    meta,
    [
      { header: "Nomor", width: 20 },
      { header: "Dibuat", width: 17, kind: "datetime" },
      { header: "Dibayar", width: 17, kind: "datetime" },
      { header: "Status", width: 18 },
      { header: "Dalam omzet", width: 13 },
      { header: "Metode", width: 14 },
      { header: "Cabang asal", width: 24 },
      { header: "Pembayaran", width: 14 },
      { header: "Kurir", width: 14 },
      { header: "Pembeli", width: 12 },
      { header: "Subtotal", width: 15, kind: "money", money: true },
      { header: "Diskon produk", width: 15, kind: "money", money: true },
      { header: "Voucher", width: 14, kind: "money", money: true },
      { header: "Kode voucher", width: 14 },
      { header: "Ongkir", width: 13, kind: "money", money: true },
      { header: "Potongan ongkir", width: 15, kind: "money", money: true },
      { header: "Poin dipakai", width: 13, kind: "money", money: true },
      { header: "Total", width: 15, kind: "money", money: true },
    ],
    data.orders.map((o) => [
      o.number,
      excelWibDate(o.createdAt),
      o.paidAt ? excelWibDate(o.paidAt) : null,
      statusLabels[o.status as OrderStatus] ?? o.status,
      isRevenueOrder(o) && o.paidAt && o.paidAt >= data.range.from && o.paidAt < data.range.to ? "Ya" : "Tidak",
      o.method === "kirim" ? "Kirim" : "Ambil di Toko",
      o.locationName,
      o.paymentMethod ?? "",
      o.method === "kirim" ? (o.courier ?? "") : "",
      o.customerId != null ? "Terdaftar" : "Tamu",
      o.subtotal,
      o.productDiscount,
      o.voucherDiscount,
      o.voucherCode ?? "",
      o.shippingCost,
      o.shippingDiscount,
      o.pointsUsed,
      o.total,
    ]),
  );

  const statusOf = new Map(data.orders.map((o) => [o.id, o]));
  sheet(
    wb,
    "Detail Item",
    meta,
    [
      { header: "Nomor", width: 20 },
      { header: "Dibayar", width: 17, kind: "datetime" },
      { header: "Status", width: 18 },
      { header: "SKU", width: 18 },
      { header: "Produk", width: 32 },
      { header: "Shade", width: 18 },
      { header: "Merek", width: 16 },
      { header: "Kategori", width: 26 },
      { header: "Sumber harga", width: 13 },
      { header: "Unit", width: 8, kind: "int" },
      { header: "Harga satuan", width: 15, kind: "money", money: true },
      { header: "Harga normal", width: 15, kind: "money", money: true },
      { header: "Penjualan barang", width: 17, kind: "money", money: true },
    ],
    data.items.map((i) => {
      const o = statusOf.get(i.orderId)!;
      return [o.number, o.paidAt ? excelWibDate(o.paidAt) : null, statusLabels[o.status as OrderStatus] ?? o.status, i.sku, i.productName, i.shadeName, i.brandName, i.parentCategoryName ? `${i.parentCategoryName}, ${i.categoryName}` : i.categoryName, i.priceSource, i.quantity, i.unitPrice, i.normalPrice, i.unitPrice * i.quantity];
    }),
  );

  return wb;
}

// Nama file laporan-rona-YYYYMMDD-YYYYMMDD.xlsx dari hari pertama dan terakhir (inklusif, WIB).
export function reportFileName(firstDay: string, lastDay: string) {
  return `laporan-rona-${firstDay.replace(/-/g, "")}-${lastDay.replace(/-/g, "")}.xlsx`;
}

export const periodLabel = (from: Date, to: Date) => `${formatDateWib(from)} sampai ${formatDateWib(new Date(to.getTime() - 1))}`;
