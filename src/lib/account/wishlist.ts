// Wishlist akun di server. Harga dan stok terkini dibaca dari katalog tanpa cache.
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export const MAX_WISHLIST = 100;

export async function wishlistIds(db: AnyDb, customerId: number): Promise<number[]> {
  const rows = await db.select({ productId: schema.wishlists.productId }).from(schema.wishlists).where(eq(schema.wishlists.customerId, customerId)).orderBy(desc(schema.wishlists.createdAt), desc(schema.wishlists.id));
  return rows.map((r) => r.productId);
}

// Mengembalikan status baru: true bila kini ada di wishlist.
export async function setWishlisted(db: AnyDb, customerId: number, productId: number, on: boolean): Promise<{ ok: boolean; wished: boolean; message?: string }> {
  if (!on) {
    await db.delete(schema.wishlists).where(and(eq(schema.wishlists.customerId, customerId), eq(schema.wishlists.productId, productId)));
    return { ok: true, wished: false };
  }
  const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, productId)).limit(1);
  if (!p) return { ok: false, wished: false, message: "Produk tidak ditemukan." };
  const ids = await wishlistIds(db, customerId);
  if (!ids.includes(productId) && ids.length >= MAX_WISHLIST) return { ok: false, wished: false, message: `Wishlist penuh (maksimal ${MAX_WISHLIST}).` };
  await db.insert(schema.wishlists).values({ customerId, productId }).onConflictDoNothing();
  return { ok: true, wished: true };
}
