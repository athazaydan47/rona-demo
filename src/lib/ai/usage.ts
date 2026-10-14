// Pencatatan pemakaian AI (tabel ai_logs), batas pemakaian di database, dan cache hasil AI (tabel ai_cache).
// Isi percakapan tidak disimpan; id pengunjung disimpan sebagai hash.
import { createHash } from "node:crypto";
import { and, count, eq, gt, gte, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { wibDayStart } from "@/lib/reports";
import type { AiConfig } from "./client";
import { MEREK, namaCookie } from "@/config/merek";
import { logEvent } from "@/lib/log";

export const VISITOR_COOKIE = namaCookie("pengunjung");
export const LIMITS = { chatPerDayDemo: 20, chatPerMinute: 5, photoPerDay: 5, dupePerDay: 10, adminPerDay: 80, transcribePerDay: 40, pembeliPerDay: 30 } as const;
// Fitur AI pembeli yang berbagi satu batas harian per pengunjung (Fase 8C), di samping batas per fitur dan batas global.
export const BUYER_AI_FEATURES = ["advisor", "dupe", "foto_kulit", "padanan_shade"] as const;

export function visitorHash(visitorId: string, secret = process.env.SESSION_SECRET ?? `${MEREK.kunci}-demo`) {
  return createHash("sha256").update(`${secret}:${visitorId}`).digest("hex").slice(0, 32);
}

export type AiLogInput = { feature: string; model: string; inputTokens?: number; outputTokens?: number; latencyMs: number; ok: boolean; error?: string | null; visitorHash?: string; query?: string | null; at?: Date; staffId?: number | null; door?: string | null; tools?: string[]; warning?: string | null };

export async function logAi(db: AnyDb, l: AiLogInput) {
  // Galat AI juga ke log server (tanpa isi pertanyaan) supaya terlihat di log Vercel (Fase 8B).
  if (!l.ok) logEvent("ai.galat", { fitur: l.feature, model: l.model, galat: l.error ?? "", latensiMs: Math.round(l.latencyMs) }, "warn");
  await db.insert(schema.aiLogs).values({
    feature: l.feature,
    model: l.model,
    inputTokens: l.inputTokens ?? 0,
    outputTokens: l.outputTokens ?? 0,
    latencyMs: Math.max(0, Math.round(l.latencyMs)),
    ok: l.ok,
    error: l.error ? l.error.slice(0, 300) : null,
    visitorHash: l.visitorHash ?? "",
    query: l.query ? l.query.slice(0, 200) : null,
    staffId: l.staffId ?? null,
    door: l.door ?? null,
    tools: (l.tools ?? []).slice(0, 20),
    warning: l.warning ? l.warning.slice(0, 300) : null,
    ...(l.at ? { createdAt: l.at } : {}),
  });
}

export type LimitResult = { ok: true } | { ok: false; reason: "harian" | "menit" | "global"; message: string };
export const RESTING_MESSAGE = `${MEREK.asisten.nama} sedang istirahat, coba lagi besok. Kuis kulit, rutinitas, dan pencarian tetap bisa dipakai.`;

// Catatan di ai_logs yang bukan panggilan model: hasil membaca link video (Fase 8C). Tidak dihitung di batas AI.
export const NON_AI_FEATURES = ["link_video"] as const;

// Batas global: jumlah panggilan AI hari ini (WIB, semua fitur) dibanding AI_DAILY_CAP.
export async function globalCapReached(db: AnyDb, cfg: AiConfig, now: Date) {
  // Hasil dari cache (model "cache") tidak memanggil AI, jadi tidak dihitung.
  const [{ n }] = await db.select({ n: count() }).from(schema.aiLogs).where(and(gte(schema.aiLogs.createdAt, wibDayStart(now)), sql`${schema.aiLogs.feature} not in ('eval', 'link_video')`, sql`${schema.aiLogs.model} <> 'cache'`));
  return Number(n) >= cfg.dailyCap;
}

export const SHARED_LIMIT_MESSAGE = `Kuota AI-mu hari ini sudah habis. Kuis kulit, rutinitas, padanan shade, lacak pesanan, dan cek ongkir tetap bisa dipakai di ${MEREK.asisten.nama}.`;

// Batas bersama: semua panggilan AI pembeli (chat, link dan screenshot, foto kuis, tafsir shade) per pengunjung per hari.
export async function checkSharedBuyerLimit(db: AnyDb, hash: string, now: Date): Promise<LimitResult> {
  const [{ day }] = await db
    .select({ day: count() })
    .from(schema.aiLogs)
    .where(and(eq(schema.aiLogs.visitorHash, hash), sql`${schema.aiLogs.feature} in ('advisor', 'dupe', 'foto_kulit', 'padanan_shade')`, sql`${schema.aiLogs.model} <> 'cache'`, gte(schema.aiLogs.createdAt, wibDayStart(now))));
  return Number(day) >= LIMITS.pembeliPerDay ? { ok: false, reason: "harian", message: SHARED_LIMIT_MESSAGE } : { ok: true };
}

// Batas chat per pengunjung: 20 pesan per hari WIB saat DEMO_MODE, dan 5 pesan per menit, plus batas bersama.
export async function checkChatLimit(db: AnyDb, cfg: AiConfig, hash: string, now: Date): Promise<LimitResult> {
  if (await globalCapReached(db, cfg, now)) return { ok: false, reason: "global", message: RESTING_MESSAGE };
  const shared = await checkSharedBuyerLimit(db, hash, now);
  if (!shared.ok) return shared;
  const base = and(eq(schema.aiLogs.visitorHash, hash), eq(schema.aiLogs.feature, "advisor"));
  const [[{ minute }], [{ day }]] = await Promise.all([
    db.select({ minute: count() }).from(schema.aiLogs).where(and(base, gt(schema.aiLogs.createdAt, new Date(now.getTime() - 60_000)))),
    db.select({ day: count() }).from(schema.aiLogs).where(and(base, gte(schema.aiLogs.createdAt, wibDayStart(now)))),
  ]);
  if (Number(minute) >= LIMITS.chatPerMinute) return { ok: false, reason: "menit", message: "Pelan-pelan, ya. Tunggu sebentar sebelum bertanya lagi." };
  if (cfg.demoMode && Number(day) >= LIMITS.chatPerDayDemo) return { ok: false, reason: "harian", message: `Kamu sudah bertanya ${LIMITS.chatPerDayDemo} kali hari ini. Coba lagi besok, ya. Kuis kulit dan rutinitas tetap bisa dipakai.` };
  return { ok: true };
}

// Batas harian per pengunjung untuk fitur foto dan link (berlaku juga di luar DEMO_MODE), plus batas global.
export async function checkDailyFeatureLimit(db: AnyDb, cfg: AiConfig, hash: string, feature: string, perDay: number, now: Date, label: string): Promise<LimitResult> {
  if (await globalCapReached(db, cfg, now)) return { ok: false, reason: "global", message: "Fitur AI sedang istirahat, coba lagi besok. Kamu tetap bisa mengisi kuis dan mencari produk seperti biasa." };
  if ((BUYER_AI_FEATURES as readonly string[]).includes(feature)) {
    const shared = await checkSharedBuyerLimit(db, hash, now);
    if (!shared.ok) return shared;
  }
  const [{ day }] = await db.select({ day: count() }).from(schema.aiLogs).where(and(eq(schema.aiLogs.visitorHash, hash), eq(schema.aiLogs.feature, feature), gte(schema.aiLogs.createdAt, wibDayStart(now))));
  if (Number(day) >= perDay) return { ok: false, reason: "harian", message: `Kamu sudah memakai ${label} ${perDay} kali hari ini. Coba lagi besok, ya.` };
  return { ok: true };
}

// ---------- Cache hasil AI ----------

export async function cacheGet<T>(db: AnyDb, key: string, now: Date): Promise<T | null> {
  const [row] = await db.select({ value: schema.aiCache.value }).from(schema.aiCache).where(and(eq(schema.aiCache.key, key), gt(schema.aiCache.expiresAt, now))).limit(1);
  return row ? (row.value as T) : null;
}

export async function cacheSet(db: AnyDb, key: string, feature: string, value: unknown, ttlDays: number, now: Date) {
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000);
  await db
    .insert(schema.aiCache)
    .values({ key, feature, value: value as object, createdAt: now, expiresAt })
    .onConflictDoUpdate({ target: schema.aiCache.key, set: { value: value as object, createdAt: now, expiresAt } });
}

export const shortHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 24);
