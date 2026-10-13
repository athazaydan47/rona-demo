// Profil pembeli: nama, email, profil kulit, dan ganti nomor WA (setelah OTP ke nomor baru).
import { and, eq, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { SkinProfile } from "@/db/schema/customers";
import type { AnyDb } from "@/lib/db-types";

export const SKIN_TYPES = ["normal", "kering", "berminyak", "kombinasi", "sensitif"] as const;
export const SKIN_CONCERNS = ["jerawat", "kusam", "pori", "penuaan", "dehidrasi"] as const;
export const UNDERTONES = ["warm", "neutral", "cool"] as const;
export const FINISHES = ["matte", "satin", "glowy"] as const;
export const SENSITIVITY = ["rendah", "sedang", "tinggi"] as const;

export async function getProfile(db: AnyDb, customerId: number) {
  const [c] = await db
    .select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone, email: schema.customers.email, points: schema.customers.points, skinProfile: schema.customers.skinProfile, registeredAt: schema.customers.registeredAt })
    .from(schema.customers)
    .where(eq(schema.customers.id, customerId))
    .limit(1);
  return c ?? null;
}

export function validateName(raw: string) {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return null;
  return name;
}

export async function updateProfile(db: AnyDb, customerId: number, input: { name: string; email?: string | null }) {
  const name = validateName(input.name);
  if (!name) return { ok: false as const, field: "name", message: "Nama 2 sampai 60 huruf, ya." };
  const email = (input.email ?? "").trim().toLowerCase();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120)) return { ok: false as const, field: "email", message: "Email tidak valid." };
  await db.update(schema.customers).set({ name, email: email || null }).where(eq(schema.customers.id, customerId));
  return { ok: true as const };
}

// Dipanggil hanya setelah OTP ke nomor baru terverifikasi.
export async function changePhone(db: AnyDb, customerId: number, newPhone: string) {
  const [taken] = await db.select({ id: schema.customers.id }).from(schema.customers).where(and(eq(schema.customers.phone, newPhone), ne(schema.customers.id, customerId))).limit(1);
  if (taken) return { ok: false as const, message: "Nomor ini sudah dipakai akun lain. Masuk dengan nomor itu bila itu milikmu." };
  await db.update(schema.customers).set({ phone: newPhone }).where(eq(schema.customers.id, customerId));
  return { ok: true as const };
}

const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined);

// Bersihkan masukan formulir menjadi SkinProfile yang sah (nilai di luar daftar dibuang).
export function sanitizeSkinProfile(raw: Record<string, unknown>, source: SkinProfile["source"], now: Date): SkinProfile {
  const concerns = Array.isArray(raw.concerns) ? [...new Set(raw.concerns.map((c) => pick(SKIN_CONCERNS, c)).filter((c): c is (typeof SKIN_CONCERNS)[number] => Boolean(c)))] : [];
  const depth = Number(raw.depth);
  const budget = Number(raw.budget);
  const out: SkinProfile = {
    skinType: pick(SKIN_TYPES, raw.skinType),
    concerns,
    sensitivity: pick(SENSITIVITY, raw.sensitivity),
    undertone: pick(UNDERTONES, raw.undertone),
    depth: Number.isInteger(depth) && depth >= 1 && depth <= 6 ? depth : undefined,
    finish: pick(FINISHES, raw.finish),
    budget: Number.isInteger(budget) && budget > 0 && budget <= 5_000_000 ? budget : undefined,
    routine: typeof raw.routine === "string" ? raw.routine.trim().slice(0, 300) || undefined : undefined,
    source,
    updatedAt: now.toISOString(),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as SkinProfile;
}

export async function saveSkinProfile(db: AnyDb, customerId: number, profile: SkinProfile) {
  await db.update(schema.customers).set({ skinProfile: profile }).where(eq(schema.customers.id, customerId));
}
