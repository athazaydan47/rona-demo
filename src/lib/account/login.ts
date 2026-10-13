// Penyelesaian masuk setelah OTP benar (atau tombol akun demo): akun dibuat bila belum ada,
// keranjang dan wishlist tamu digabung, pesanan tamu dengan nomor yang sama diklaim, lalu sesi dibuat.
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as schema from "@/db/schema";
import { createSession } from "@/lib/auth/session";
import { mergeGuestCartIntoCustomer } from "@/lib/cart/service";
import type { AnyDb } from "@/lib/db-types";
import { awardOrderPoints } from "@/lib/orders/service";

export async function findOrCreateCustomerByPhone(db: AnyDb, phone: string, now: Date) {
  const inserted = await db
    .insert(schema.customers)
    .values({ name: "", phone, registeredAt: now })
    .onConflictDoNothing({ target: schema.customers.phone })
    .returning({ id: schema.customers.id, name: schema.customers.name });
  if (inserted[0]) return { ...inserted[0], isNew: true };
  const [c] = await db.select({ id: schema.customers.id, name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.phone, phone)).limit(1);
  return { ...c, isNew: false };
}

// Pesanan tamu dengan nomor WA yang baru terverifikasi menjadi milik akun, beserta notifikasinya.
// Pesanan yang sudah Selesai langsung memberi poin (idempoten lewat kunci ledger yang sama).
export async function claimGuestOrders(db: AnyDb, customerId: number, phone: string, now: Date) {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(schema.orders)
      .set({ customerId })
      .where(and(isNull(schema.orders.customerId), eq(schema.orders.guestPhone, phone)))
      .returning({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, subtotal: schema.orders.subtotal, voucherDiscount: schema.orders.voucherDiscount, pointsUsed: schema.orders.pointsUsed });
    const ids = claimed.map((o) => o.id);
    await tx
      .update(schema.notifications)
      .set({ customerId })
      .where(and(isNull(schema.notifications.customerId), ids.length ? or(inArray(schema.notifications.orderId, ids), eq(schema.notifications.recipient, phone)) : eq(schema.notifications.recipient, phone)));
    let points = 0;
    for (const o of claimed) if (o.status === "selesai") points += await awardOrderPoints(tx, { ...o, customerId }, now);
    return { orders: claimed.map((o) => o.number), points };
  });
}

export async function mergeGuestWishlist(db: AnyDb, customerId: number, productIds: unknown) {
  const ids = Array.isArray(productIds) ? [...new Set(productIds.filter((n): n is number => Number.isInteger(n) && n > 0))].slice(0, 100) : [];
  if (ids.length === 0) return 0;
  const valid = await db.select({ id: schema.products.id }).from(schema.products).where(inArray(schema.products.id, ids));
  if (valid.length === 0) return 0;
  const rows = await db
    .insert(schema.wishlists)
    .values(valid.map((p) => ({ customerId, productId: p.id })))
    .onConflictDoNothing()
    .returning({ id: schema.wishlists.id });
  return rows.length;
}

export type LoginOutcome = { customerId: number; isNew: boolean; needsName: boolean; token: string; expiresAt: Date; claimedOrders: string[] };

export async function completeLogin(
  db: AnyDb,
  input: { phone: string; now: Date; guestCartToken?: string | null; guestWishlist?: unknown; userAgent?: string },
): Promise<LoginOutcome> {
  const c = await findOrCreateCustomerByPhone(db, input.phone, input.now);
  await db.update(schema.customers).set({ lastLoginAt: input.now }).where(eq(schema.customers.id, c.id));
  if (input.guestCartToken) await mergeGuestCartIntoCustomer(db, input.guestCartToken, c.id);
  await mergeGuestWishlist(db, c.id, input.guestWishlist);
  const claimed = await claimGuestOrders(db, c.id, input.phone, input.now);
  const session = await createSession(db, c.id, input.now, input.userAgent);
  return { customerId: c.id, isNew: c.isNew, needsName: !c.name.trim(), token: session.token, expiresAt: session.expiresAt, claimedOrders: claimed.orders };
}
