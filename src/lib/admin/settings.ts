// Pengaturan toko di panel admin: profil, operasional, dan cabang. Disimpan di tabel settings dan locations,
// dicatat di log dengan data sebelum dan sesudah, lalu tag cache "settings" dan "locations" direvalidasi.
import { asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { OpeningHours } from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { clockMinutes, isClock, normalizeSettings, PAYMENT_METHOD_KEYS, settingsRows, SHIPPING_COURIERS, ZONES, type StoreSettings } from "@/lib/settings";
import { loadSettings } from "@/lib/settings/db";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";

const DENIED = { ok: false as const, message: "Kamu tidak punya izin mengelola pengaturan." };
export const DAY_KEYS: (keyof OpeningHours)[] = ["sen", "sel", "rab", "kam", "jum", "sab", "min"];
export const DAY_LABELS: Record<keyof OpeningHours, string> = { sen: "Senin", sel: "Selasa", rab: "Rabu", kam: "Kamis", jum: "Jumat", sab: "Sabtu", min: "Minggu" };

// Validasi murni pengaturan operasional.
export function validateSettings(s: StoreSettings): string | null {
  if (s.profile.name.trim().length < 2) return "Isi nama toko.";
  if (!/^62\d{8,13}$/.test(s.profile.whatsapp)) return "Nomor WA toko diawali 62, misal 6281234567890.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.profile.email)) return "Email toko tidak valid.";
  if (!isClock(s.cutoff.ship) || !isClock(s.cutoff.pickup)) return "Cut-off memakai format 15.00.";
  if (!Number.isInteger(s.instant.open) || !Number.isInteger(s.instant.close) || s.instant.open < 0 || s.instant.close > 24 || s.instant.open >= s.instant.close) return "Jam kurir instan tidak valid.";
  if (!s.couriers.active.length) return "Aktifkan minimal satu kurir atau Ambil di Toko.";
  for (const code of SHIPPING_COURIERS)
    for (const z of ZONES) {
      const r = s.couriers.rates[code]?.[z];
      if (r != null && (!Number.isInteger(r) || r < 0 || r > 1_000_000)) return "Tarif per kg harus angka bulat 0 sampai 1.000.000.";
    }
  if (!s.payments.length || s.payments.some((p) => !PAYMENT_METHOD_KEYS.includes(p))) return "Aktifkan minimal satu metode bayar.";
  if (!Number.isInteger(s.lowStock) || s.lowStock < 0 || s.lowStock > 1000) return "Ambang stok menipis 0 sampai 1.000.";
  if (!Number.isInteger(s.freeShipping.threshold) || s.freeShipping.threshold < 0) return "Batas gratis ongkir tidak valid.";
  if (!Number.isInteger(s.freeShipping.cap) || s.freeShipping.cap < 0) return "Nilai gratis ongkir tidak valid.";
  return null;
}

const diff = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      before[k] = a[k];
      after[k] = b[k];
    }
  }
  return { before, after };
};

export async function saveSettings(db: AnyDb, staff: StaffPrincipal, input: StoreSettings, opts: { now?: Date } = {}) {
  if (!can(staff, "pengaturan.kelola")) return DENIED;
  const current = await loadSettings(db);
  // Normalisasi ulang supaya nilai di luar bentuk yang dikenal dibuang. PromoBar (diatur di halaman Promo) dan versi seed
  // tidak ikut diubah dari formulir pengaturan.
  // Validasi isian asli dulu supaya nilai salah tidak diam-diam diganti nilai bawaan oleh normalisasi.
  let err: string | null;
  try {
    err = validateSettings(input);
  } catch {
    err = "Data pengaturan tidak lengkap.";
  }
  if (err) return { ok: false as const, message: err };
  const next = { ...normalizeSettings(settingsRows(input)), promoBar: current.promoBar, seedVersion: current.seedVersion };
  err = validateSettings(next);
  if (err) return { ok: false as const, message: err };
  const rowsBefore = settingsRows(current);
  const rowsAfter = settingsRows(next);
  const d = diff(rowsBefore, rowsAfter);
  if (!Object.keys(d.after).length) return { ok: true as const, changed: 0 };
  const at = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(d.after)) {
      await tx.insert(schema.settings).values({ key, value: value as object, updatedAt: at }).onConflictDoUpdate({ target: schema.settings.key, set: { value: value as object, updatedAt: at } });
    }
    await writeAudit(tx, { staff, action: "pengaturan.ubah", objectType: "pengaturan", objectId: Object.keys(d.after).join(","), summary: `Ubah pengaturan: ${Object.keys(d.after).join(", ")}`, before: d.before, after: d.after, at });
  });
  return { ok: true as const, changed: Object.keys(d.after).length };
}

