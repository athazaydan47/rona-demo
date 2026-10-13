// Poin: 1 poin per Rp 1.000 dari nilai belanja bersih pesanan Selesai; 1 poin bernilai Rp 1 saat ditukar.
// Setiap gerakan dicatat di points_ledger dengan kunci unik, dan saldo customers.points selalu = jumlah ledger.
import { and, eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export const RUPIAH_PER_POINT_EARNED = 1000;
export const FIRST_REVIEW_BONUS = 50;

// Nilai belanja bersih: subtotal setelah diskon produk, dikurangi voucher dan poin yang dipakai, tanpa ongkir.
export function netSpend(o: { subtotal: number; voucherDiscount: number; pointsUsed: number }) {
  return Math.max(0, o.subtotal - o.voucherDiscount - o.pointsUsed);
}

export function earnedPoints(o: { subtotal: number; voucherDiscount: number; pointsUsed: number }) {
  return Math.floor(netSpend(o) / RUPIAH_PER_POINT_EARNED);
}

export const pointKeys = {
  redeem: (orderNumber: string) => `tukar:${orderNumber}`,
  refundRedeem: (orderNumber: string) => `kembali-tukar:${orderNumber}`,
  earn: (orderNumber: string) => `dapat:${orderNumber}`,
  clawback: (orderNumber: string) => `tarik:${orderNumber}`,
  firstReview: (customerId: number) => `bonus-ulasan-pertama:${customerId}`,
};

export type PointMove = { customerId: number; amount: number; reason: string; reference?: string; key: string; at?: Date };
export type PointResult = { applied: number; duplicate: boolean; balance: number };

// Mencatat satu gerakan poin secara idempoten. Baris customer dikunci supaya saldo konsisten.
// Gerakan negatif tidak pernah membuat saldo negatif: yang ditarik maksimal saldo yang ada.
export async function movePoints(tx: AnyDb, m: PointMove): Promise<PointResult> {
  const [c] = await tx.select({ points: schema.customers.points }).from(schema.customers).where(eq(schema.customers.id, m.customerId)).for("update");
  if (!c) throw new Error("Pembeli tidak ditemukan.");
  const [existing] = await tx.select({ id: schema.pointsLedger.id }).from(schema.pointsLedger).where(eq(schema.pointsLedger.idempotencyKey, m.key)).limit(1);
  if (existing) return { applied: 0, duplicate: true, balance: c.points };
  const applied = m.amount < 0 ? Math.max(m.amount, -c.points) : m.amount;
  const reason = applied !== m.amount ? `${m.reason} (saldo tidak cukup: ditarik ${-applied} dari ${-m.amount} poin)` : m.reason;
  const inserted = await tx
    .insert(schema.pointsLedger)
    .values({ customerId: m.customerId, amount: applied, reason, reference: m.reference ?? "", idempotencyKey: m.key, ...(m.at ? { createdAt: m.at } : {}) })
    .onConflictDoNothing({ target: schema.pointsLedger.idempotencyKey })
    .returning({ id: schema.pointsLedger.id });
  if (inserted.length === 0) return { applied: 0, duplicate: true, balance: c.points };
  const balance = c.points + applied;
  await tx.update(schema.customers).set({ points: balance }).where(eq(schema.customers.id, m.customerId));
  return { applied, duplicate: false, balance };
}

// Pemeriksa konsistensi: pembeli yang saldonya tidak sama dengan jumlah ledger (seharusnya selalu kosong).
export async function checkPointsConsistency(db: AnyDb, customerId?: number) {
  // Agregasi lewat LEFT JOIN + GROUP BY (subkueri berkorelasi di sql`` merender kolom tanpa nama tabel).
  const rows = await db
    .select({
      customerId: schema.customers.id,
      balance: schema.customers.points,
      ledger: sql<number>`coalesce(sum(${schema.pointsLedger.amount}), 0)::int`,
    })
    .from(schema.customers)
    .leftJoin(schema.pointsLedger, eq(schema.pointsLedger.customerId, schema.customers.id))
    .where(customerId != null ? eq(schema.customers.id, customerId) : sql`true`)
    .groupBy(schema.customers.id, schema.customers.points);
  return rows.filter((r) => r.balance !== Number(r.ledger)).map((r) => ({ customerId: r.customerId, balance: r.balance, ledger: Number(r.ledger) }));
}

export async function ledgerFor(db: AnyDb, customerId: number, limit = 50) {
  return db
    .select({ id: schema.pointsLedger.id, amount: schema.pointsLedger.amount, reason: schema.pointsLedger.reason, reference: schema.pointsLedger.reference, createdAt: schema.pointsLedger.createdAt })
    .from(schema.pointsLedger)
    .where(and(eq(schema.pointsLedger.customerId, customerId)))
    .orderBy(sql`${schema.pointsLedger.createdAt} desc, ${schema.pointsLedger.id} desc`)
    .limit(limit);
}
