// "Kabari aku" milik pembeli: simpan minat, lihat daftar, batalkan. Notifikasi dibuat oleh modul inventory.
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";

export async function requestRestockFor(db: AnyDb, customer: { customerId: number; phone: string }, variantId: number) {
  const [v] = await db.select({ id: schema.variants.id }).from(schema.variants).where(eq(schema.variants.id, variantId)).limit(1);
  if (!v) return { ok: false as const, message: "Varian tidak ditemukan." };
  const [existing] = await db
    .select({ id: schema.restockRequests.id })
    .from(schema.restockRequests)
    .where(and(eq(schema.restockRequests.variantId, variantId), eq(schema.restockRequests.customerId, customer.customerId), eq(schema.restockRequests.status, "menunggu")))
    .limit(1);
  if (existing) return { ok: true as const, duplicate: true };
  await db.insert(schema.restockRequests).values({ variantId, customerId: customer.customerId, contact: customer.phone, status: "menunggu" });
  return { ok: true as const, duplicate: false };
}

export type RestockItem = { id: number; status: "menunggu" | "terkirim"; createdAt: Date; notifiedAt: Date | null; variantId: number; productName: string; productSlug: string; shadeName: string; hex: string; packaging: Packaging; brandName: string; brandColor: string };

export async function listRestock(db: AnyDb, customerId: number): Promise<RestockItem[]> {
  return db
    .select({
      id: schema.restockRequests.id,
      status: schema.restockRequests.status,
      createdAt: schema.restockRequests.createdAt,
      notifiedAt: schema.restockRequests.notifiedAt,
      variantId: schema.variants.id,
      productName: schema.products.name,
      productSlug: schema.products.slug,
      shadeName: schema.variants.shadeName,
      hex: schema.variants.hex,
      packaging: schema.products.packaging,
      brandName: schema.brands.name,
      brandColor: schema.brands.color,
    })
    .from(schema.restockRequests)
    .innerJoin(schema.variants, eq(schema.restockRequests.variantId, schema.variants.id))
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(eq(schema.restockRequests.customerId, customerId))
    .orderBy(desc(schema.restockRequests.createdAt), desc(schema.restockRequests.id))
    .limit(50);
}

// Batal = baris dihapus (hanya milik sendiri yang masih menunggu).
export async function cancelRestock(db: AnyDb, customerId: number, id: number) {
  const rows = await db
    .delete(schema.restockRequests)
    .where(and(eq(schema.restockRequests.id, id), eq(schema.restockRequests.customerId, customerId), eq(schema.restockRequests.status, "menunggu")))
    .returning({ id: schema.restockRequests.id });
  return rows.length > 0;
}
