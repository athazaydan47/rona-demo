import { cacheLife, cacheTag } from "next/cache";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Packaging } from "@/db/schema/enums";
import { effectivePrice } from "@/lib/pricing";

export type CategoryChild = { id: number; name: string; slug: string };
export type CategoryNode = {
  id: number;
  name: string;
  slug: string;
  description: string;
  children: CategoryChild[];
};

// Pohon kategori 2 tingkat untuk MegaMenu, footer, dan menu HP.
export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  const rows = await db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
      parentId: schema.categories.parentId,
      description: schema.categories.description,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));
  const parents = rows.filter((r) => r.parentId === null);
  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    children: rows
      .filter((r) => r.parentId === p.id)
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  }));
}

export type StoreLocation = {
  id: number;
  name: string;
  slug: string;
  type: "gudang" | "toko";
  address: string;
  district: string;
  city: string;
  hoursLabel: string;
  canPickup: boolean;
};

export async function getLocations(): Promise<StoreLocation[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("locations");
  return db
    .select({
      id: schema.locations.id,
      name: schema.locations.name,
      slug: schema.locations.slug,
      type: schema.locations.type,
      address: schema.locations.address,
      district: schema.locations.district,
      city: schema.locations.city,
      hoursLabel: schema.locations.hoursLabel,
      canPickup: schema.locations.canPickup,
    })
    .from(schema.locations)
    .where(eq(schema.locations.isActive, true))
    .orderBy(asc(schema.locations.sortOrder));
}

export async function getPromoMessages(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, "promo.bar"));
  const value = row?.value;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export type ProductCardData = {
  id: number;
  name: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  brandColor: string;
  packaging: Packaging;
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  isNew: boolean;
  isBestseller: boolean;
  price: number;
  normalPrice: number;
  hexes: string[];
  primaryHex: string;
  primaryShade: string;
  variantCount: number;
  inStock: boolean;
};

// Produk unggulan untuk beranda: terlaris dulu, lalu paling banyak terjual.
export async function getFeaturedProducts(limit = 12): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      packaging: schema.products.packaging,
      ratingAvg: schema.products.ratingAvg,
      reviewCount: schema.products.reviewCount,
      soldCount: schema.products.soldCount,
      isNew: schema.products.isNew,
      isBestseller: schema.products.isBestseller,
      brandName: schema.brands.name,
      brandSlug: schema.brands.slug,
      brandColor: schema.brands.color,
    })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(eq(schema.products.status, "aktif"))
    .orderBy(desc(schema.products.isBestseller), desc(schema.products.soldCount), asc(schema.products.name))
    .limit(limit);
  if (products.length === 0) return [];

  const ids = products.map((p) => p.id);
  const variants = await db
    .select({
      id: schema.variants.id,
      productId: schema.variants.productId,
      shadeName: schema.variants.shadeName,
      hex: schema.variants.hex,
      normalPrice: schema.variants.normalPrice,
      salePrice: schema.variants.salePrice,
      promoPrice: schema.variants.promoPrice,
      promoStartsAt: schema.variants.promoStartsAt,
      promoEndsAt: schema.variants.promoEndsAt,
      sortOrder: schema.variants.sortOrder,
    })
    .from(schema.variants)
    .where(inArray(schema.variants.productId, ids))
    .orderBy(asc(schema.variants.sortOrder));
  const variantIds = variants.map((v) => v.id);
  const stock = await db
    .select({ variantId: schema.inventory.variantId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved })
    .from(schema.inventory)
    .where(inArray(schema.inventory.variantId, variantIds));
  const available = new Map<number, number>();
  for (const s of stock) available.set(s.variantId, (available.get(s.variantId) ?? 0) + Math.max(0, s.onHand - s.reserved));

  const now = new Date();
  return products.map((p) => {
    const vs = variants.filter((v) => v.productId === p.id && v.sortOrder >= 0);
    const priced = vs.map((v) => effectivePrice(v, now));
    const cheapest = priced.reduce((min, cur) => (cur.price < min.price ? cur : min), priced[0] ?? { price: 0, normalPrice: 0, source: "normal" as const, percent: 0 });
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brandName: p.brandName,
      brandSlug: p.brandSlug,
      brandColor: p.brandColor,
      packaging: p.packaging,
      ratingAvg: p.ratingAvg,
      reviewCount: p.reviewCount,
      soldCount: p.soldCount,
      isNew: p.isNew,
      isBestseller: p.isBestseller,
      price: cheapest.price,
      normalPrice: cheapest.normalPrice,
      hexes: vs.map((v) => v.hex),
      primaryHex: vs[0]?.hex ?? p.brandColor,
      primaryShade: vs[0]?.shadeName ?? "",
      variantCount: vs.length,
      inStock: vs.some((v) => (available.get(v.id) ?? 0) > 0),
    };
  });
}
