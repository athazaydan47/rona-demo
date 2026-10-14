// Data halaman produk. Deskriptif di-cache per produk; stok, harga efektif, flash sale dibaca segar.
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { CourierRates } from "@/lib/settings";
import { getStoreSettings } from "@/lib/settings/load";
import type { CourierCode } from "@/lib/shipping";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db/client";
import type { Packaging } from "@/db/schema/enums";
import { cacheTags } from "@/lib/cache-tags";
import { fetchCatalogItems, toCardData, type ProductCardData } from "@/lib/catalog/catalog-queries";
import { sortItems, emptyFilters } from "@/lib/catalog/filters";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";
import { effectivePrice, type EffectivePrice } from "@/lib/pricing";
import { locationFlags } from "./availability";
import { pickSimilar, pickTogether } from "./related";
import { now as clockNow } from "@/lib/clock";
import { flashSaleGate } from "@/lib/flash/gate";

const SHADE_PACKAGING = new Set<Packaging>(["lipstick", "lip_tint", "lip_cream", "cushion", "foundation_bottle"]);

export type ProductVariantDetail = {
  id: number;
  shadeName: string;
  shadeSlug: string;
  hex: string;
  undertone: "warm" | "neutral" | "cool" | null;
  depth: number | null;
  sku: string;
  barcode: string;
  weightGram: number;
  normalPrice: number;
  salePrice: number;
  promoPrice: number | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
};

export type ProductDetail = {
  id: number;
  imageUrl: string | null; // foto opsional dari admin; ProductArt tetap gambar utama
  name: string;
  slug: string;
  shortDescription: string;
  benefits: string;
  ingredients: string;
  howToUse: string;
  activeIngredients: string[];
  skinTypes: string[];
  concerns: string[];
  finish: string | null;
  spf: number | null;
  bpom: string;
  netto: string;
  packaging: Packaging;
  status: "aktif" | "draf" | "arsip";
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  isNew: boolean;
  isBestseller: boolean;
  brand: { id: number; name: string; slug: string; color: string; tagline: string };
  category: { id: number; name: string; slug: string };
  parent: { name: string; slug: string } | null;
  variants: ProductVariantDetail[];
  hasShades: boolean; // pemilih shade (wajah dan bibir) dengan swatch dan shade finder
  hasSizes: boolean; // pemilih ukuran atau varian non-shade
};

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products());
  cacheTag(cacheTags.product(slug));
  const parent = alias(schema.categories, "parent_categories");
  const [row] = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      shortDescription: schema.products.shortDescription,
      benefits: schema.products.benefits,
      ingredients: schema.products.ingredients,
      howToUse: schema.products.howToUse,
      activeIngredients: schema.products.activeIngredients,
      skinTypes: schema.products.skinTypes,
      concerns: schema.products.skinConcerns,
      finish: schema.products.finish,
      spf: schema.products.spf,
      bpom: schema.products.bpom,
      netto: schema.products.netto,
      packaging: schema.products.packaging,
      imageUrl: schema.products.imageUrl,
      status: schema.products.status,
      ratingAvg: schema.products.ratingAvg,
      reviewCount: schema.products.reviewCount,
      soldCount: schema.products.soldCount,
      isNew: schema.products.isNew,
      isBestseller: schema.products.isBestseller,
      brandId: schema.brands.id,
      brandName: schema.brands.name,
      brandSlug: schema.brands.slug,
      brandColor: schema.brands.color,
      brandTagline: schema.brands.tagline,
      categoryId: schema.categories.id,
      categoryName: schema.categories.name,
      categorySlug: schema.categories.slug,
      parentName: parent.name,
      parentSlug: parent.slug,
    })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(parent, eq(schema.categories.parentId, parent.id))
    .where(eq(schema.products.slug, slug))
    .limit(1);
  if (!row) return null;
  const variants = await db
    .select({
      id: schema.variants.id,
      shadeName: schema.variants.shadeName,
      shadeSlug: schema.variants.shadeSlug,
      hex: schema.variants.hex,
      undertone: schema.variants.undertone,
      depth: schema.variants.depth,
      sku: schema.variants.sku,
      barcode: schema.variants.barcode,
      weightGram: schema.variants.weightGram,
      normalPrice: schema.variants.normalPrice,
      salePrice: schema.variants.salePrice,
      promoPrice: schema.variants.promoPrice,
      promoStartsAt: schema.variants.promoStartsAt,
      promoEndsAt: schema.variants.promoEndsAt,
    })
    .from(schema.variants)
    .where(and(eq(schema.variants.productId, row.id), eq(schema.variants.isActive, true)))
    .orderBy(asc(schema.variants.sortOrder));
  const hasShades = SHADE_PACKAGING.has(row.packaging) && variants.some((v) => v.depth != null || v.undertone != null);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    benefits: row.benefits,
    ingredients: row.ingredients,
    howToUse: row.howToUse,
    activeIngredients: row.activeIngredients,
    skinTypes: row.skinTypes,
    concerns: row.concerns,
    finish: row.finish,
    spf: row.spf,
    bpom: row.bpom,
    netto: row.netto,
    packaging: row.packaging,
    imageUrl: row.imageUrl,
    status: row.status,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    soldCount: row.soldCount,
    isNew: row.isNew,
    isBestseller: row.isBestseller,
    brand: { id: row.brandId, name: row.brandName, slug: row.brandSlug, color: row.brandColor, tagline: row.brandTagline },
    category: { id: row.categoryId, name: row.categoryName, slug: row.categorySlug },
    parent: row.parentName && row.parentSlug ? { name: row.parentName, slug: row.parentSlug } : null,
    variants: variants.map((v) => ({
      ...v,
      promoStartsAt: v.promoStartsAt?.toISOString() ?? null,
      promoEndsAt: v.promoEndsAt?.toISOString() ?? null,
    })),
    hasShades,
    hasSizes: !hasShades && variants.length > 1,
  };
}

