// Pembatas laju (Fase 8B). Dua lapis:
// - rateLimit(db, ...): jendela tetap di Postgres (tabel rate_limits), berlaku di semua instance. Untuk aksi yang
//   rawan ditebak atau mahal: lacak pesanan, unggah foto, tafsiran AI.
// - limitByKey(...): di memori per instance, untuk hal ringan yang boleh lolos sedikit (laporan CSP, saran pencarian).
// Kunci tidak boleh berisi data pribadi mentah: pakai hash (hashKey) untuk IP atau nomor.
import { createHmac } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export type RateLimitResult = { ok: boolean; hits: number; limit: number; retryAfterSec: number };

// Lewat query builder (bukan SQL mentah) supaya Date diserialisasi sesuai tipe kolom timestamptz.
const jendela = (now: Date, windowMs: number) => new Date(Math.floor(now.getTime() / windowMs) * windowMs);

export async function rateLimit(db: AnyDb, key: string, limit: number, windowMs: number, now = new Date()): Promise<RateLimitResult> {
  const start = jendela(now, windowMs);
  const rows = await db
    .insert(schema.rateLimits)
    .values({ key: key.slice(0, 200), windowStart: start, hits: 1 })
    .onConflictDoUpdate({ target: [schema.rateLimits.key, schema.rateLimits.windowStart], set: { hits: sql`${schema.rateLimits.hits} + 1` } })
    .returning({ hits: schema.rateLimits.hits });
  const hits = Number(rows[0]?.hits ?? 1);
  return { ok: hits <= limit, hits, limit, retryAfterSec: Math.max(1, Math.ceil((start.getTime() + windowMs - now.getTime()) / 1000)) };
}

// Jumlah hit di jendela berjalan tanpa menambahnya, untuk penjaga yang hanya menghitung kegagalan (kode voucher salah).
export async function hitSaatIni(db: AnyDb, key: string, windowMs: number, now = new Date()) {
  const [row] = await db
    .select({ hits: schema.rateLimits.hits })
    .from(schema.rateLimits)
    .where(and(eq(schema.rateLimits.key, key.slice(0, 200)), eq(schema.rateLimits.windowStart, jendela(now, windowMs))));
  return Number(row?.hits ?? 0);
}

// Hapus jendela yang sudah lewat (dipanggil cron harian).
export async function cleanRateLimits(db: AnyDb, now = new Date(), keepMs = 2 * 86_400_000) {
  const r = await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, new Date(now.getTime() - keepMs))).returning({ key: schema.rateLimits.key });
  return r.length;
}

// Hash kunci (IP, nomor WA) dengan rahasia server supaya tabel tidak menyimpan data pribadi.
export function hashKey(value: string, secret = process.env.SESSION_SECRET ?? "dev-rate-limit") {
  return createHmac("sha256", secret).update(value).digest("hex").slice(0, 24);
}

// IP klien dari header proxy Vercel. Di lokal tanpa header, semua dianggap satu klien "lokal".
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "lokal";
}

const memori = new Map<string, { start: number; hits: number }>();
export function limitByKey(key: string, limit: number, windowMs: number, now = Date.now()) {
  const cur = memori.get(key);
  if (!cur || now - cur.start >= windowMs) {
    memori.set(key, { start: now, hits: 1 });
    if (memori.size > 5000) for (const [k, v] of memori) if (now - v.start >= windowMs) memori.delete(k);
    return true;
  }
  cur.hits += 1;
  return cur.hits <= limit;
}

// Batas yang dipakai di aplikasi (satu tempat, juga tabel di docs/KEAMANAN.md).
export const BATAS = {
  lacakPerIp: { limit: 10, windowMs: 10 * 60_000 },
  lacakPerNomor: { limit: 5, windowMs: 10 * 60_000 },
  fotoUlasanPerPembeli: { limit: 20, windowMs: 60 * 60_000 },
  fotoAdminPerStaf: { limit: 60, windowMs: 60 * 60_000 },
  tafsirShadePerPengunjung: { limit: 20, windowMs: 86_400_000 },
  saranCariPerIp: { limit: 120, windowMs: 60_000 },
  katalogPerIp: { limit: 120, windowMs: 60_000 },
  cspPerIp: { limit: 30, windowMs: 60_000 },
  galatKlienPerIp: { limit: 20, windowMs: 60_000 },
  // Hitung ulang checkout (ongkir, harga, voucher): di memori per instance, cukup longgar untuk pembeli biasa.
  ongkirPerIp: { limit: 120, windowMs: 60_000 },
  // Kode voucher berbeda yang salah per IP. Setelah batas, voucher tidak diperiksa sama sekali sampai jendela berakhir,
  // jadi kode yang benar pun tidak bisa dikonfirmasi lewat tebakan.
  voucherSalahPerIp: { limit: 15, windowMs: 10 * 60_000 },
} as const;
