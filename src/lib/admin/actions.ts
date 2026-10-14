"use server";

// Server action panel admin. Identitas staf hanya dari cookie sesi staf; setiap aksi memeriksa izin dengan can()
// di modul layanannya (UI yang menyembunyikan tombol hanya pelengkap).
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { authSecret } from "@/lib/auth/secret";
import { hashIp } from "@/lib/auth/otp";
import { now } from "@/lib/clock";
import { dailyResetOn, demoModeOn, assertManualResetAllowed, DemoResetError, resetDemoData } from "@/lib/demo/reset";
import { env } from "@/lib/env";
import { revalidateProducts } from "@/lib/orders/revalidate";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { siteUrl } from "@/lib/site";
import { writeAudit } from "./audit";
import { attemptStaffLogin, finishStaffLogin, normalizeEmail, revokeStaffSession, STAFF_COOKIE } from "./auth";
import { currentStaff, staffCookieOptions } from "./current";
import { dashboardData } from "./dashboard";
import { changeOrderStatus, processSelected } from "./orders";
import { can } from "./permissions";
import { adminSearch } from "./search";
import { createStaff, isDemoStaffEmail, resetStaffPassword, setStaffActive, updateStaff } from "./staff";
import { receiveStock, searchVariants, submitOpname, transferStock } from "./stock";
import { scheduleEmailDispatch } from "@/lib/email/schedule";
import { MEREK } from "@/config/merek";
import { cocok, daftarId, skema } from "@/lib/validasi";

const DENIED = { ok: false as const, message: "Sesi staf berakhir. Masuk lagi, ya." };

function safeReturn(raw: unknown) {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/admin") && !v.startsWith("/admin/masuk") && !v.includes("//") && v.length < 300 ? v : "/admin";
}

async function requestMeta() {
  const h = await headers();
  return { ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64), userAgent: h.get("user-agent") ?? "" };
}

async function setCookie(token: string, expiresAt: Date) {
  (await cookies()).set(STAFF_COOKIE, token, staffCookieOptions(expiresAt));
}

export type LoginResponse = { ok: true; redirectTo: string } | { ok: false; message: string };

export async function staffLoginAction(raw: { email: string; password: string; kembali?: string }): Promise<LoginResponse> {
  const input = cocok(skema.masukStaf, raw);
  if (!input) return { ok: false, message: "Email atau kata sandi salah." };
  const secret = authSecret();
  if (!secret) return { ok: false, message: "Masuk staf belum tersedia: SESSION_SECRET belum diisi." };
  const meta = await requestMeta();
  const r = await attemptStaffLogin(db, { email: String(input?.email ?? ""), password: String(input?.password ?? ""), ip: meta.ip, secret, now: now(), userAgent: meta.userAgent });
  if (!r.ok) return { ok: false, message: r.message };
  await setCookie(r.token, r.expiresAt);
  return { ok: true, redirectTo: safeReturn(input?.kembali) };
}

// Masuk cepat akun demo tanpa kata sandi. Hanya ada dan hanya berfungsi saat DEMO_MODE=true.
export async function demoStaffLoginAction(raw: { email: string; kembali?: string }): Promise<LoginResponse> {
  if (!env.demoMode) return { ok: false, message: "Masuk cepat hanya tersedia di mode demo." };
  const input = cocok(skema.masukStafDemo, raw);
  if (!input) return { ok: false, message: "Akun demo tidak dikenal." };
  const email = normalizeEmail(input?.email ?? "");
  if (!isDemoStaffEmail(email)) return { ok: false, message: "Akun demo tidak dikenal." };
  const [s] = await db.select({ id: schema.staff.id, name: schema.staff.name, isActive: schema.staff.isActive }).from(schema.staff).where(eq(schema.staff.email, email)).limit(1);
  if (!s || !s.isActive) return { ok: false, message: "Akun demo belum disiapkan di database ini. Jalankan seed demo dulu." };
  const meta = await requestMeta();
  const r = await finishStaffLogin(db, s, { email, ipHash: hashIp(authSecret() ?? MEREK.kunci, meta.ip), now: now(), userAgent: meta.userAgent, via: "tombol akun demo" });
  if (!r.ok) return { ok: false, message: r.message };
  await setCookie(r.token, r.expiresAt);
  return { ok: true, redirectTo: safeReturn(input?.kembali) };
}

export async function staffLogoutAction() {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  const me = await currentStaff();
  if (token) await revokeStaffSession(db, token, now());
  if (me) await writeAudit(db, { staff: me, action: "staf.keluar", objectType: "staf", objectId: me.id, at: now() });
  jar.delete(STAFF_COOKIE);
  redirect("/admin/masuk");
}

export async function dashboardAction() {
  const me = await currentStaff();
  if (!me) return null;
  return dashboardData(db, me, now());
}

export async function adminSearchAction(q: string) {
  const me = await currentStaff();
  if (!me) return [];
  return adminSearch(db, me, String(q ?? ""));
}

const statusSchema = z.object({
  number: z.string().max(30),
  from: z.enum(ORDER_STATUSES),
  to: z.enum(ORDER_STATUSES),
  reason: z.string().max(300).nullable().optional(),
  trackingNumber: z.string().max(40).nullable().optional(),
  courierName: z.string().max(40).nullable().optional(),
});

export async function changeOrderStatusAction(raw: z.input<typeof statusSchema>) {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const me = await currentStaff();
  if (!me) return DENIED;
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Data tidak valid." };
  const r = await changeOrderStatus(db, me, { ...parsed.data, number: parsed.data.number.trim().toUpperCase(), now: now(), siteUrl: siteUrl() });
  if (r.ok) await revalidateProducts(r.productIds);
  return r;
}