// Daftar slug produk aktif untuk generateStaticParams.
export async function getActiveProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products());
  const rows = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.status, "aktif"));
  return rows.map((r) => r.slug);
}

export type LiveLocation = {
  slug: string;
  name: string;
  type: "gudang" | "toko";
  canPickup: boolean;
  hoursLabel: string;
  district: string;
  openNow: boolean;
  shipsToday: boolean; // gudang: sebelum 15.00 WIB, Senin sampai Sabtu
  pickupToday: boolean; // toko: sebelum 16.00 WIB dan sedang buka
};

export type VariantFlash = { flashPrice: number; quota: number; sold: number; maxPerCustomer: number; endsAt: string };

export type ProductLive = {
  now: string;
  stock: Record<number, Record<string, number>>; // variantId -> slug lokasi -> tersedia; lokasi tanpa kunci = tidak dijual di sana
  locations: LiveLocation[];
  flash: Record<number, VariantFlash>;
  prices: Record<number, EffectivePrice>;
  shipping: { rates: CourierRates; active: CourierCode[] };
};

export async function getProductLive(product: Pick<ProductDetail, "id" | "variants">): Promise<ProductLive> {
  await connection();
  await ensureFlashSaleSlots(db);
  const now = clockNow();
  const settings = await getStoreSettings();
  const variantIds = product.variants.map((v) => v.id);
  const [locations, stock, flashRows] = await Promise.all([
    db
      .select({
        id: schema.locations.id,
        slug: schema.locations.slug,
        name: schema.locations.name,
        type: schema.locations.type,
        canPickup: schema.locations.canPickup,
        hoursLabel: schema.locations.hoursLabel,
        district: schema.locations.district,
        openingHours: schema.locations.openingHours,
        closedDates: schema.locations.closedDates,
      })
      .from(schema.locations)
      .where(eq(schema.locations.isActive, true))
      .orderBy(asc(schema.locations.sortOrder)),
    db
      .select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved })
      .from(schema.inventory)
      .where(inArray(schema.inventory.variantId, variantIds)),
    db
      .select({
        variantId: schema.flashSaleItems.variantId,
        flashPrice: schema.flashSaleItems.flashPrice,
        quota: schema.flashSaleItems.quota,
        sold: schema.flashSaleItems.sold,
        maxPerCustomer: schema.flashSaleItems.maxPerCustomer,
        endsAt: schema.flashSales.endsAt,
      })
      .from(schema.flashSaleItems)
      .innerJoin(schema.flashSales, eq(schema.flashSaleItems.flashSaleId, schema.flashSales.id))
      .where(and(inArray(schema.flashSaleItems.variantId, variantIds), eq(schema.flashSales.isActive, true), lte(schema.flashSales.startsAt, now), gt(schema.flashSales.endsAt, now), flashSaleGate()))
      // Slot admin diproses terakhir supaya menimpa slot otomatis (slot admin selalu menang).
      .orderBy(sql`case when ${schema.flashSales.source} = 'admin' then 1 else 0 end`, schema.flashSaleItems.id),
  ]);
  const locById = new Map(locations.map((l) => [l.id, l.slug]));
  // Hanya lokasi yang menyediakan varian itu yang punya kunci; cabang tanpa kunci berarti "tidak dijual di cabang ini".
  const stockMap: ProductLive["stock"] = {};
  for (const v of product.variants) stockMap[v.id] = {};
  for (const s of stock) {
    const slug = locById.get(s.locationId);
    if (slug && stockMap[s.variantId]) stockMap[s.variantId][slug] = Math.max(0, s.onHand - s.reserved);
  }
  const flash: ProductLive["flash"] = {};
  for (const f of flashRows) {
    if (f.sold >= f.quota) continue;
    flash[f.variantId] = { flashPrice: f.flashPrice, quota: f.quota, sold: f.sold, maxPerCustomer: f.maxPerCustomer, endsAt: f.endsAt.toISOString() };
  }
  const prices: ProductLive["prices"] = {};
  for (const v of product.variants) {
    prices[v.id] = effectivePrice(
      {
        normalPrice: v.normalPrice,
        salePrice: v.salePrice,
        promoPrice: v.promoPrice,
        promoStartsAt: v.promoStartsAt ? new Date(v.promoStartsAt) : null,
        promoEndsAt: v.promoEndsAt ? new Date(v.promoEndsAt) : null,
        flashPrice: flash[v.id]?.flashPrice ?? null,
      },
      now,
    );
  }
  return {
    now: now.toISOString(),
    stock: stockMap,
    locations: locations.map((l) => ({
      slug: l.slug,
      name: l.name,
      type: l.type,
      canPickup: l.canPickup,
      hoursLabel: l.hoursLabel,
      district: l.district,
      ...locationFlags(l, now, settings.cutoff),
    })),
    flash,
    prices,
    shipping: { rates: settings.couriers.rates, active: settings.couriers.active },
  };
}

