// Masuk staf: email + kata sandi, sesi 12 jam terpisah dari sesi pembeli, rate limit dan kunci sementara di database.
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import { hashIp } from "@/lib/auth/otp";
import type { AnyDb } from "@/lib/db-types";
import { writeAudit } from "./audit";
import { DUMMY_HASH, verifyPassword } from "./password";
import { isRoleSlug, type StaffPrincipal } from "./permissions";

export const STAFF_COOKIE = "rona_staf";
export const STAFF_SESSION_TTL_MS = 12 * 60 * 60_000;
export const LOGIN_LIMITS = { emailFailures: 5, ipFailures: 20, windowMs: 15 * 60_000, lockMs: 15 * 60_000 } as const;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const normalizeEmail = (e: string) => String(e ?? "").trim().toLowerCase().slice(0, 120);

export async function loadPrincipal(db: AnyDb, staffId: number): Promise<StaffPrincipal | null> {
  const [row] = await db
    .select({ id: schema.staff.id, name: schema.staff.name, email: schema.staff.email, isActive: schema.staff.isActive, roleSlug: schema.roles.slug })
    .from(schema.staff)
    .innerJoin(schema.roles, eq(schema.staff.roleId, schema.roles.id))
    .where(eq(schema.staff.id, staffId))
    .limit(1);
  if (!row || !isRoleSlug(row.roleSlug)) return null;
  const [perms, locs] = await Promise.all([
    db.select({ key: schema.permissions.key, allowed: schema.permissions.allowed }).from(schema.permissions).where(eq(schema.permissions.staffId, staffId)),
    db.select({ locationId: schema.staffLocations.locationId }).from(schema.staffLocations).where(eq(schema.staffLocations.staffId, staffId)),
  ]);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleSlug: row.roleSlug,
    isActive: row.isActive,
    grants: perms.filter((p) => p.allowed).map((p) => p.key),
    revokes: perms.filter((p) => !p.allowed).map((p) => p.key),
    locationIds: row.roleSlug === "owner" ? [] : locs.map((l) => l.locationId).sort((a, b) => a - b),
  };
}

export async function createStaffSession(db: AnyDb, staffId: number, now: Date, userAgent = "") {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + STAFF_SESSION_TTL_MS);
  await db.insert(schema.staffSessions).values({ tokenHash: hashToken(token), staffId, userAgent: userAgent.slice(0, 200), createdAt: now, lastSeenAt: now, expiresAt });
  return { token, expiresAt };
}

export async function readStaffSession(db: AnyDb, token: string | null | undefined, now: Date): Promise<StaffPrincipal | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [s] = await db
    .select({ id: schema.staffSessions.id, staffId: schema.staffSessions.staffId, lastSeenAt: schema.staffSessions.lastSeenAt })
    .from(schema.staffSessions)
    .where(and(eq(schema.staffSessions.tokenHash, hashToken(token)), isNull(schema.staffSessions.revokedAt), gt(schema.staffSessions.expiresAt, now)))
    .limit(1);
  if (!s) return null;
  const p = await loadPrincipal(db, s.staffId);
  if (!p || !p.isActive) return null;
  if (now.getTime() - s.lastSeenAt.getTime() > 5 * 60_000) await db.update(schema.staffSessions).set({ lastSeenAt: now }).where(eq(schema.staffSessions.id, s.id));
  return p;
}

export async function revokeStaffSession(db: AnyDb, token: string, now: Date) {
  await db.update(schema.staffSessions).set({ revokedAt: now }).where(and(eq(schema.staffSessions.tokenHash, hashToken(token)), isNull(schema.staffSessions.revokedAt)));
}

export async function revokeAllStaffSessions(db: AnyDb, staffId: number, now: Date) {
  const rows = await db.update(schema.staffSessions).set({ revokedAt: now }).where(and(eq(schema.staffSessions.staffId, staffId), isNull(schema.staffSessions.revokedAt))).returning({ id: schema.staffSessions.id });
  return rows.length;
}