export async function processOrdersAction(numbers: string[]) {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const me = await currentStaff();
  if (!me) return DENIED;
  const list = cocok(skema.nomorPesananList, numbers);
  if (!list) return { ok: false as const, message: "Pilih pesanan dulu." };
  const results = await processSelected(db, me, list, { now: now(), siteUrl: siteUrl() });
  return { ok: true as const, results };
}

export async function searchVariantsAction(q: string) {
  const me = await currentStaff();
  if (!me || !can(me, "stok.lihat")) return [];
  return searchVariants(db, String(q ?? ""));
}

// Stok tersedia per lokasi (yang boleh dilihat) untuk varian di formulir stok.
export async function variantAvailabilityAction(variantIds: number[]) {
  const me = await currentStaff();
  const parsed = cocok(daftarId(60), variantIds);
  if (!me || !can(me, "stok.lihat") || !parsed) return {};
  const ids = parsed;
  if (!ids.length) return {};
  const rows = await db.select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved }).from(schema.inventory).where(inArray(schema.inventory.variantId, ids));
  const out: Record<number, Record<number, number>> = {};
  for (const r of rows) {
    if (!can(me, "stok.lihat", { lokasiId: r.locationId })) continue;
    (out[r.variantId] ??= {})[r.locationId] = Math.max(0, r.onHand - r.reserved);
  }
  return out;
}

const linesSchema = z.array(z.object({ variantId: z.number().int(), quantity: z.number().int() })).max(60);

export async function receiveStockAction(raw: { locationId: number; lines: { variantId: number; quantity: number }[]; reference?: string; note?: string }) {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const me = await currentStaff();
  if (!me) return DENIED;
  const lines = linesSchema.safeParse(raw?.lines);
  if (!lines.success || !Number.isInteger(raw?.locationId)) return { ok: false as const, message: "Data tidak valid." };
  const r = await receiveStock(db, me, { locationId: raw.locationId, lines: lines.data, reference: raw.reference, note: raw.note, now: now() });
  if (r.ok) await revalidateProducts(r.productIds);
  return r;
}

export async function transferStockAction(raw: { fromId: number; toId: number; lines: { variantId: number; quantity: number }[]; note?: string }) {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const me = await currentStaff();
  if (!me) return DENIED;
  const lines = linesSchema.safeParse(raw?.lines);
  if (!lines.success || !Number.isInteger(raw?.fromId) || !Number.isInteger(raw?.toId)) return { ok: false as const, message: "Data tidak valid." };
  const r = await transferStock(db, me, { fromId: raw.fromId, toId: raw.toId, lines: lines.data, note: raw.note, now: now() });
  if (r.ok) await revalidateProducts(r.productIds);
  return r;
}

export async function submitOpnameAction(raw: { locationId: number; counts: { variantId: number; counted: number }[]; note?: string }) {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const me = await currentStaff();
  if (!me) return DENIED;
  const counts = z.array(z.object({ variantId: z.number().int(), counted: z.number().int() })).max(300).safeParse(raw?.counts);
  if (!counts.success || !Number.isInteger(raw?.locationId)) return { ok: false as const, message: "Data tidak valid." };
  const r = await submitOpname(db, me, { locationId: raw.locationId, counts: counts.data, note: raw.note, now: now() });
  if (r.ok) await revalidateProducts(r.productIds);
  return r;
}

const staffSchema = z.object({
  name: z.string().max(80),
  email: z.string().max(120),
  roleSlug: z.string().max(30),
  locationIds: z.array(z.number().int()).max(20),
  grants: z.array(z.string().max(40)).max(40),
  revokes: z.array(z.string().max(40)).max(40),
  password: z.string().max(200).optional(),
});

export async function saveStaffAction(id: number | null, raw: z.input<typeof staffSchema>) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const parsed = staffSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Data tidak valid." };
  return id == null ? createStaff(db, me, parsed.data, { now: now() }) : updateStaff(db, me, id, parsed.data, { demoMode: env.demoMode, now: now() });
}

export async function setStaffActiveAction(id: number, active: boolean) {
  const me = await currentStaff();
  if (!me) return DENIED;
  return setStaffActive(db, me, Number(id), Boolean(active), { demoMode: env.demoMode, now: now() });
}

export async function resetStaffPasswordAction(id: number, password: string) {
  const me = await currentStaff();
  if (!me) return DENIED;
  return resetStaffPassword(db, me, Number(id), String(password ?? ""), { demoMode: env.demoMode, now: now() });
}

// Tombol Owner "Reset data demo sekarang". Hanya saat DEMO_MODE=true, dengan izin demo.reset, sekali per 5 menit.
export async function resetDemoNowAction(confirmText: string): Promise<{ ok: false; message: string } | never> {
  const me = await currentStaff();
  if (!me) return DENIED;
  if (!demoModeOn(process.env)) return { ok: false, message: "Reset data demo hanya tersedia di mode demo." };
  if (!can(me, "demo.reset")) return { ok: false, message: "Kamu tidak punya izin mereset data demo." };
  if (String(confirmText ?? "").trim().toUpperCase() !== "RESET") return { ok: false, message: "Ketik RESET untuk konfirmasi." };
  try {
    await assertManualResetAllowed(db, now());
    await resetDemoData(db, { source: "owner", actor: { id: me.id, name: me.name }, now: now() });
  } catch (e) {
    if (e instanceof DemoResetError) return { ok: false, message: e.message };
    throw e;
  }
  // Semua sesi ikut terhapus oleh reset, jadi Owner diarahkan masuk lagi.
  (await cookies()).delete(STAFF_COOKIE);
  redirect("/admin/masuk?reset=1");
}

export async function demoResetInfoAction() {
  return { demoMode: demoModeOn(process.env), daily: dailyResetOn(process.env) };
}
