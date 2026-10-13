"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";

const schemaInput = z.object({
  variantId: z.number().int().positive(),
  contact: z
    .string()
    .trim()
    .min(5, "Isi nomor WhatsApp atau email.")
    .max(80)
    .refine((v) => /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s.-]/g, "")) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Nomor WhatsApp atau email tidak valid."),
});

export type RestockResult = { ok: true; duplicate: boolean } | { ok: false; message: string };

// "Kabari aku saat tersedia": simpan permintaan, cegah duplikat untuk kontak dan varian yang sama.
export async function requestRestock(input: { variantId: number; contact: string }): Promise<RestockResult> {
  const parsed = schemaInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const contact = normalizeContact(parsed.data.contact);
  const [variant] = await db.select({ id: schema.variants.id }).from(schema.variants).where(eq(schema.variants.id, parsed.data.variantId)).limit(1);
  if (!variant) return { ok: false, message: "Varian tidak ditemukan." };
  const [existing] = await db
    .select({ id: schema.restockRequests.id })
    .from(schema.restockRequests)
    .where(and(eq(schema.restockRequests.variantId, variant.id), eq(schema.restockRequests.contact, contact), eq(schema.restockRequests.status, "menunggu")))
    .limit(1);
  if (existing) return { ok: true, duplicate: true };
  await db.insert(schema.restockRequests).values({ variantId: variant.id, contact, status: "menunggu" });
  return { ok: true, duplicate: false };
}

function normalizeContact(raw: string) {
  const v = raw.trim();
  if (v.includes("@")) return v.toLowerCase();
  let digits = v.replace(/[\s.-]/g, "");
  if (digits.startsWith("+62")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("62")) digits = "0" + digits.slice(2);
  return digits;
}
