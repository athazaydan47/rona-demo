// Sesi pembeli: token acak 32 byte di cookie httpOnly, database menyimpan SHA-256 dari token.
// Berlaku 30 hari dan diperpanjang saat aktif; bisa dicabut satu per satu atau semua perangkat.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { namaCookie } from "@/config/merek";

export const SESSION_COOKIE = namaCookie("sesi");
export const SESSION_FRESH_COOKIE = namaCookie("sesi_segar");
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
export const SESSION_EXTEND_AFTER_MS = 12 * 60 * 60_000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: AnyDb, customerId: number, now: Date, userAgent = "") {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ tokenHash: hashToken(token), customerId, userAgent: userAgent.slice(0, 200), createdAt: now, lastSeenAt: now, expiresAt });
  return { token, expiresAt };
}

export type SessionCustomer = { sessionId: number; customerId: number; name: string; phone: string; email: string | null; points: number };

// Mengembalikan pembeli untuk token, atau null bila tidak ada, dicabut, atau kedaluwarsa. Memperpanjang sesi aktif.
export async function readSession(db: AnyDb, token: string | null | undefined, now: Date): Promise<SessionCustomer | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await db
    .select({
      sessionId: schema.sessions.id,
      lastSeenAt: schema.sessions.lastSeenAt,
      customerId: schema.customers.id,
      name: schema.customers.name,
      phone: schema.customers.phone,
      email: schema.customers.email,
      points: schema.customers.points,
    })
    .from(schema.sessions)
    .innerJoin(schema.customers, eq(schema.sessions.customerId, schema.customers.id))
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > SESSION_EXTEND_AFTER_MS) {
    await db.update(schema.sessions).set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) }).where(eq(schema.sessions.id, row.sessionId));
  }
  return { sessionId: row.sessionId, customerId: row.customerId, name: row.name, phone: row.phone, email: row.email, points: row.points };
}

export async function revokeSession(db: AnyDb, token: string, now: Date) {
  await db.update(schema.sessions).set({ revokedAt: now }).where(and(eq(schema.sessions.tokenHash, hashToken(token)), isNull(schema.sessions.revokedAt)));
}

export async function revokeAllSessions(db: AnyDb, customerId: number, now: Date) {
  const rows = await db.update(schema.sessions).set({ revokedAt: now }).where(and(eq(schema.sessions.customerId, customerId), isNull(schema.sessions.revokedAt))).returning({ id: schema.sessions.id });
  return rows.length;
}
