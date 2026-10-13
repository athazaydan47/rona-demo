// Pembacaan log aktivitas dengan filter staf, jenis aksi, objek, dan tanggal.
import { and, count, desc, eq, gte, ilike, lt, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export type AuditFilters = { staffId?: number | null; action?: string | null; objectType?: string | null; object?: string | null; from?: Date | null; to?: Date | null; page?: number };

export async function listAudit(db: AnyDb, f: AuditFilters) {
  const conds: SQL[] = [];
  if (f.staffId) conds.push(eq(schema.auditLogs.staffId, f.staffId));
  if (f.action) conds.push(eq(schema.auditLogs.action, f.action));
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

// Beda sebelum dan sesudah per kunci, untuk tampilan yang mudah dibaca.
export function auditDiff(before: unknown, after: unknown) {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .map((k) => ({ key: k, before: k in b ? b[k] : undefined, after: k in a ? a[k] : undefined }))
    .filter((d) => JSON.stringify(d.before) !== JSON.stringify(d.after));
}
