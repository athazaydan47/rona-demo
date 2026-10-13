// Pembacaan katalog TANPA cache: harga efektif, stok, dan flash sale harus selalu segar.
// Dipanggil di dalam Suspense. Cakupan (kategori, merek, pencarian) dibatasi di SQL,
// filter atribut, facet, urutan, dan paginasi dihitung di memori dari hasil cakupan.
import { cache } from "react";
import { connection } from "next/server";
import { and, asc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { effectivePrice } from "@/lib/pricing";
import { computeFacets, type CatalogFacets } from "./facets";
import { buildScopeCondition, parent, relevanceExpr, type CatalogScope } from "./scope";

export type { CatalogScope } from "./scope";
import {
  applyFilters,
  matchingMinPrice,
  paginate,
  sortItems,
  type CatalogFilters,
  type CatalogItem,
  type CatalogVariant,
  concernLabels,
  finishLabels,
  skinTypeLabels,
  undertoneLabels,
} from "./filters";

// Dibungkus React cache supaya beberapa bagian beranda yang memakai cakupan sama hanya memicu satu kali baca.
export const fetchCatalogItems = cache(async function fetchCatalogItems(scope: CatalogScope): Promise<CatalogItem[]> {
  // Harga efektif bergantung pada waktu sekarang: tunda ke saat request, jangan ikut prerender.
  await connection();
  const q = scope.kind === "search" ? scope.q.trim() : "";
  const rows = await db
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
      publishedAt: schema.products.publishedAt,
      skinTypes: schema.products.skinTypes,
      concerns: schema.products.skinConcerns,
      finish: schema.products.finish,
      spf: schema.products.spf,
      brandSlug: schema.brands.slug,
      brandName: schema.brands.name,
      brandColor: schema.brands.color,
      categorySlug: schema.categories.slug,
      parentSlug: sql<string>`coalesce(${parent.slug}, ${schema.categories.slug})`,
      relevance: relevanceExpr(q),
    })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(parent, eq(schema.categories.parentId, parent.id))
    .where(buildScopeCondition(scope))
    .orderBy(asc(schema.products.name));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const now = new Date();
  const [variants, stock, flashRows, locations] = await Promise.all([
    db
      .select({
        id: schema.variants.id,
        productId: schema.variants.productId,
        shadeName: schema.variants.shadeName,
        shadeSlug: schema.variants.shadeSlug,
        hex: schema.variants.hex,
        undertone: schema.variants.undertone,
        depth: schema.variants.depth,
        normalPrice: schema.variants.normalPrice,
        salePrice: schema.variants.salePrice,
        promoPrice: schema.variants.promoPrice,
        promoStartsAt: schema.variants.promoStartsAt,
        promoEndsAt: schema.variants.promoEndsAt,
        sortOrder: schema.variants.sortOrder,
      })
      .from(schema.variants)
      .where(and(inArray(schema.variants.productId, ids), eq(schema.variants.isActive, true)))
      .orderBy(asc(schema.variants.sortOrder)),
    db
      .select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved })
      .from(schema.inventory)
      .innerJoin(schema.variants, eq(schema.inventory.variantId, schema.variants.id))
      .where(inArray(schema.variants.productId, ids)),
    db
      .select({ variantId: schema.flashSaleItems.variantId, flashPrice: schema.flashSaleItems.flashPrice, quota: schema.flashSaleItems.quota, sold: schema.flashSaleItems.sold })
      .from(schema.flashSaleItems)
      .innerJoin(schema.flashSales, eq(schema.flashSaleItems.flashSaleId, schema.flashSales.id))
      .innerJoin(schema.variants, eq(schema.flashSaleItems.variantId, schema.variants.id))
      .where(and(inArray(schema.variants.productId, ids), eq(schema.flashSales.isActive, true), lte(schema.flashSales.startsAt, now), gt(schema.flashSales.endsAt, now))),
    db.select({ id: schema.locations.id, slug: schema.locations.slug }).from(schema.locations),
  ]);
  const locSlug = new Map(locations.map((l) => [l.id, l.slug]));
  const stockByVariant = new Map<number, Record<string, number>>();
  for (const s of stock) {
    const rec = stockByVariant.get(s.variantId) ?? {};
    rec[locSlug.get(s.locationId) ?? String(s.locationId)] = Math.max(0, s.onHand - s.reserved);
    stockByVariant.set(s.variantId, rec);
  }
  // Flash sale hanya berlaku bila kuotanya masih ada.
  const flashByVariant = new Map(flashRows.filter((f) => f.sold < f.quota).map((f) => [f.variantId, f.flashPrice]));

  const variantsByProduct = new Map<number, CatalogVariant[]>();
  for (const v of variants) {
    const price = effectivePrice({ ...v, flashPrice: flashByVariant.get(v.id) ?? null }, now);
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push({
      id: v.id,
      shadeName: v.shadeName,
      shadeSlug: v.shadeSlug,
      hex: v.hex,
      undertone: v.undertone,
      depth: v.depth,
      price: price.price,
      normalPrice: price.normalPrice,
      source: price.source,
      stockByLocation: stockByVariant.get(v.id) ?? {},
    });
    variantsByProduct.set(v.productId, list);
  }

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      brandSlug: r.brandSlug,
      brandName: r.brandName,
      brandColor: r.brandColor,
      categorySlug: r.categorySlug,
      parentSlug: r.parentSlug,
      packaging: r.packaging,
      ratingAvg: r.ratingAvg,
      reviewCount: r.reviewCount,
      soldCount: r.soldCount,
      isNew: r.isNew,
      isBestseller: r.isBestseller,
      publishedAt: (r.publishedAt ?? new Date(0)).toISOString(),
      skinTypes: r.skinTypes,
      concerns: r.concerns,
      finish: r.finish,
      spf: r.spf,
      relevance: Number(r.relevance) || 0,
      variants: variantsByProduct.get(r.id) ?? [],
    }))
    .filter((item) => item.variants.length > 0);
});

