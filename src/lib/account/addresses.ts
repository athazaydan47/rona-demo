// Buku alamat pembeli. Semua fungsi dibatasi customerId dari sesi; maksimal 10 alamat dengan tepat satu alamat utama.
import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { normalizePhone } from "@/lib/orders/rules";
import { districts, hasDistrictData, regionName, zoneForRegency } from "@/lib/regions";

export const MAX_ADDRESSES = 10;

export type AddressInput = {
  label: string;
  recipient: string;
  phone: string;
  provinceCode: string;
  regencyCode: string;
  districtCode?: string | null;
  districtText?: string | null;
  postalCode: string;
  street: string;
  lat?: number | null;
  lng?: number | null;
  isPrimary?: boolean;
};

export type AddressRow = typeof schema.addresses.$inferSelect;
export type AddressResult = { ok: true; id: number } | { ok: false; message: string; field?: string };

// Validasi dan ubah kode wilayah menjadi nama, sama seperti checkout.
export function normalizeAddress(input: AddressInput): { ok: true; value: Omit<typeof schema.addresses.$inferInsert, "customerId"> } | { ok: false; message: string; field: string } {
  const label = (input.label ?? "").trim().slice(0, 30) || "Rumah";
  const recipient = (input.recipient ?? "").trim();
  if (recipient.length < 2 || recipient.length > 80) return { ok: false, message: "Isi nama penerima.", field: "recipient" };
  const phone = normalizePhone(input.phone ?? "");
  if (!phone) return { ok: false, message: "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.", field: "phone" };
  if (!input.provinceCode || !input.regencyCode || !input.regencyCode.startsWith(`${input.provinceCode}.`) || !zoneForRegency(input.regencyCode)) {
    return { ok: false, message: "Pilih provinsi dan kota atau kabupaten.", field: "regencyCode" };
  }
  let district = "";
  let districtCode: string | null = null;
  if (hasDistrictData(input.provinceCode)) {
    const found = input.districtCode ? districts(input.regencyCode).find((d) => d.kode === input.districtCode) : undefined;
    if (!found) return { ok: false, message: "Pilih kecamatan.", field: "district" };
    district = found.nama;
    districtCode = found.kode;
  } else {
    district = (input.districtText ?? "").trim().slice(0, 80);
    if (district.length < 3) return { ok: false, message: "Isi kecamatan.", field: "district" };
  }
  if (!/^\d{5}$/.test(input.postalCode ?? "")) return { ok: false, message: "Kode pos harus 5 angka.", field: "postalCode" };
  const street = (input.street ?? "").trim();
  if (street.length < 8 || street.length > 300) return { ok: false, message: "Tulis alamat lengkap: jalan, nomor rumah, RT/RW.", field: "street" };
  const hasPin = typeof input.lat === "number" && typeof input.lng === "number" && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180;
  return {
    ok: true,
    value: {
      label,
      recipient,
      phone,
      province: regionName(input.provinceCode),
      city: regionName(input.regencyCode),
      district,
      provinceCode: input.provinceCode,
      regencyCode: input.regencyCode,
      districtCode,
      postalCode: input.postalCode,
      street,
      lat: hasPin ? input.lat! : null,
      lng: hasPin ? input.lng! : null,
    },
  };
}

export async function listAddresses(db: AnyDb, customerId: number): Promise<AddressRow[]> {
  return db.select().from(schema.addresses).where(eq(schema.addresses.customerId, customerId)).orderBy(desc(schema.addresses.isPrimary), asc(schema.addresses.createdAt), asc(schema.addresses.id));
}

export async function getAddress(db: AnyDb, customerId: number, id: number) {
  const [a] = await db.select().from(schema.addresses).where(and(eq(schema.addresses.id, id), eq(schema.addresses.customerId, customerId))).limit(1);
  return a ?? null;
}

async function lockCustomer(tx: AnyDb, customerId: number) {
  await tx.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.id, customerId)).for("update");
}

export async function createAddress(db: AnyDb, customerId: number, input: AddressInput, now?: Date): Promise<AddressResult> {
  const n = normalizeAddress(input);
  if (!n.ok) return n;
  return db.transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    const [{ total }] = await tx.select({ total: count() }).from(schema.addresses).where(eq(schema.addresses.customerId, customerId));
    if (total >= MAX_ADDRESSES) return { ok: false as const, message: `Maksimal ${MAX_ADDRESSES} alamat. Hapus salah satu dulu, ya.` };
    const isPrimary = total === 0 || Boolean(input.isPrimary);
    if (isPrimary) await tx.update(schema.addresses).set({ isPrimary: false }).where(eq(schema.addresses.customerId, customerId));
    const [row] = await tx
      .insert(schema.addresses)
      .values({ ...n.value, customerId, isPrimary, ...(now ? { createdAt: now } : {}) })
      .returning({ id: schema.addresses.id });
    return { ok: true as const, id: row.id };
  });
}

export async function updateAddress(db: AnyDb, customerId: number, id: number, input: AddressInput): Promise<AddressResult> {
  const n = normalizeAddress(input);
  if (!n.ok) return n;
  return db.transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    const current = await getAddress(tx, customerId, id);
    if (!current) return { ok: false as const, message: "Alamat tidak ditemukan." };
    // Alamat utama tidak bisa "dilepas" begitu saja: tetap utama sampai alamat lain dijadikan utama.
    const isPrimary = current.isPrimary || Boolean(input.isPrimary);
    if (isPrimary && !current.isPrimary) await tx.update(schema.addresses).set({ isPrimary: false }).where(and(eq(schema.addresses.customerId, customerId), ne(schema.addresses.id, id)));
    await tx.update(schema.addresses).set({ ...n.value, isPrimary }).where(and(eq(schema.addresses.id, id), eq(schema.addresses.customerId, customerId)));
    return { ok: true as const, id };
  });
}

export async function setPrimaryAddress(db: AnyDb, customerId: number, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    const current = await getAddress(tx, customerId, id);
    if (!current) return false;
    await tx.update(schema.addresses).set({ isPrimary: false }).where(eq(schema.addresses.customerId, customerId));
    await tx.update(schema.addresses).set({ isPrimary: true }).where(and(eq(schema.addresses.id, id), eq(schema.addresses.customerId, customerId)));
    return true;
  });
}

export async function deleteAddress(db: AnyDb, customerId: number, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    const [deleted] = await tx.delete(schema.addresses).where(and(eq(schema.addresses.id, id), eq(schema.addresses.customerId, customerId))).returning({ isPrimary: schema.addresses.isPrimary });
    if (!deleted) return false;
    if (deleted.isPrimary) {
      const [next] = await tx.select({ id: schema.addresses.id }).from(schema.addresses).where(eq(schema.addresses.customerId, customerId)).orderBy(asc(schema.addresses.createdAt), asc(schema.addresses.id)).limit(1);
      if (next) await tx.update(schema.addresses).set({ isPrimary: true }).where(eq(schema.addresses.id, next.id));
    }
    return true;
  });
}
