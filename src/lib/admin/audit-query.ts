// Pembacaan log aktivitas dengan filter staf, jenis aksi, objek, dan tanggal.
import { and, count, desc, eq, gte, ilike, lt, notInArray, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export const LOGIN_ACTIONS = ["staf.masuk", "staf.masuk_gagal", "staf.keluar"];

export type AuditFilters = { staffId?: number | null; action?: string | null; objectType?: string | null; object?: string | null; from?: Date | null; to?: Date | null; page?: number; includeLogins?: boolean };

export async function listAudit(db: AnyDb, f: AuditFilters) {
  const conds: SQL[] = [];
  if (f.staffId) conds.push(eq(schema.auditLogs.staffId, f.staffId));
  if (f.action) conds.push(eq(schema.auditLogs.action, f.action));
  // Kejadian login disembunyikan secara bawaan supaya log tidak dibanjiri (kecuali dipilih atau sakelar dinyalakan).
  else if (!f.includeLogins) conds.push(notInArray(schema.auditLogs.action, LOGIN_ACTIONS));
  if (f.objectType) conds.push(eq(schema.auditLogs.objectType, f.objectType));
  if (f.object) conds.push(ilike(schema.auditLogs.objectId, `%${f.object.replace(/[%_]/g, "")}%`));
  if (f.from) conds.push(gte(schema.auditLogs.createdAt, f.from));
  if (f.to) conds.push(lt(schema.auditLogs.createdAt, f.to));
  const where = conds.length ? and(...conds) : undefined;
  const pageSize = 30;
  const page = Math.max(1, f.page ?? 1);
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(schema.auditLogs).where(where),
    db.select().from(schema.auditLogs).where(where).orderBy(desc(schema.auditLogs.createdAt), desc(schema.auditLogs.id)).limit(pageSize).offset((page - 1) * pageSize),
  ]);
  return { rows, total: Number(n), page, pageCount: Math.max(1, Math.ceil(Number(n) / pageSize)) };
}

export type GroupedAudit<T> = T & { repeat: number; firstAt: Date };

// Login berulang dari staf (atau email) yang sama dalam 10 menit digabung menjadi satu baris. Baris urut terbaru dulu.
export function groupLogins<T extends { action: string; staffId: number | null; objectId: string; createdAt: Date }>(rows: T[], windowMs = 10 * 60_000): GroupedAudit<T>[] {
  const out: GroupedAudit<T>[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const sameActor = last && last.action === r.action && (r.staffId != null ? last.staffId === r.staffId : last.objectId === r.objectId);
    if (last && LOGIN_ACTIONS.includes(r.action) && sameActor && last.firstAt.getTime() - r.createdAt.getTime() <= windowMs) {
      last.repeat += 1;
      last.firstAt = r.createdAt;
      continue;
    }
    out.push({ ...r, repeat: 1, firstAt: r.createdAt });
  }
  return out;
}
