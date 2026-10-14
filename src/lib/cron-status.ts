// Status cron harian (Fase 8B). Disimpan di tabel settings (kunci cron.status) supaya tanpa migrasi. Dashboard Owner
// menampilkan peringatan bila cron terakhir gagal, atau tidak ada cron yang berhasil lebih dari 26 jam (cron jalan
// tiap 03.00 WIB). Bila cron belum pernah jalan, patokannya waktu data diisi (baris versi seed).
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { SETTING_KEYS } from "@/lib/settings";

export const CRON_STATUS_KEY = "cron.status";
export const CRON_BATAS_JAM = 26;

export type CronStatus = { mulai: string; selesai: string | null; ok: boolean; galat: string | null; durasiMs: number | null; terakhirBerhasil: string | null };

export async function bacaCronStatus(db: AnyDb): Promise<{ status: CronStatus | null; patokan: Date | null }> {
  const rows = await db.select({ key: schema.settings.key, value: schema.settings.value, updatedAt: schema.settings.updatedAt }).from(schema.settings).where(eq(schema.settings.key, CRON_STATUS_KEY));
  const [seed] = await db.select({ updatedAt: schema.settings.updatedAt }).from(schema.settings).where(eq(schema.settings.key, SETTING_KEYS.seedVersion));
  const status = (rows[0]?.value as CronStatus | undefined) ?? null;
  return { status, patokan: seed?.updatedAt ?? null };
}

export async function tulisCronStatus(db: AnyDb, s: CronStatus, at = new Date()) {
  await db.insert(schema.settings).values({ key: CRON_STATUS_KEY, value: s as unknown as object, updatedAt: at }).onConflictDoUpdate({ target: schema.settings.key, set: { value: s as unknown as object, updatedAt: at } });
}

export type CronPeringatan = { level: "gagal" | "terlambat"; pesan: string } | null;

// Murni: apakah dashboard perlu memperingatkan Owner.
export function cronPeringatan(status: CronStatus | null, patokan: Date | null, now: Date, batasJam = CRON_BATAS_JAM): CronPeringatan {
  if (status && !status.ok && status.selesai) return { level: "gagal", pesan: `Cron harian terakhir gagal: ${status.galat ?? "tanpa keterangan"}. Cek log Vercel.` };
  const terakhir = status?.terakhirBerhasil ? new Date(status.terakhirBerhasil) : patokan;
  if (!terakhir) return null;
  const jam = (now.getTime() - terakhir.getTime()) / 3_600_000;
  if (jam > batasJam) return { level: "terlambat", pesan: `Cron harian belum berhasil berjalan selama ${Math.floor(jam)} jam. Pesanan kedaluwarsa, email, Kabar Harian, dan reset demo bisa tertunda.` };
  return null;
}
