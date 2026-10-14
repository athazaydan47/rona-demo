"use server";

// Aksi masuk, keluar, dan status akun. Identitas selalu dari cookie sesi; nomor WA dari isian hanya dipakai
// untuk meminta dan memeriksa OTP. OTP, token sesi, dan nomor WA lengkap tidak pernah dicatat di log.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { DEMO_BUYER_PHONE } from "@/lib/account/demo";
import { claimGuestOrders, completeLogin } from "@/lib/account/login";
import { unreadCount } from "@/lib/account/notifications";
import { changePhone, updateProfile, validateName } from "@/lib/account/profile";
import { CART_COOKIE } from "@/lib/cart/cookie";
import { now } from "@/lib/clock";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/orders/rules";
import { currentCustomer, clearSessionCookie, setSessionCookie } from "./current";
import { adoptGuestProfile } from "@/lib/skin/current";
import { otpSender, requestOtp, verifyOtp, type OtpPurpose } from "./otp";
import { authSecret } from "./secret";
import { revokeAllSessions, revokeSession, SESSION_COOKIE } from "./session";

export type LoginAvailability = { available: boolean; demo: boolean };

export async function loginAvailability(): Promise<LoginAvailability> {
  const sender = otpSender(env.demoMode);
  return { available: sender.available && authSecret() != null, demo: env.demoMode };
}

// Hanya jalur relatif di situs ini yang boleh jadi tujuan kembali (cegah open redirect).
function safeReturn(raw: unknown) {
  const v = typeof raw === "string" ? raw : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 300) return "/akun";
  if (v.startsWith("/masuk")) return "/akun";
  return v;
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

const maskPhone = (phone: string) => `${phone.slice(0, 4)}••••${phone.slice(-3)}`;

export type RequestOtpResponse =
  | { ok: true; phone: string; masked: string; expiresAt: string; resendAt: string; demoCode: string | null }
  | { ok: false; message: string; retryAfterSec?: number; unavailable?: boolean };

async function sendOtp(phoneRaw: string, purpose: OtpPurpose, customerId: number | null): Promise<RequestOtpResponse> {
  const sender = otpSender(env.demoMode);
  const secret = authSecret();
  if (!sender.available || !secret) return { ok: false, unavailable: true, message: "Masuk dengan WhatsApp belum tersedia di situs ini." };
  const phone = normalizePhone(String(phoneRaw ?? ""));
  if (!phone) return { ok: false, message: "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890." };
  const at = now();
  // Untuk masuk, kode dikaitkan ke akun bila ada supaya muncul di Kotak Notifikasinya. Jawaban ke browser sama persis.
  let ownerId = customerId;
  if (purpose === "masuk") {
    const [c] = await db.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.phone, phone)).limit(1);
    ownerId = c?.id ?? null;
  }
  const r = await requestOtp(db, { phone, purpose, secret, ip: await clientIp(), customerId: ownerId, now: at });
  if (!r.ok) return { ok: false, message: r.message, retryAfterSec: r.retryAfterSec };
  const delivery = await sender.send(db, { phone, code: r.code, customerId: ownerId, purpose, now: at });
  return { ok: true, phone, masked: maskPhone(phone), expiresAt: r.expiresAt.toISOString(), resendAt: r.resendAt.toISOString(), demoCode: env.demoMode ? delivery.showOnScreen : null };
}

export async function requestLoginOtpAction(input: { phone: string }): Promise<RequestOtpResponse> {
  return sendOtp(input?.phone, "masuk", null);
}

export type LoginResponse = { ok: true; needsName: boolean; redirectTo: string } | { ok: false; message: string };

async function finishLogin(phone: string, kembali: unknown, guestWishlist: unknown): Promise<LoginResponse> {
  const jar = await cookies();
  const h = await headers();
  // Sesi lama di perangkat ini dicabut dulu supaya tidak ada dua sesi menggantung.
  const old = jar.get(SESSION_COOKIE)?.value;
  if (old) await revokeSession(db, old, now());
  const outcome = await completeLogin(db, { phone, now: now(), guestCartToken: jar.get(CART_COOKIE)?.value ?? null, guestWishlist, userAgent: h.get("user-agent") ?? "" });
  await setSessionCookie(outcome.token);
  jar.delete(CART_COOKIE);
  await adoptGuestProfile(outcome.customerId);
  return { ok: true, needsName: outcome.needsName, redirectTo: safeReturn(kembali) };
}

