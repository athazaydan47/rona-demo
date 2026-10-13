// Data halaman produk. Deskriptif di-cache per produk; stok, harga efektif, flash sale dibaca segar.
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db/client";
import type { OpeningHours } from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import { cacheTags } from "@/lib/cache-tags";
import { fetchCatalogItems, toCardData, type ProductCardData } from "@/lib/catalog/catalog-queries";
import { sortItems, emptyFilters, type CatalogItem } from "@/lib/catalog/filters";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";
import { toWibParts } from "@/lib/format";
import { effectivePrice, type EffectivePrice } from "@/lib/pricing";
import { hexToRgb } from "@/lib/color";

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
  stock: Record<number, Record<string, number>>; // variantId -> slug lokasi -> tersedia
  locations: LiveLocation[];
  flash: Record<number, VariantFlash>;
  prices: Record<number, EffectivePrice>;
};

const DAY_KEYS: (keyof OpeningHours)[] = ["min", "sen", "sel", "rab", "kam", "jum", "sab"];

function parseClock(s: string) {
  const [h, m] = s.split(".").map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function locationFlags(loc: { type: "gudang" | "toko"; openingHours: OpeningHours | null }, now: Date) {
  const p = toWibParts(now);
  const minutes = p.hour * 60 + p.minute;
  const today = loc.openingHours?.[DAY_KEYS[p.weekday]] ?? null;
  const openNow = today ? minutes >= parseClock(today.open) && minutes < parseClock(today.close) : false;
  const shipsToday = loc.type === "gudang" && p.weekday >= 1 && p.weekday <= 6 && p.hour < 15;
  const pickupToday = loc.type === "toko" && openNow && p.hour < 16;
  return { openNow, shipsToday, pickupToday };
}

export async function getProductLive(product: Pick<ProductDetail, "id" | "variants">): Promise<ProductLive> {
  await connection();
  await ensureFlashSaleSlots(db);
  const now = new Date();
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
      .where(and(inArray(schema.flashSaleItems.variantId, variantIds), eq(schema.flashSales.isActive, true), lte(schema.flashSales.startsAt, now), gt(schema.flashSales.endsAt, now))),
  ]);
  const locById = new Map(locations.map((l) => [l.id, l.slug]));
  const stockMap: ProductLive["stock"] = {};
  for (const v of product.variants) stockMap[v.id] = Object.fromEntries(locations.map((l) => [l.slug, 0]));
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
      ...locationFlags(l, now),
    })),
    flash,
    prices,
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
    // Ulasan seed tidak punya foto; sekitar 4 dari 10 diberi foto pengganti (ShadeSwatchArt) secara deterministik.
    hasPhoto: r.photos.length > 0 || r.id % 10 < 4,
    storeReply: r.storeReply,
    // Belum ada kolom "membantu" di skema; angka awal deterministik dari id sampai Fase 5 menambah kolomnya.
    helpfulCount: (r.id * 7) % 13,
  }));
}