export type ProductCardVariant = {
  id: number;
  shadeName: string;
  hex: string;
  price: number;
  normalPrice: number;
  inStock: boolean;
};

export type ProductCardData = {
  id: number;
  name: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  brandColor: string;
  packaging: CatalogItem["packaging"];
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  isNew: boolean;
  isBestseller: boolean;
  isFlash: boolean;
  inStock: boolean;
  price: number; // termurah di antara varian yang cocok
  normalPrice: number;
  hexes: string[];
  primaryHex: string;
  primaryShade: string;
  variantCount: number;
  variants: ProductCardVariant[];
};

const inStock = (v: CatalogVariant) => Object.values(v.stockByLocation).some((n) => n > 0);

export function toCardData(item: CatalogItem, f?: CatalogFilters): ProductCardData {
  const minPrice = f ? matchingMinPrice(item, f) : Math.min(...item.variants.map((v) => v.price));
  const cheapest = item.variants.find((v) => v.price === minPrice) ?? item.variants[0];
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    brandName: item.brandName,
    brandSlug: item.brandSlug,
    brandColor: item.brandColor,
    packaging: item.packaging,
    ratingAvg: item.ratingAvg,
    reviewCount: item.reviewCount,
    soldCount: item.soldCount,
    isNew: item.isNew,
    isBestseller: item.isBestseller,
    isFlash: item.variants.some((v) => v.source === "flash"),
    inStock: item.variants.some(inStock),
    price: cheapest.price,
    normalPrice: cheapest.normalPrice,
    hexes: item.variants.map((v) => v.hex),
    primaryHex: item.variants[0].hex,
    primaryShade: item.variants.length > 1 ? item.variants[0].shadeName : "",
    variantCount: item.variants.length,
    variants: item.variants.map((v) => ({ id: v.id, shadeName: v.shadeName, hex: v.hex, price: v.price, normalPrice: v.normalPrice, inStock: inStock(v) })),
  };
}

export type CatalogResult = {
  products: ProductCardData[];
  total: number; // jumlah hasil setelah filter
  scopeTotal: number; // jumlah produk dalam cakupan sebelum filter
  hasMore: boolean;
  page: number;
  facets: CatalogFacets;
};

export async function getCatalogResult(scope: CatalogScope, filters: CatalogFilters): Promise<CatalogResult> {
  const items = await fetchCatalogItems(scope);
  return buildCatalogResult(items, filters);
}

export function buildCatalogResult(items: CatalogItem[], filters: CatalogFilters): CatalogResult {
  const filtered = sortItems(applyFilters(items, filters), filters);
  const page = paginate(filtered, filters.page);
  const facets = computeFacets(items, filters, {
    skinTypes: Object.keys(skinTypeLabels),
    concerns: Object.keys(concernLabels),
    finishes: Object.keys(finishLabels),
    undertones: Object.keys(undertoneLabels),
  });
  return {
    products: page.items.map((item) => toCardData(item, filters)),
    total: page.total,
    scopeTotal: items.length,
    hasMore: page.hasMore,
    page: filters.page,
    facets,
  };
}

// Produk unggulan untuk beranda dan hasil kosong (tanpa cache karena memuat harga dan stok).
export async function getProductCards(scope: CatalogScope, sort: CatalogFilters["sort"], limit: number): Promise<ProductCardData[]> {
  const items = await fetchCatalogItems(scope);
  const f = { ...emptyFiltersFor(sort) };
  return sortItems(items, f).slice(0, limit).map((i) => toCardData(i));
}

export async function getProductCardsForSkinTypes(limitPer = 4): Promise<Record<string, ProductCardData[]>> {
  const items = await fetchCatalogItems({ kind: "all" });
  const out: Record<string, ProductCardData[]> = {};
  for (const skin of Object.keys(skinTypeLabels)) {
    const f = { ...emptyFiltersFor("terlaris"), skinTypes: [skin] };
    out[skin] = sortItems(applyFilters(items, f), f).slice(0, limitPer).map((i) => toCardData(i));
  }
  return out;
}

function emptyFiltersFor(sort: CatalogFilters["sort"]): CatalogFilters {
  return {
    q: "",
    brands: [],
    priceMin: null,
    priceMax: null,
    ratingMin: null,
    skinTypes: [],
    concerns: [],
    finishes: [],
    undertones: [],
    spf: false,
    location: null,
    promo: false,
    sort,
    page: 1,
  };
}

