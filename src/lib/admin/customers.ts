// Pelanggan di panel admin: segmen, daftar, detail, penyesuaian poin manual, dan penyamaran kontak.
// Segmen (BRIEF, Fase 6C), dihitung dengan jam aplikasi supaya bisa diuji:
//   Tidak aktif: tidak ada pesanan (status apa pun) dalam 90 hari terakhir. Menang atas Setia.
//   Setia: minimal 3 pesanan Selesai yang dipesan dalam 180 hari terakhir.
//   Baru: total baru punya 1 pesanan Selesai, dan pesanan itu dipesan dalam 30 hari terakhir.
//   Lainnya: sisanya.
import { randomUUID } from "node:crypto";
import { asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { movePoints, netSpend } from "@/lib/points";
import { REVENUE_EXCLUDED } from "@/lib/reports";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";

const DAY = 86_400_000;
export const SEGMENT_DAYS = { baru: 30, setia: 180, tidakAktif: 90 } as const;
export const SEGMENT_MIN_SETIA = 3;
export const CUSTOMER_PAGE_SIZE = 20;
export const MAX_POINT_ADJUST = 100_000;

export type Segment = "baru" | "setia" | "tidak_aktif" | "lainnya";
export const SEGMENT_LABELS: Record<Segment, string> = { baru: "Baru", setia: "Setia", tidak_aktif: "Tidak aktif", lainnya: "Lainnya" };
export const SEGMENT_TONE: Record<Segment, "sukses" | "baru" | "netral" | "menipis"> = { setia: "sukses", baru: "baru", lainnya: "netral", tidak_aktif: "menipis" };

export type SegmentInput = { orders: { createdAt: Date; status: string }[] };

// Segmen (murni). Batas inklusif: pesanan tepat 30, 90, atau 180 hari lalu masih dihitung di dalam jendela.
export function customerSegment(c: SegmentInput, now: Date): Segment {
  const since = (days: number) => now.getTime() - days * DAY;
  const last = c.orders.reduce((m, o) => Math.max(m, o.createdAt.getTime()), -Infinity);
  if (!c.orders.length || last < since(SEGMENT_DAYS.tidakAktif)) return "tidak_aktif";
  const done = c.orders.filter((o) => o.status === "selesai");
  if (done.filter((o) => o.createdAt.getTime() >= since(SEGMENT_DAYS.setia)).length >= SEGMENT_MIN_SETIA) return "setia";
  if (done.length === 1 && done[0].createdAt.getTime() >= since(SEGMENT_DAYS.baru)) return "baru";
  return "lainnya";
}

// Penyamaran kontak untuk staf tanpa izin pelanggan.kontak.
export function maskPhone(phone: string) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 7) return "••••";
  return `${d.slice(0, 4)}••••${d.slice(-3)}`;
}
export function maskEmail(email: string | null) {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return "••••";
  return `${user.slice(0, 2)}•••@${domain}`;
}
export const contactView = (staff: StaffPrincipal, c: { phone: string; email: string | null }) => (can(staff, "pelanggan.kontak") ? { phone: c.phone, email: c.email, masked: false } : { phone: maskPhone(c.phone), email: maskEmail(c.email), masked: true });

// Nomor WhatsApp internasional untuk tautan wa.me (0812... menjadi 62812...).
export const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") ? `62${d.slice(1)}` : d;
};

// SQL segmen yang setara dengan customerSegment, untuk filter dan paginasi di database.
function segmentSql(now: Date) {
  const iso = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const o = schema.orders;
  return sql<Segment>`case
    when max(${o.createdAt}) is null or max(${o.createdAt}) < ${iso(SEGMENT_DAYS.tidakAktif)}::timestamptz then 'tidak_aktif'
    when count(*) filter (where ${o.status} = 'selesai' and ${o.createdAt} >= ${iso(SEGMENT_DAYS.setia)}::timestamptz) >= ${SEGMENT_MIN_SETIA} then 'setia'
    when count(*) filter (where ${o.status} = 'selesai') = 1 and count(*) filter (where ${o.status} = 'selesai' and ${o.createdAt} >= ${iso(SEGMENT_DAYS.baru)}::timestamptz) = 1 then 'baru'
    else 'lainnya' end`;
}