// Kunci sementara: 5 gagal untuk satu email dalam 15 menit (setelah keberhasilan terakhir) mengunci email itu 15 menit
// sejak kegagalan terakhir, terdaftar atau tidak. Per IP: 20 gagal per 15 menit.
export async function loginLock(db: AnyDb, email: string, ipHash: string, now: Date): Promise<{ locked: boolean; retryAfterSec: number }> {
  const since = new Date(now.getTime() - LOGIN_LIMITS.windowMs);
  const recent = await db
    .select({ success: schema.staffLoginAttempts.success, createdAt: schema.staffLoginAttempts.createdAt })
    .from(schema.staffLoginAttempts)
    .where(and(eq(schema.staffLoginAttempts.email, email), gt(schema.staffLoginAttempts.createdAt, since)))
    .orderBy(desc(schema.staffLoginAttempts.createdAt))
    .limit(LOGIN_LIMITS.emailFailures + 1);
  const failures: Date[] = [];
  for (const r of recent) {
    if (r.success) break;
    failures.push(r.createdAt);
  }
  if (failures.length >= LOGIN_LIMITS.emailFailures) {
    const until = failures[0].getTime() + LOGIN_LIMITS.lockMs;
    if (until > now.getTime()) return { locked: true, retryAfterSec: Math.ceil((until - now.getTime()) / 1000) };
  }
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.staffLoginAttempts)
      .where(and(eq(schema.staffLoginAttempts.ipHash, ipHash), eq(schema.staffLoginAttempts.success, false), gt(schema.staffLoginAttempts.createdAt, since)));
    if (Number(n) >= LOGIN_LIMITS.ipFailures) return { locked: true, retryAfterSec: Math.ceil(LOGIN_LIMITS.windowMs / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

export const LOGIN_FAILED = "Email atau kata sandi salah.";

export type StaffLoginResult = { ok: true; staffId: number; token: string; expiresAt: Date } | { ok: false; message: string; locked?: boolean; retryAfterSec?: number };

export async function attemptStaffLogin(db: AnyDb, input: { email: string; password: string; ip?: string; secret: string; now: Date; userAgent?: string }): Promise<StaffLoginResult> {
  const email = normalizeEmail(input.email);
  const ipHash = hashIp(input.secret, input.ip ?? "");
  const lock = await loginLock(db, email, ipHash, input.now);
  if (lock.locked) {
    const minutes = Math.max(1, Math.ceil(lock.retryAfterSec / 60));
    return { ok: false, locked: true, retryAfterSec: lock.retryAfterSec, message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.` };
  }
  const [s] = email ? await db.select({ id: schema.staff.id, name: schema.staff.name, passwordHash: schema.staff.passwordHash, isActive: schema.staff.isActive }).from(schema.staff).where(eq(schema.staff.email, email)).limit(1) : [];
  // Hash tetap dihitung walau email tidak terdaftar, supaya waktu respons tidak membocorkan keberadaan akun.
  const valid = await verifyPassword(String(input.password ?? "").slice(0, 200), s?.passwordHash ?? DUMMY_HASH);
  if (!s || !valid || !s.isActive) {
    await db.insert(schema.staffLoginAttempts).values({ email, ipHash, success: false, createdAt: input.now });
    await writeAudit(db, { staff: s ? { id: s.id, name: s.name } : null, action: "staf.masuk_gagal", objectType: "staf", objectId: email, summary: s && valid && !s.isActive ? "Akun nonaktif" : "Email atau kata sandi salah", at: input.now });
    return { ok: false, message: s && valid && !s.isActive ? "Akun ini sedang nonaktif. Hubungi Owner." : LOGIN_FAILED };
  }
  return finishStaffLogin(db, { id: s.id, name: s.name }, { email, ipHash, now: input.now, userAgent: input.userAgent, via: "kata sandi" });
}

export async function finishStaffLogin(db: AnyDb, s: { id: number; name: string }, o: { email: string; ipHash: string; now: Date; userAgent?: string; via: string }): Promise<StaffLoginResult> {
  await db.insert(schema.staffLoginAttempts).values({ email: o.email, ipHash: o.ipHash, success: true, createdAt: o.now });
  await db.update(schema.staff).set({ lastLoginAt: o.now }).where(eq(schema.staff.id, s.id));
  const session = await createStaffSession(db, s.id, o.now, o.userAgent);
  await writeAudit(db, { staff: s, action: "staf.masuk", objectType: "staf", objectId: s.id, summary: `Masuk lewat ${o.via}`, at: o.now });
  return { ok: true, staffId: s.id, token: session.token, expiresAt: session.expiresAt };
}
