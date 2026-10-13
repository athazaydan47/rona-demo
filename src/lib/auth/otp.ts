// OTP masuk: 6 digit, disimpan sebagai HMAC, berlaku 5 menit, sekali pakai, maksimal 5 kali salah per kode.
// Rate limit dihitung dari tabel otp_codes (aman untuk serverless): kirim ulang paling cepat 60 detik,
// maksimal 3 per nomor per 10 menit, 10 per nomor per hari, 10 per IP per 10 menit, 30 per IP per hari.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 60_000;
export const LIMITS = { phone10m: 3, phoneDay: 10, ip10m: 10, ipDay: 30 } as const;

export type OtpPurpose = "masuk" | "ganti_nomor";

export function hashOtp(secret: string, phone: string, code: string) {
  return createHmac("sha256", secret).update(`otp:${phone}:${code}`).digest("hex");
}

export function hashIp(secret: string, ip: string) {
  return ip ? createHmac("sha256", secret).update(`ip:${ip}`).digest("hex").slice(0, 32) : "";
}

export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type RequestOtpResult = { ok: true; code: string; expiresAt: Date; resendAt: Date } | { ok: false; message: string; retryAfterSec?: number };

// Membuat kode baru bila rate limit mengizinkan. Pesan tidak pernah membedakan nomor terdaftar atau belum.
export async function requestOtp(db: AnyDb, input: { phone: string; purpose: OtpPurpose; secret: string; ip?: string; customerId?: number | null; now: Date; code?: string }): Promise<RequestOtpResult> {
  const { phone, now } = input;
  const ipHash = hashIp(input.secret, input.ip ?? "");
  const since10 = new Date(now.getTime() - 10 * 60_000);
  const sinceDay = new Date(now.getTime() - 24 * 60 * 60_000);
  const [last] = await db.select({ createdAt: schema.otpCodes.createdAt }).from(schema.otpCodes).where(eq(schema.otpCodes.phone, phone)).orderBy(desc(schema.otpCodes.createdAt)).limit(1);
  if (last && now.getTime() - last.createdAt.getTime() < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (now.getTime() - last.createdAt.getTime())) / 1000);
    return { ok: false, message: `Tunggu ${wait} detik sebelum minta kode lagi.`, retryAfterSec: wait };
  }
  const count = async (cond: ReturnType<typeof and>) => {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.otpCodes).where(cond);
    return Number(r?.n ?? 0);
  };
  if ((await count(and(eq(schema.otpCodes.phone, phone), gt(schema.otpCodes.createdAt, since10)))) >= LIMITS.phone10m) {
    return { ok: false, message: "Terlalu banyak permintaan kode. Coba lagi dalam 10 menit.", retryAfterSec: 600 };
  }
  if ((await count(and(eq(schema.otpCodes.phone, phone), gt(schema.otpCodes.createdAt, sinceDay)))) >= LIMITS.phoneDay) {
    return { ok: false, message: "Batas permintaan kode hari ini sudah tercapai. Coba lagi besok.", retryAfterSec: 86_400 };
  }
  if (ipHash) {
    if ((await count(and(eq(schema.otpCodes.ipHash, ipHash), gt(schema.otpCodes.createdAt, since10)))) >= LIMITS.ip10m) {
      return { ok: false, message: "Terlalu banyak permintaan dari jaringan ini. Coba lagi dalam 10 menit.", retryAfterSec: 600 };
    }
    if ((await count(and(eq(schema.otpCodes.ipHash, ipHash), gt(schema.otpCodes.createdAt, sinceDay)))) >= LIMITS.ipDay) {
      return { ok: false, message: "Terlalu banyak permintaan dari jaringan ini hari ini.", retryAfterSec: 86_400 };
    }
  }
  const code = input.code ?? generateCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  await db.insert(schema.otpCodes).values({ phone, purpose: input.purpose, customerId: input.customerId ?? null, codeHash: hashOtp(input.secret, phone, code), ipHash, expiresAt, createdAt: now });
  return { ok: true, code, expiresAt, resendAt: new Date(now.getTime() + OTP_RESEND_MS) };
}

export type VerifyOtpResult = { ok: true } | { ok: false; message: string; remaining?: number };

const GENERIC = "Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu.";

// Memeriksa kode terbaru yang belum dipakai untuk nomor dan tujuan ini.
export async function verifyOtp(db: AnyDb, input: { phone: string; purpose: OtpPurpose; code: string; secret: string; now: Date; customerId?: number | null }): Promise<VerifyOtpResult> {
  const code = input.code.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, message: "Kode terdiri dari 6 angka." };
  return db.transaction(async (tx) => {
    const conds = [eq(schema.otpCodes.phone, input.phone), eq(schema.otpCodes.purpose, input.purpose), isNull(schema.otpCodes.consumedAt)];
    if (input.purpose === "ganti_nomor") conds.push(eq(schema.otpCodes.customerId, input.customerId ?? -1));
    const [row] = await tx
      .select()
      .from(schema.otpCodes)
      .where(and(...conds))
      .orderBy(desc(schema.otpCodes.createdAt))
      .limit(1)
      .for("update");
    if (!row || row.expiresAt.getTime() <= input.now.getTime()) return { ok: false as const, message: GENERIC };
    if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false as const, message: "Terlalu banyak percobaan salah. Minta kode baru." };
    const expected = Buffer.from(row.codeHash, "hex");
    const given = Buffer.from(hashOtp(input.secret, input.phone, code), "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      const attempts = row.attempts + 1;
      await tx.update(schema.otpCodes).set({ attempts }).where(eq(schema.otpCodes.id, row.id));
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      return { ok: false as const, message: remaining > 0 ? `Kode salah. Sisa ${remaining} percobaan.` : "Terlalu banyak percobaan salah. Minta kode baru.", remaining };
    }
    await tx.update(schema.otpCodes).set({ consumedAt: input.now }).where(eq(schema.otpCodes.id, row.id));
    return { ok: true as const };
  });
}

// Pengirim OTP lewat adapter. Demo: kode ditampilkan di layar dan masuk Kotak Notifikasi (tabel notifications).
export type OtpDelivery = { delivered: boolean; showOnScreen: string | null };
export interface OtpSender {
  readonly available: boolean;
  send(db: AnyDb, input: { phone: string; code: string; customerId: number | null; purpose: OtpPurpose; now: Date }): Promise<OtpDelivery>;
}

export const demoOtpSender: OtpSender = {
  available: true,
  async send(db, input) {
    await db.insert(schema.notifications).values({
      customerId: input.customerId,
      kind: "otp",
      channel: "wa",
      recipient: input.phone,
      subject: "Kode masuk Rona",
      body: `Kode ${input.purpose === "ganti_nomor" ? "verifikasi nomor baru" : "masuk"} Rona Beauty: ${input.code}. Berlaku 5 menit. Jangan berikan kode ini ke siapa pun, termasuk tim Rona.`,
      status: "terkirim",
      createdAt: input.now,
      sentAt: input.now,
    });
    return { delivered: true, showOnScreen: input.code };
  },
};

// Belum ada adapter WhatsApp Business sungguhan: di luar mode demo, masuk dinonaktifkan.
export const unavailableOtpSender: OtpSender = {
  available: false,
  async send() {
    return { delivered: false, showOnScreen: null };
  },
};

export function otpSender(demoMode: boolean): OtpSender {
  return demoMode ? demoOtpSender : unavailableOtpSender;
}
