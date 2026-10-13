// Data Dashboard admin. Omzet = total pesanan yang sudah mencapai Dibayar, dikurangi yang kemudian Dibatalkan atau
// Diretur, dikelompokkan per tanggal bayar dalam WIB. Staf yang mengampu lokasi tertentu hanya melihat lokasinya.
import { and, count, desc, eq, gte, inArray, isNotNull, lt, lte, notInArray, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { toWibParts, wibDate } from "@/lib/format";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import type { OrderStatus } from "@/lib/orders/status";
import { lowStockThreshold } from "./stock";
import { allLocations, can, type StaffPrincipal } from "./permissions";

const DAY = 24 * 60 * 60_000;
export const REVENUE_EXCLUDED: OrderStatus[] = ["dibatalkan", "diretur"];

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

export type RevenueOrder = { total: number; paidAt: Date | null; status: string };

// Seri omzet harian N hari terakhir (termasuk hari ini, WIB), murni supaya bisa diuji.
export function dailyRevenue(orders: RevenueOrder[], now: Date, days = 30) {
  const keys = Array.from({ length: days }, (_, i) => wibDayKey(wibDayStart(now, days - 1 - i)));
  const sums = new Map(keys.map((k) => [k, { revenue: 0, orders: 0 }]));
  for (const o of orders) {
    if (!o.paidAt || REVENUE_EXCLUDED.includes(o.status as OrderStatus)) continue;
    const bucket = sums.get(wibDayKey(o.paidAt));
    if (!bucket) continue;
    bucket.revenue += o.total;
    bucket.orders += 1;
  }
  const series = keys.map((k) => ({ day: k, ...sums.get(k)! }));
  const today = series[series.length - 1];
  const total = series.reduce((s, d) => s + d.revenue, 0);
  const paidOrders = series.reduce((s, d) => s + d.orders, 0);
  return { series, today: today.revenue, todayOrders: today.orders, total, paidOrders, averageOrder: paidOrders ? Math.round(total / paidOrders) : 0 };
}

export type ActionItem = { kind: "belum_diproses" | "bayar_di_toko" | "siap_lama" | "kabari_aku"; title: string; detail: string; href: string; at: Date | null };

export async function dashboardData(db: AnyDb, staff: StaffPrincipal, now: Date) {
  const scope: SQL | undefined = allLocations(staff) ? undefined : inArray(schema.orders.locationId, staff.locationIds.length ? staff.locationIds : [-1]);
  const finance = can(staff, "laporan.keuangan");
  const since30 = wibDayStart(now, 29);
  const [paid, statusCounts, recent] = await Promise.all([
    db
      .select({ total: schema.orders.total, paidAt: schema.orders.paidAt, status: schema.orders.status })
      .from(schema.orders)
      .where(and(scope, isNotNull(schema.orders.paidAt), gte(schema.orders.paidAt, since30))),
    db.select({ status: schema.orders.status, n: count() }).from(schema.orders).where(scope).groupBy(schema.orders.status),
    db
      .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, method: schema.orders.method, total: schema.orders.total, name: schema.orders.guestName, createdAt: schema.orders.createdAt, locationName: schema.locations.name })
      .from(schema.orders)
      .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
      .where(scope)
      .orderBy(desc(schema.orders.createdAt))
      .limit(6),
  ]);
  const revenue = dailyRevenue(paid, now, 30);

  // Produk terlaris 30 hari (pesanan yang sudah dibayar dan tidak batal atau retur).
  const best = await db
    .select({ productId: schema.products.id, name: schema.products.name, slug: schema.products.slug, packaging: schema.products.packaging, brandColor: schema.brands.color, brandName: schema.brands.name, hex: sql<string>`min(${schema.variants.hex})`, qty: sql<number>`sum(${schema.orderItems.quantity})::int` })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(and(scope, isNotNull(schema.orders.paidAt), gte(schema.orders.paidAt, since30), notInArray(schema.orders.status, REVENUE_EXCLUDED)))
    .groupBy(schema.products.id, schema.products.name, schema.products.slug, schema.products.packaging, schema.brands.color, schema.brands.name)
    .orderBy(desc(sql`sum(${schema.orderItems.quantity})`))
    .limit(5);

  // Stok menipis dan habis per cabang (lokasi yang diampu).
  const threshold = await lowStockThreshold(db);
  const locs = (await db.select({ id: schema.locations.id, name: schema.locations.name, slug: schema.locations.slug }).from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(schema.locations.sortOrder)).filter((l) => allLocations(staff) || staff.locationIds.includes(l.id));
  const lowRows = locs.length
    ? await db
        .select({ locationId: schema.inventory.locationId, variantId: schema.inventory.variantId, available: sql<number>`(${schema.inventory.onHand} - ${schema.inventory.reserved})::int`, productName: schema.products.name, shadeName: schema.variants.shadeName })
        .from(schema.inventory)
        .innerJoin(schema.variants, eq(schema.inventory.variantId, schema.variants.id))
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .where(and(inArray(schema.inventory.locationId, locs.map((l) => l.id)), lte(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`, threshold), eq(schema.variants.isActive, true)))
        .orderBy(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`, schema.products.name)
    : [];
  const lowStock = locs.map((l) => {
    const rows = lowRows.filter((r) => r.locationId === l.id);
    return { location: l, out: rows.filter((r) => r.available <= 0).length, low: rows.filter((r) => r.available > 0).length, items: rows.filter((r) => r.available > 0).slice(0, 4) };
  });

  // Perlu tindakan.
  const actions: ActionItem[] = [];
  if (can(staff, "pesanan.lihat")) {
    const stale = await db
      .select({ number: schema.orders.number, paidAt: schema.orders.paidAt, method: schema.orders.method, name: schema.orders.guestName })
      .from(schema.orders)
      .where(and(scope, eq(schema.orders.status, "dibayar"), lt(schema.orders.paidAt, new Date(now.getTime() - 2 * 60 * 60_000))))
      .orderBy(schema.orders.paidAt)
      .limit(10);
    for (const o of stale) actions.push({ kind: "belum_diproses", title: `${o.number} belum diproses`, detail: `Dibayar lebih dari 2 jam lalu${o.method === "ambil" ? ", ambil di toko" : ""}`, href: `/admin/pesanan/${o.number}`, at: o.paidAt });
    const endOfToday = wibDayStart(new Date(now.getTime() + DAY));
    const store = await db
      .select({ number: schema.orders.number, expiresAt: schema.orders.expiresAt, name: schema.orders.guestName })
      .from(schema.orders)
      .innerJoin(schema.payments, eq(schema.payments.orderId, schema.orders.id))
      .where(and(scope, eq(schema.orders.status, "menunggu_pembayaran"), eq(schema.payments.method, "bayar_di_toko"), gte(schema.orders.expiresAt, now), lt(schema.orders.expiresAt, endOfToday)))
      .limit(10);
    for (const o of store) actions.push({ kind: "bayar_di_toko", title: `${o.number} Bayar di Toko kedaluwarsa hari ini`, detail: `Atas nama ${o.name ?? "pembeli"}`, href: `/admin/pesanan/${o.number}`, at: o.expiresAt });
    const ready = await db
      .select({ number: schema.orders.number, at: sql<Date>`max(${schema.orderStatusHistory.createdAt})` })
      .from(schema.orders)
      .innerJoin(schema.orderStatusHistory, and(eq(schema.orderStatusHistory.orderId, schema.orders.id), eq(schema.orderStatusHistory.toStatus, "siap_diambil")))
      .where(and(scope, eq(schema.orders.status, "siap_diambil")))
      .groupBy(schema.orders.number)
      .having(sql`max(${schema.orderStatusHistory.createdAt}) < ${new Date(now.getTime() - 3 * DAY).toISOString()}::timestamptz`)
      .limit(10);
    for (const o of ready) actions.push({ kind: "siap_lama", title: `${o.number} siap diambil lebih dari 3 hari`, detail: "Hubungi pembeli untuk mengingatkan", href: `/admin/pesanan/${o.number}`, at: new Date(o.at) });
  }
  if (can(staff, "stok.lihat")) {
    const [online] = await db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.slug, ONLINE_WAREHOUSE_SLUG)).limit(1);
    if (online && (allLocations(staff) || staff.locationIds.includes(online.id))) {
      const waiting = await db
        .select({ variantId: schema.variants.id, productName: schema.products.name, shadeName: schema.variants.shadeName, n: count() })
        .from(schema.restockRequests)
        .innerJoin(schema.variants, eq(schema.restockRequests.variantId, schema.variants.id))
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .innerJoin(schema.inventory, and(eq(schema.inventory.variantId, schema.variants.id), eq(schema.inventory.locationId, online.id)))
        .where(and(eq(schema.restockRequests.status, "menunggu"), lte(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`, 0)))
        .groupBy(schema.variants.id, schema.products.name, schema.variants.shadeName)
        .limit(10);
      for (const w of waiting) actions.push({ kind: "kabari_aku", title: `${w.productName} (${w.shadeName}) habis`, detail: `${w.n} peminat menunggu kabar stok`, href: `/admin/stok/${w.variantId}`, at: null });
    }
  }

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.n)])) as Partial<Record<OrderStatus, number>>;
  return {
    finance,
    revenue: finance ? revenue : null,
    paidOrders30: revenue.paidOrders,
    counts,
    best: best.map((b) => ({ ...b, qty: Number(b.qty) })),
    lowStock,
    threshold,
    actions,
    recent: recent.map((r) => ({ ...r, total: finance ? r.total : null })),
    generatedAt: now.toISOString(),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