export type ProductReview = {
  id: number;
  authorName: string;
  rating: number;
  body: string;
  skinType: string | null;
  variantId: number | null;
  shadeName: string | null;
  hex: string | null;
  createdAt: string;
  isVerified: boolean; // hanya ulasan yang terhubung ke order_items
  photos: string[]; // foto asli dari pembeli
  hasPhoto: boolean;
  storeReply: string | null;
  helpfulCount: number;
};

// Ulasan dibaca segar (tanpa cache) karena bisa bertambah dari pesanan selesai.
export async function getProductReviews(productId: number): Promise<ProductReview[]> {
  await connection();
  const rows = await db
    .select({
      id: schema.reviews.id,
      authorName: schema.reviews.authorName,
      rating: schema.reviews.rating,
      body: schema.reviews.body,
      skinType: schema.reviews.skinType,
      variantId: schema.reviews.variantId,
      orderItemId: schema.reviews.orderItemId,
      photos: schema.reviews.photos,
      storeReply: schema.reviews.storeReply,
      createdAt: schema.reviews.createdAt,
      shadeName: schema.variants.shadeName,
      hex: schema.variants.hex,
    })
    .from(schema.reviews)
    .leftJoin(schema.variants, eq(schema.reviews.variantId, schema.variants.id))
    .where(and(eq(schema.reviews.productId, productId), eq(schema.reviews.status, "tampil")))
    .orderBy(desc(schema.reviews.createdAt));
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    skinType: r.skinType,
    variantId: r.variantId,
    shadeName: r.shadeName,
    hex: r.hex,
    createdAt: r.createdAt.toISOString(),
    isVerified: r.orderItemId != null,
    photos: r.photos,
    // Ulasan seed tidak punya foto; sekitar 4 dari 10 diberi foto pengganti (ShadeSwatchArt) secara deterministik.
    hasPhoto: r.photos.length > 0 || (r.orderItemId == null && r.id % 10 < 4),
    storeReply: r.storeReply,
    // Belum ada kolom "membantu" di skema; angka awal deterministik dari id sampai Fase 5 menambah kolomnya.
    helpfulCount: (r.id * 7) % 13,
  }));
}

export type RelatedProducts = { together: ProductCardData[]; similar: ProductCardData[] };

export async function getRelatedProducts(product: ProductDetail): Promise<RelatedProducts> {
  const items = await fetchCatalogItems({ kind: "all" });
  const ref = { id: product.id, categorySlug: product.category.slug, parentSlug: product.parent?.slug ?? null, hex: product.variants[0]?.hex ?? "#D9A98B", price: product.variants[0]?.salePrice ?? 0 };
  return { together: pickTogether(items, ref).map((i) => toCardData(i)), similar: pickSimilar(items, ref).map((i) => toCardData(i)) };
}

export async function getBestsellerCards(limit = 4): Promise<ProductCardData[]> {
  const items = await fetchCatalogItems({ kind: "all" });
  return sortItems(items, { ...emptyFilters(), sort: "terlaris" })
    .slice(0, limit)
    .map((i) => toCardData(i));
}
