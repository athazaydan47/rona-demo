// Reset data demo: kosongkan semua tabel data lalu isi ulang dengan seed deterministik yang sama.
// Tidak menjalankan migrasi dan tidak memakai drizzle-kit. Satu transaksi, jadi pengunjung tidak pernah melihat
// database kosong; advisory lock mencegah dua reset berjalan bersamaan (cron dan tombol Owner).
import { and, desc, eq, gt, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { seedAll, type SeedSummary } from "@/db/seed/all";
import { writeAudit } from "@/lib/admin/audit";
import type { AnyDb } from "@/lib/db-types";
import { deleteAllReviewPhotos } from "@/lib/reviews/storage";
import { logEvent } from "@/lib/log";

const LOCK_KEY = 726_277_001;
export const MANUAL_RESET_COOLDOWN_MS = 5 * 60_000;

export class DemoResetError extends Error {
  constructor(
    message: string,
    public code: "nonaktif" | "sedang_berjalan" | "terlalu_sering",
  ) {
    super(message);
    this.name = "DemoResetError";
  }
}

export const demoModeOn = (env: Record<string, string | undefined>) => env.DEMO_MODE === "true";
export const dailyResetOn = (env: Record<string, string | undefined>) => demoModeOn(env) && env.DEMO_DAILY_RESET === "true";

export const AI_TABLES_KEPT = ["ai_cache", "ai_logs", "review_summaries", "daily_briefs", "__drizzle_migrations"];

export type DemoResetResult = { durationMs: number; seedMs: number; truncateMs: number; photos: { kind: string; deleted: number }; summary: SeedSummary };

export async function resetDemoData(
  db: AnyDb,
  opts: { env?: Record<string, string | undefined>; now?: Date; actor?: { id: number; name: string } | null; source: "cron" | "owner" | "uji"; deletePhotos?: () => Promise<{ kind: string; deleted: number }> },
): Promise<DemoResetResult> {
  const env = opts.env ?? process.env;
  // Pengaman utama: reset tidak pernah jalan bila DEMO_MODE bukan true, dari jalur mana pun.
  if (!demoModeOn(env)) throw new DemoResetError("Reset data demo hanya tersedia saat DEMO_MODE=true.", "nonaktif");
  const now = opts.now ?? new Date();
  const t0 = performance.now();
  let truncateMs = 0;
  let seedMs = 0;
  const summary = await db.transaction(async (tx) => {
    const [lock] = (await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK_KEY}) as ok`)) as unknown as { ok: boolean }[];
    if (!lock?.ok) throw new DemoResetError("Reset data demo sedang berjalan. Coba lagi sebentar lagi.", "sedang_berjalan");
    const tables = (await tx.execute(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`)) as unknown as { tablename: string }[];
    // Tabel AI (cache hasil, ringkasan ulasan, log pemakaian) tidak ikut dikosongkan: seed deterministik menghasilkan
    // data yang sama, jadi cache tetap berlaku, dan log dipakai untuk batas harian serta biaya.
    const list = tables
      .filter((t) => !AI_TABLES_KEPT.includes(t.tablename))
      .map((t) => `"${t.tablename.replace(/"/g, "")}"`)
      .join(", ");
    const t1 = performance.now();
    await tx.execute(sql.raw(`truncate table ${list} restart identity cascade`));
    truncateMs = performance.now() - t1;
    const t2 = performance.now();
    const s = await seedAll(tx, now);
    seedMs = performance.now() - t2;
    return s;
  });
  const photos = await (opts.deletePhotos ?? (() => deleteAllReviewPhotos(env)))().catch(() => ({ kind: "gagal", deleted: 0 }));
  const durationMs = Math.round(performance.now() - t0);
  await writeAudit(db, {
    staff: opts.actor ?? null,
    action: "demo.reset",
    objectType: "demo",
    objectId: opts.source,
    summary: `Data demo direset (${opts.source === "cron" ? "jadwal harian" : opts.source === "owner" ? "tombol Owner" : "uji"}) dalam ${durationMs} ms`,
    after: { durationMs, truncateMs: Math.round(truncateMs), seedMs: Math.round(seedMs), photos, ...summary },
    at: new Date(now.getTime() + durationMs),
  });
  logEvent("demo.reset", { sumber: opts.source, durasiMs: durationMs, produk: summary.products, pesananRiwayat: summary.historyOrders });
  return { durationMs, seedMs: Math.round(seedMs), truncateMs: Math.round(truncateMs), photos, summary };
}

// Tombol Owner dibatasi sekali per 5 menit (dihitung dari log reset terakhir, yang ditulis setelah reset).
export async function assertManualResetAllowed(db: AnyDb, now: Date) {
  const since = new Date(now.getTime() - MANUAL_RESET_COOLDOWN_MS);
  const [last] = await db
    .select({ at: schema.auditLogs.createdAt })
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.action, "demo.reset"), gt(schema.auditLogs.createdAt, since)))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1);
  if (last) {
    const wait = Math.ceil((last.at.getTime() + MANUAL_RESET_COOLDOWN_MS - now.getTime()) / 60_000);
    throw new DemoResetError(`Data demo baru saja direset. Coba lagi dalam ${Math.max(1, wait)} menit.`, "terlalu_sering");
  }
}
