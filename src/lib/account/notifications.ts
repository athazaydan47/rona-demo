// Kotak Notifikasi: pesan WA dan email yang ditulis outbox, hanya milik pembeli yang sedang masuk.
import { and, count, desc, eq, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export type InboxItem = { id: number; kind: string; channel: "wa" | "email"; subject: string; body: string; createdAt: Date; readAt: Date | null; orderNumber: string | null };

export const INBOX_PAGE_SIZE = 20;

export async function listInboxPage(db: AnyDb, customerId: number, page = 1, pageSize = INBOX_PAGE_SIZE) {
  const safePage = Math.max(1, Math.floor(page));
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(schema.notifications).where(eq(schema.notifications.customerId, customerId)),
    listInbox(db, customerId, pageSize, (safePage - 1) * pageSize),
  ]);
  const total = Number(n);
  return { rows, total, page: safePage, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listInbox(db: AnyDb, customerId: number, limit = 40, offset = 0): Promise<InboxItem[]> {
  return db
    .select({
      id: schema.notifications.id,
      kind: schema.notifications.kind,
      channel: schema.notifications.channel,
      subject: schema.notifications.subject,
      body: schema.notifications.body,
      createdAt: schema.notifications.createdAt,
      readAt: schema.notifications.readAt,
      orderNumber: schema.orders.number,
    })
    .from(schema.notifications)
    .leftJoin(schema.orders, eq(schema.notifications.orderId, schema.orders.id))
    .where(eq(schema.notifications.customerId, customerId))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(limit)
    .offset(offset);
}

export async function unreadCount(db: AnyDb, customerId: number) {
  const [r] = await db.select({ n: count() }).from(schema.notifications).where(and(eq(schema.notifications.customerId, customerId), isNull(schema.notifications.readAt)));
  return Number(r?.n ?? 0);
}

export async function markAllRead(db: AnyDb, customerId: number, now: Date) {
  const rows = await db.update(schema.notifications).set({ readAt: now }).where(and(eq(schema.notifications.customerId, customerId), isNull(schema.notifications.readAt))).returning({ id: schema.notifications.id });
  return rows.length;
}

export async function markRead(db: AnyDb, customerId: number, id: number, now: Date) {
  const rows = await db
    .update(schema.notifications)
    .set({ readAt: now })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.customerId, customerId), isNull(schema.notifications.readAt)))
    .returning({ id: schema.notifications.id });
  return rows.length > 0;
}