export type LocationForm = { address: string; district: string; city: string; phone: string; lat: number | null; lng: number | null; openingHours: OpeningHours; closedDates: string[]; canPickup: boolean };

// Label jam buka ringkas untuk toko: "09.00 sampai 21.00" bila sama setiap hari buka.
export function hoursLabel(h: OpeningHours) {
  const open = DAY_KEYS.map((k) => h[k]).filter((x): x is { open: string; close: string } => Boolean(x));
  if (!open.length) return "Tutup";
  const same = open.every((x) => x.open === open[0].open && x.close === open[0].close);
  return same ? `${open[0].open} sampai ${open[0].close}` : `${open[0].open} sampai ${open[0].close} (bervariasi)`;
}

export function validateLocation(f: LocationForm): string | null {
  if ((f.address ?? "").trim().length < 5) return "Isi alamat cabang.";
  if (f.lat != null && (Math.abs(f.lat) > 90 || Number.isNaN(f.lat))) return "Lintang tidak valid.";
  if (f.lng != null && (Math.abs(f.lng) > 180 || Number.isNaN(f.lng))) return "Bujur tidak valid.";
  for (const k of DAY_KEYS) {
    const d = f.openingHours[k];
    if (d && (!isClock(d.open) || !isClock(d.close) || clockMinutes(d.open) >= clockMinutes(d.close))) return `Jam buka ${DAY_LABELS[k]} tidak valid.`;
  }
  if (f.closedDates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) return "Tanggal libur memakai format 2026-12-25.";
  return null;
}

export async function listLocations(db: AnyDb) {
  return db.select().from(schema.locations).orderBy(asc(schema.locations.sortOrder), asc(schema.locations.id));
}

export async function saveLocation(db: AnyDb, staff: StaffPrincipal, id: number, f: LocationForm, opts: { now?: Date } = {}) {
  if (!can(staff, "pengaturan.kelola")) return DENIED;
  const err = validateLocation(f);
  if (err) return { ok: false as const, message: err };
  const [old] = await db.select().from(schema.locations).where(eq(schema.locations.id, id)).limit(1);
  if (!old) return { ok: false as const, message: "Cabang tidak ditemukan." };
  const at = opts.now ?? new Date();
  const values = {
    address: f.address.trim().slice(0, 200),
    district: f.district.trim().slice(0, 80),
    city: f.city.trim().slice(0, 80) || old.city,
    phone: f.phone.trim().slice(0, 30),
    lat: f.lat,
    lng: f.lng,
    openingHours: f.openingHours,
    hoursLabel: old.type === "gudang" ? old.hoursLabel : hoursLabel(f.openingHours),
    closedDates: [...new Set(f.closedDates)].sort().slice(0, 60),
    canPickup: old.type === "toko" ? f.canPickup : false,
    updatedAt: at,
  };
  await db.update(schema.locations).set(values).where(eq(schema.locations.id, id));
  const d = diff({ alamat: old.address, kecamatan: old.district, telepon: old.phone, lat: old.lat, lng: old.lng, jam: old.openingHours, libur: old.closedDates, ambil: old.canPickup }, { alamat: values.address, kecamatan: values.district, telepon: values.phone, lat: values.lat, lng: values.lng, jam: values.openingHours, libur: values.closedDates, ambil: values.canPickup });
  await writeAudit(db, { staff, action: "pengaturan.cabang", objectType: "pengaturan", objectId: old.slug, summary: `Ubah cabang ${old.name}`, before: d.before, after: d.after, at });
  return { ok: true as const };
}