const revenueFilter = sql`${schema.orders.paidAt} is not null and ${schema.orders.status} not in (${sql.join(REVENUE_EXCLUDED.map((s) => sql`${s}`), sql`, `)})`;

export type CustomerSort = "belanja" | "pesanan" | "terakhir";
export type CustomerFilters = { q?: string | null; segment?: Segment | null; sort?: CustomerSort; page?: number };

export async function listCustomers(db: AnyDb, f: CustomerFilters, now: Date) {
  const q = (f.q ?? "").trim().replace(/[%_]/g, "").slice(0, 60);
  const digits = q.replace(/\D/g, "");
  const search: SQL | undefined = q.length >= 2 ? or(ilike(schema.customers.name, `%${q}%`), digits.length >= 3 ? ilike(schema.customers.phone, `%${digits}%`) : undefined) : undefined;
  const seg = segmentSql(now);
  const spend = sql<number>`coalesce(sum(greatest(0, ${schema.orders.subtotal} - ${schema.orders.voucherDiscount} - ${schema.orders.pointsUsed})) filter (where ${revenueFilter}), 0)::int`;
  const orderCount = sql<number>`(count(*) filter (where ${revenueFilter}))::int`;
  const last = sql<Date | null>`max(${schema.orders.createdAt})`;
  const base = db
    .select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone, email: schema.customers.email, points: schema.customers.points, registeredAt: schema.customers.registeredAt, spend: spend.as("spend"), orders: orderCount.as("orders"), lastOrderAt: last.as("last_order_at"), segment: seg.as("segment") })
    .from(schema.customers)
    .leftJoin(schema.orders, eq(schema.orders.customerId, schema.customers.id))
    .where(search)
    .groupBy(schema.customers.id)
    .having(f.segment ? sql`${seg} = ${f.segment}` : undefined)
    .as("c");
  const order = f.sort === "pesanan" ? [desc(base.orders), desc(base.spend)] : f.sort === "terakhir" ? [sql`${base.lastOrderAt} desc nulls last`, desc(base.spend)] : [desc(base.spend), desc(base.orders)];
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(base)
      .orderBy(...order, asc(base.id))
      .limit(CUSTOMER_PAGE_SIZE)
      .offset((page - 1) * CUSTOMER_PAGE_SIZE),
    db.select({ n: count() }).from(base),
  ]);
  return { rows: rows.map((r) => ({ ...r, spend: Number(r.spend), orders: Number(r.orders), lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt) : null })), total: Number(n), page, pageCount: Math.max(1, Math.ceil(Number(n) / CUSTOMER_PAGE_SIZE)) };
}

const mode = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
};

