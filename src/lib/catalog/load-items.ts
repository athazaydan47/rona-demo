// Pemuat item katalog dengan harga efektif, stok per lokasi, dan flash sale yang sedang berjalan.
// Tanpa cache dan tanpa API Next, jadi bisa dipanggil dari halaman, route AI, skrip, dan uji.
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { effectivePrice } from "@/lib/pricing";
import type { CatalogItem, CatalogVariant } from "./filters";
import { buildScopeCondition, parent, relevanceExpr, type CatalogScope } from "./scope";
import { flashSaleGate } from "@/lib/flash/gate";

// Pemuat katalog tanpa ketergantungan Next: dipakai halaman katalog, fungsi katalog AI, dan uji.
export async function loadCatalogItems(db: AnyDb, scope: CatalogScope, now: Date): Promise<CatalogItem[]> {
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
      attrText: sql<string>`lower(${schema.products.benefits} || ' ' || ${schema.products.shortDescription} || ' ' || array_to_string(${schema.products.activeIngredients}, ', ') || ' ' || ${schema.products.ingredients})`,
    })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(parent, eq(schema.categories.parentId, parent.id))
    .where(buildScopeCondition(scope))
    .orderBy(asc(schema.products.name));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
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
      .where(and(inArray(schema.variants.productId, ids), eq(schema.flashSales.isActive, true), lte(schema.flashSales.startsAt, now), gt(schema.flashSales.endsAt, now), flashSaleGate()))
      // Slot admin diproses terakhir supaya menimpa slot otomatis.
      .orderBy(sql`case when ${schema.flashSales.source} = 'admin' then 1 else 0 end`, schema.flashSaleItems.id),
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
      attrText: r.attrText ?? "",
      variants: variantsByProduct.get(r.id) ?? [],
    }))
    .filter((item) => item.variants.length > 0);
}