export async function verifyLoginOtpAction(input: { phone: string; code: string; kembali?: string; guestWishlist?: number[] }): Promise<LoginResponse> {
  const secret = authSecret();
  if (!otpSender(env.demoMode).available || !secret) return { ok: false, message: "Masuk dengan WhatsApp belum tersedia di situs ini." };
  const phone = normalizePhone(String(input?.phone ?? ""));
  if (!phone) return { ok: false, message: "Nomor WhatsApp tidak valid." };
  const v = await verifyOtp(db, { phone, purpose: "masuk", code: String(input?.code ?? ""), secret, now: now() });
  if (!v.ok) return { ok: false, message: v.message };
  return finishLogin(phone, input?.kembali, input?.guestWishlist);
}

// Akun demo tanpa OTP. Hanya ada saat DEMO_MODE=true.
export async function demoLoginAction(input: { kembali?: string; guestWishlist?: number[] }): Promise<LoginResponse> {
  if (!env.demoMode) return { ok: false, message: "Akun demo tidak tersedia." };
  // Akun demo harus dari seed (berisi pesanan, poin, alamat). Jangan buat akun kosong diam-diam.
  const [demo] = await db.select({ name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.phone, DEMO_BUYER_PHONE)).limit(1);
  if (!demo?.name) return { ok: false, message: "Akun demo belum disiapkan di database ini. Jalankan seed demo dulu." };
  return finishLogin(DEMO_BUYER_PHONE, input?.kembali, input?.guestWishlist);
}

export async function setNameAction(input: { name: string }): Promise<{ ok: boolean; message?: string }> {
  const me = await currentCustomer();
  if (!me) return { ok: false, message: "Sesi berakhir. Masuk lagi, ya." };
  if (!validateName(input?.name ?? "")) return { ok: false, message: "Nama 2 sampai 60 huruf, ya." };
  const r = await updateProfile(db, me.customerId, { name: input.name, email: me.email });
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(db, token, now());
  await clearSessionCookie();
  redirect("/");
}

export async function logoutAllAction() {
  const me = await currentCustomer();
  if (me) await revokeAllSessions(db, me.customerId, now());
  await clearSessionCookie();
  redirect("/masuk?keluar=semua");
}

export type AccountStatus = { loggedIn: boolean; firstName: string | null; unread: number };

export async function accountStatusAction(): Promise<AccountStatus> {
  const me = await currentCustomer();
  if (!me) return { loggedIn: false, firstName: null, unread: 0 };
  return { loggedIn: true, firstName: me.name.split(" ")[0] || null, unread: await unreadCount(db, me.customerId) };
}

// Ganti nomor WA: OTP dikirim ke nomor BARU, akun berubah hanya setelah kode benar.
export async function requestPhoneChangeOtpAction(input: { phone: string }): Promise<RequestOtpResponse> {
  const me = await currentCustomer();
  if (!me) return { ok: false, message: "Sesi berakhir. Masuk lagi, ya." };
  const phone = normalizePhone(String(input?.phone ?? ""));
  if (phone && phone === me.phone) return { ok: false, message: "Itu nomormu sekarang. Tulis nomor yang baru." };
  return sendOtp(input?.phone, "ganti_nomor", me.customerId);
}

export async function verifyPhoneChangeAction(input: { phone: string; code: string }): Promise<{ ok: boolean; message?: string }> {
  const me = await currentCustomer();
  const secret = authSecret();
  if (!me || !secret) return { ok: false, message: "Sesi berakhir. Masuk lagi, ya." };
  const phone = normalizePhone(String(input?.phone ?? ""));
  if (!phone) return { ok: false, message: "Nomor WhatsApp tidak valid." };
  const v = await verifyOtp(db, { phone, purpose: "ganti_nomor", code: String(input?.code ?? ""), secret, now: now(), customerId: me.customerId });
  if (!v.ok) return { ok: false, message: v.message };
  const r = await changePhone(db, me.customerId, phone);
  if (!r.ok) return { ok: false, message: r.message };
  await claimGuestOrders(db, me.customerId, phone, now());
  return { ok: true };
}