export async function customerDetail(db: AnyDb, id: number, now: Date) {
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, id)).limit(1);
  if (!c) return null;
  const orders = await db
    .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, method: schema.orders.method, total: schema.orders.total, subtotal: schema.orders.subtotal, voucherDiscount: schema.orders.voucherDiscount, pointsUsed: schema.orders.pointsUsed, paidAt: schema.orders.paidAt, createdAt: schema.orders.createdAt, locationName: schema.locations.name })
    .from(schema.orders)
    .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
    .where(eq(schema.orders.customerId, id))
    .orderBy(desc(schema.orders.createdAt));
  const revenue = orders.filter((o) => o.paidAt != null && !(REVENUE_EXCLUDED as readonly string[]).includes(o.status));
  const spend = revenue.reduce((s, o) => s + netSpend(o), 0);
  const brandRows = revenue.length
    ? await db
        .select({ brand: schema.orderItems.brandName, qty: sql<number>`sum(${schema.orderItems.quantity})::int` })
        .from(schema.orderItems)
        .where(sql`${schema.orderItems.orderId} in (${sql.join(revenue.map((o) => sql`${o.id}`), sql`, `)})`)
        .groupBy(schema.orderItems.brandName)
        .orderBy(desc(sql`sum(${schema.orderItems.quantity})`), asc(schema.orderItems.brandName))
        .limit(1)
    : [];
  const [ledger, addresses, wishlist, restock, notifications] = await Promise.all([
    db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.customerId, id)).orderBy(desc(schema.pointsLedger.createdAt), desc(schema.pointsLedger.id)).limit(30),
    db.select().from(schema.addresses).where(eq(schema.addresses.customerId, id)).orderBy(desc(schema.addresses.isPrimary), asc(schema.addresses.id)),
    db.select({ name: schema.products.name, slug: schema.products.slug, at: schema.wishlists.createdAt }).from(schema.wishlists).innerJoin(schema.products, eq(schema.wishlists.productId, schema.products.id)).where(eq(schema.wishlists.customerId, id)).orderBy(desc(schema.wishlists.createdAt)),
    db
      .select({ id: schema.restockRequests.id, status: schema.restockRequests.status, createdAt: schema.restockRequests.createdAt, productName: schema.products.name, shadeName: schema.variants.shadeName })
      .from(schema.restockRequests)
      .innerJoin(schema.variants, eq(schema.restockRequests.variantId, schema.variants.id))
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .where(eq(schema.restockRequests.customerId, id))
      .orderBy(desc(schema.restockRequests.createdAt)),
    db.select({ id: schema.notifications.id, channel: schema.notifications.channel, subject: schema.notifications.subject, status: schema.notifications.status, createdAt: schema.notifications.createdAt }).from(schema.notifications).where(eq(schema.notifications.customerId, id)).orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id)).limit(20),
  ]);
  return {
    customer: c,
    segment: customerSegment({ orders }, now),
    summary: {
      spend,
      orders: revenue.length,
      averageOrder: revenue.length ? Math.round(spend / revenue.length) : 0,
      lastOrderAt: orders[0]?.createdAt ?? null,
      favoriteLocation: mode(revenue.map((o) => o.locationName)),
      favoriteBrand: brandRows[0]?.brand ?? null,
    },
    orders: orders.slice(0, 30),
    totalOrders: orders.length,
    ledger,
    addresses,
    wishlist,
    restock,
    notifications,
  };
}

export type PointAdjustResult = { ok: true; balance: number } | { ok: false; message: string };

// Validasi murni penyesuaian poin.
export function validatePointAdjust(amount: number, reason: string, balance?: number): string | null {
  if (!Number.isInteger(amount) || amount === 0) return "Isi jumlah poin (positif untuk menambah, negatif untuk mengurangi).";
  if (Math.abs(amount) > MAX_POINT_ADJUST) return `Maksimal ${MAX_POINT_ADJUST.toLocaleString("id-ID")} poin sekali sesuaikan.`;
  if ((reason ?? "").trim().length < 5) return "Tulis alasan penyesuaian, minimal 5 karakter.";
  if (balance != null && balance + amount < 0) return `Saldo tidak boleh negatif. Saldo sekarang ${balance.toLocaleString("id-ID")} poin.`;
  return null;
}

export async function adjustPoints(db: AnyDb, staff: StaffPrincipal, customerId: number, amount: number, reason: string, opts: { now?: Date } = {}): Promise<PointAdjustResult> {
  if (!can(staff, "pelanggan.poin")) return { ok: false, message: "Kamu tidak punya izin menyesuaikan poin." };
  const pre = validatePointAdjust(amount, reason);
  if (pre) return { ok: false, message: pre };
  const at = opts.now ?? new Date();
  const text = reason.trim().slice(0, 200);
  return db.transaction(async (tx) => {
    const [c] = await tx.select({ points: schema.customers.points, name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.id, customerId)).for("update");
    if (!c) return { ok: false as const, message: "Pelanggan tidak ditemukan." };
    const err = validatePointAdjust(amount, text, c.points);
    if (err) return { ok: false as const, message: err };
    const r = await movePoints(tx, { customerId, amount, reason: `Penyesuaian manual: ${text}`, reference: `staf:${staff.id}`, key: `manual:${randomUUID()}`, at });
    await writeAudit(tx, { staff, action: "pelanggan.poin", objectType: "pelanggan", objectId: customerId, summary: `${amount > 0 ? "Tambah" : "Kurangi"} ${Math.abs(amount)} poin ${c.name}: ${text}`, before: { saldo: c.points }, after: { saldo: r.balance, perubahan: amount, alasan: text }, at });
    return { ok: true as const, balance: r.balance };
  });
}