// Flash sale: slot aktif atau berikutnya beserta itemnya, selalu segar.
export type FlashSlotData = {
  id: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  items: {
    variantId: number;
    productId: number;
    productSlug: string;
    productName: string;
    brandName: string;
    brandColor: string;
    packaging: CatalogItem["packaging"];
    shadeName: string;
    hex: string;
    flashPrice: number;
    normalPrice: number;
    quota: number;
    sold: number;
    maxPerCustomer: number;
  }[];
};

export async function getFlashSlots(nowInput?: Date): Promise<FlashSlotData[]> {
  await connection();
  const now = nowInput ?? new Date();
  const horizon = new Date(now.getTime() + 4 * 86400000);
  const slots = await db
    .select({ id: schema.flashSales.id, name: schema.flashSales.name, startsAt: schema.flashSales.startsAt, endsAt: schema.flashSales.endsAt })
    .from(schema.flashSales)
    .where(and(eq(schema.flashSales.isActive, true), gt(schema.flashSales.endsAt, now), lte(schema.flashSales.startsAt, horizon)))
    .orderBy(asc(schema.flashSales.startsAt));
  if (slots.length === 0) return [];
  const items = await db
    .select({
      flashSaleId: schema.flashSaleItems.flashSaleId,
      variantId: schema.flashSaleItems.variantId,
      flashPrice: schema.flashSaleItems.flashPrice,
      quota: schema.flashSaleItems.quota,
      sold: schema.flashSaleItems.sold,
      maxPerCustomer: schema.flashSaleItems.maxPerCustomer,
      productId: schema.products.id,
      productSlug: schema.products.slug,
      productName: schema.products.name,
      packaging: schema.products.packaging,
      brandName: schema.brands.name,
      brandColor: schema.brands.color,
      shadeName: schema.variants.shadeName,
      hex: schema.variants.hex,
      normalPrice: schema.variants.normalPrice,
    })
    .from(schema.flashSaleItems)
    .innerJoin(schema.variants, eq(schema.flashSaleItems.variantId, schema.variants.id))
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(inArray(schema.flashSaleItems.flashSaleId, slots.map((s) => s.id)))
    .orderBy(asc(schema.flashSaleItems.id));
  return slots.map((s) => ({
    ...s,
    items: items
      .filter((i) => i.flashSaleId === s.id)
      .map((i) => {
        const { flashSaleId, ...rest } = i;
        void flashSaleId;
        return rest;
      }),
  }));
}

// Saran pencarian instan: produk, merek, kategori.
export type SearchSuggestions = {
  products: { id: number; name: string; slug: string; brandName: string; brandColor: string; packaging: CatalogItem["packaging"]; hex: string; price: number; normalPrice: number }[];
  brands: { name: string; slug: string; color: string }[];
  categories: { name: string; slug: string; parentSlug: string | null; parentName: string | null }[];
};

export async function getSearchSuggestions(qRaw: string): Promise<SearchSuggestions> {
  const q = qRaw.trim().slice(0, 60);
  if (q.length < 2) return { products: [], brands: [], categories: [] };
  const like = `%${q}%`;
  const [products, brands, categories] = await Promise.all([
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        slug: schema.products.slug,
        packaging: schema.products.packaging,
        brandName: schema.brands.name,
        brandColor: schema.brands.color,
        hex: sql<string>`(select hex from variants v where v.product_id = ${schema.products.id} and v.is_active order by v.sort_order limit 1)`,
        price: sql<number>`(select min(v.sale_price) from variants v where v.product_id = ${schema.products.id} and v.is_active)`,
        normalPrice: sql<number>`(select min(v.normal_price) from variants v where v.product_id = ${schema.products.id} and v.is_active)`,
        score: relevanceExpr(q),
      })
      .from(schema.products)
      .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
      .where(buildScopeCondition({ kind: "search", q }))
      .orderBy(sql`${relevanceExpr(q)} desc`, asc(schema.products.name))
      .limit(5),
    db
      .select({ name: schema.brands.name, slug: schema.brands.slug, color: schema.brands.color })
      .from(schema.brands)
      .where(or(sql`${schema.brands.name} ILIKE ${like}`, sql`word_similarity(${q}, ${schema.brands.name}) >= 0.4`))
      .orderBy(asc(schema.brands.name))
      .limit(3),
    db
      .select({ name: schema.categories.name, slug: schema.categories.slug, parentSlug: parent.slug, parentName: parent.name })
      .from(schema.categories)
      .leftJoin(parent, eq(schema.categories.parentId, parent.id))
      .where(or(sql`${schema.categories.name} ILIKE ${like}`, sql`word_similarity(${q}, ${schema.categories.name}) >= 0.4`))
      .orderBy(asc(schema.categories.name))
      .limit(4),
  ]);
  return {
    products: products.map((p) => {
      const { score, ...rest } = p;
      void score;
      return { ...rest, price: Number(rest.price) || 0, normalPrice: Number(rest.normalPrice) || 0 };
    }),
    brands,
    categories,
  };
}
