// Pembacaan katalog TANPA cache: harga efektif, stok, dan flash sale harus selalu segar.
// Dipanggil di dalam Suspense. Cakupan (kategori, merek, pencarian) dibatasi di SQL,
// filter atribut, facet, urutan, dan paginasi dihitung di memori dari hasil cakupan.
import { cache } from "react";
import { connection } from "next/server";
import { and, asc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";
import { computeFacets, type CatalogFacets } from "./facets";
import { loadCatalogItems } from "./load-items";
import { buildScopeCondition, parent, relevanceExpr, type CatalogScope } from "./scope";

export type { CatalogScope } from "./scope";
import {
  applyFilters,
  rankInterpreted,
  type Loosened,
  emptyFilters,
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
import { now as clockNow } from "@/lib/clock";
import { fiturAktif } from "@/config/fitur";

// Dibungkus React cache supaya beberapa bagian beranda yang memakai cakupan sama hanya memicu satu kali baca.
export const fetchCatalogItems = cache(async function fetchCatalogItems(scope: CatalogScope): Promise<CatalogItem[]> {
  // Harga efektif bergantung pada waktu sekarang: tunda ke saat request, jangan ikut prerender.
  await connection();
  await ensureFlashSaleSlots(db);
  return loadCatalogItems(db, scope, clockNow());
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
  loosened: Loosened[]; // kriteria tafsiran yang dilonggarkan karena hasilnya kurang dari 3
};

export async function getCatalogResult(scope: CatalogScope, filters: CatalogFilters): Promise<CatalogResult> {
  const items = await fetchCatalogItems(scope);
  return buildCatalogResult(items, filters);
}

export function buildCatalogResult(items: CatalogItem[], filters: CatalogFilters): CatalogResult {
  // Hasil tafsiran AI: hanya kategori, merek, dan harga yang wajib; kriteria lain mengurutkan (lihat rankInterpreted).
  const interpreted = filters.interpreted ? rankInterpreted(items, filters) : null;
  const effective = interpreted?.hard ?? filters;
  const filtered = interpreted?.items ?? sortItems(applyFilters(items, filters), filters);
  const page = paginate(filtered, filters.page);
  const facets = computeFacets(items, effective, {
    skinTypes: Object.keys(skinTypeLabels),
    concerns: Object.keys(concernLabels),
    finishes: Object.keys(finishLabels),
    undertones: Object.keys(undertoneLabels),
  });
  return {
    products: page.items.map((item) => toCardData(item, effective)),
    total: page.total,
    scopeTotal: items.length,
    hasMore: page.hasMore,
    page: filters.page,
    facets,
    loosened: interpreted?.loosened ?? [],
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
  return { ...emptyFilters(), sort };
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
  const now = nowInput ?? clockNow();
  if (!fiturAktif("flashSale")) return [];
  await ensureFlashSaleSlots(db, { now });
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
