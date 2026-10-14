// Data Dashboard admin. Omzet = total pesanan yang sudah mencapai Dibayar, dikurangi yang kemudian Dibatalkan atau
// Diretur, dikelompokkan per tanggal bayar dalam WIB. Staf yang mengampu lokasi tertentu hanya melihat lokasinya.
import { and, count, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import type { OrderStatus } from "@/lib/orders/status";
import { dailyRevenue, topProducts, wibDayStart } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";
import { lowRatingUnreplied } from "./reviews";
import { lowStockThreshold } from "./stock";
import { allLocations, can, type StaffPrincipal } from "./permissions";

const DAY = 24 * 60 * 60_000;
// Agregasi omzet dan produk terlaris ada di src/lib/reports (satu sumber angka dengan halaman Laporan dan Excel).
export { REVENUE_EXCLUDED, dailyRevenue, wibDayKey, wibDayStart } from "@/lib/reports";

export type ActionItem = { kind: "belum_diproses" | "bayar_di_toko" | "siap_lama" | "kabari_aku" | "ulasan_rendah"; title: string; detail: string; href: string; at: Date | null };

export async function dashboardData(db: AnyDb, staff: StaffPrincipal, now: Date) {
  const scope: SQL | undefined = allLocations(staff) ? undefined : inArray(schema.orders.locationId, staff.locationIds.length ? staff.locationIds : [-1]);
  const finance = can(staff, "laporan.keuangan");
  const range30 = { from: wibDayStart(now, 29), to: wibDayStart(now, -1) };
  const [report, statusCounts, recent] = await Promise.all([
    loadReportData(db, range30, { locationIds: allLocations(staff) ? null : staff.locationIds }),
    db.select({ status: schema.orders.status, n: count() }).from(schema.orders).where(scope).groupBy(schema.orders.status),
    db
      .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, method: schema.orders.method, total: schema.orders.total, name: schema.orders.guestName, createdAt: schema.orders.createdAt, locationName: schema.locations.name })
      .from(schema.orders)
      .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
      .where(scope)
      .orderBy(desc(schema.orders.createdAt))
      .limit(6),
  ]);
  const revenue = dailyRevenue(report.orders, now, 30);

  // Produk terlaris 30 hari (pesanan yang sudah dibayar dan tidak batal atau retur), urut unit terjual.
  const best = topProducts(report, "quantity")
    .slice(0, 5)
    .map((p) => ({ productId: p.productId, name: p.label, slug: p.slug, packaging: p.packaging, brandColor: p.brandColor, brandName: p.brandName, hex: p.hex, qty: p.quantity }));

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
  // 5 teratas paling kritis (tersedia paling sedikit, habis dulu) lintas lokasi yang diampu, plus jumlah totalnya.
  // Hanya varian yang memang dijual di lokasi itu yang punya baris inventory, jadi "tidak dijual" tidak ikut dihitung.
  const locName = new Map(locs.map((l) => [l.id, l.name]));
  const critical = [...lowRows]
    .sort((a, b) => a.available - b.available || a.productName.localeCompare(b.productName, "id"))
    .slice(0, 5)
    .map((r) => ({ variantId: r.variantId, productName: r.productName, shadeName: r.shadeName, locationName: locName.get(r.locationId) ?? "", available: Math.max(0, r.available) }));
  const lowTotals = { out: lowRows.filter((r) => r.available <= 0).length, low: lowRows.filter((r) => r.available > 0).length };

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

  if (can(staff, "ulasan.kelola")) {
    for (const r of await lowRatingUnreplied(db, 5)) actions.push({ kind: "ulasan_rendah", title: `Ulasan ${r.rating} bintang belum dibalas`, detail: `${r.authorName} untuk ${r.productName}`, href: `/admin/ulasan?belum=1&bintang=${r.rating}`, at: r.createdAt });
  }

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.n)])) as Partial<Record<OrderStatus, number>>;
  return {
    finance,
    revenue: finance ? revenue : null,
    paidOrders30: revenue.paidOrders,
    counts,
    best,
    lowStock,
    critical,
    lowTotals,
    threshold,
    actions,
    recent: recent.map((r) => ({ ...r, total: finance ? r.total : null })),
    generatedAt: now.toISOString(),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