// Pelengkap per sub kategori: tiga sub kategori lain yang biasa dibeli bersama.
const complements: Record<string, string[]> = {
  cushion: ["sunscreen-wajah", "primer-dan-setting-spray", "lip-tint"],
  foundation: ["primer-dan-setting-spray", "bedak", "concealer"],
  bedak: ["cushion", "blush", "primer-dan-setting-spray"],
  concealer: ["foundation", "bedak", "perawatan-mata"],
  blush: ["highlighter-dan-contour", "lip-tint", "cushion"],
  "highlighter-dan-contour": ["blush", "bedak", "primer-dan-setting-spray"],
  "primer-dan-setting-spray": ["cushion", "foundation", "sunscreen-wajah"],
  lipstick: ["lip-balm-dan-lip-care", "blush", "cushion"],
  "lip-tint": ["lip-balm-dan-lip-care", "blush", "cushion"],
  "lip-cream": ["lip-balm-dan-lip-care", "lip-gloss", "cushion"],
  "lip-gloss": ["lipstick", "lip-balm-dan-lip-care", "blush"],
  "lip-balm-dan-lip-care": ["lipstick", "lip-tint", "pelembap"],
  mascara: ["eyeliner", "alis", "eyeshadow"],
  eyeliner: ["mascara", "alis", "eyeshadow"],
  eyeshadow: ["primer-dan-setting-spray", "mascara", "eyeliner"],
  alis: ["mascara", "eyeliner", "highlighter-dan-contour"],
  "bulu-mata": ["mascara", "eyeliner", "eyeshadow"],
  pembersih: ["toner", "pelembap", "sunscreen-wajah"],
  toner: ["serum-dan-essence", "pelembap", "sunscreen-wajah"],
  "serum-dan-essence": ["toner", "pelembap", "sunscreen-wajah"],
  pelembap: ["serum-dan-essence", "sunscreen-wajah", "pembersih"],
  masker: ["toner", "pelembap", "serum-dan-essence"],
  "perawatan-mata": ["serum-dan-essence", "pelembap", "concealer"],
  "perawatan-jerawat": ["pembersih", "pelembap", "sunscreen-wajah"],
  "paket-skincare": ["sunscreen-wajah", "masker", "perawatan-mata"],
  "sunscreen-wajah": ["pelembap", "cushion", "pembersih"],
  "sunscreen-tubuh": ["body-lotion", "body-wash", "sunscreen-wajah"],
  "tinted-sunscreen": ["bedak", "lip-tint", "pelembap"],
  "body-lotion": ["body-wash", "scrub", "body-mist"],
  "body-wash": ["body-lotion", "scrub", "deodoran"],
  scrub: ["body-lotion", "body-wash", "body-mist"],
  deodoran: ["body-wash", "body-mist", "body-lotion"],
  shampoo: ["hair-treatment", "body-wash", "body-lotion"],
  "hair-treatment": ["shampoo", "body-lotion", "body-mist"],
  "eau-de-parfum": ["body-mist", "body-lotion", "scrub"],
  "body-mist": ["body-lotion", "eau-de-parfum", "body-wash"],
  "skincare-pria": ["rambut-pria", "parfum-pria", "sunscreen-wajah"],
  "rambut-pria": ["skincare-pria", "parfum-pria", "shampoo"],
  "parfum-pria": ["skincare-pria", "rambut-pria", "body-mist"],
};

export type RelatedProducts = { together: ProductCardData[]; similar: ProductCardData[] };

export async function getRelatedProducts(product: ProductDetail): Promise<RelatedProducts> {
  const items = await fetchCatalogItems({ kind: "all" });
  const others = items.filter((i) => i.id !== product.id);
  const bySold = sortItems(others, { ...emptyFilters(), sort: "terlaris" });

  const targets = complements[product.category.slug] ?? [];
  const together: CatalogItem[] = [];
  for (const sub of targets) {
    const pick = bySold.find((i) => i.categorySlug === sub && !together.includes(i));
    if (pick) together.push(pick);
  }
  for (const i of bySold) {
    if (together.length >= 3) break;
    if (i.categorySlug !== product.category.slug && !together.includes(i) && i.parentSlug !== product.parent?.slug) together.push(i);
  }

  const base = product.variants[0];
  const basePrice = base?.salePrice ?? 0;
  const baseRgb = base ? hexToRgb(base.hex) : null;
  const similar = others
    .filter((i) => i.categorySlug === product.category.slug)
    .map((i) => {
      const v = i.variants[0];
      const rgb = hexToRgb(v.hex);
      const colorDist = baseRgb ? Math.hypot(rgb.r - baseRgb.r, rgb.g - baseRgb.g, rgb.b - baseRgb.b) / 441 : 0;
      const priceDist = basePrice ? Math.min(1, Math.abs(v.price - basePrice) / basePrice) : 0;
      return { item: i, score: colorDist + priceDist };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map((s) => s.item);
  const fallback = similar.length < 4 ? bySold.filter((i) => i.parentSlug === product.parent?.slug && !similar.includes(i)).slice(0, 8 - similar.length) : [];

  return { together: together.slice(0, 3).map((i) => toCardData(i)), similar: [...similar, ...fallback].map((i) => toCardData(i)) };
}

export async function getBestsellerCards(limit = 4): Promise<ProductCardData[]> {
  const items = await fetchCatalogItems({ kind: "all" });
  return sortItems(items, { ...emptyFilters(), sort: "terlaris" })
    .slice(0, limit)
    .map((i) => toCardData(i));
}
