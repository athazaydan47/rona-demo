// Memuat data yang dibutuhkan mesin harga dari database: varian, produk, flash sale aktif, voucher.
import { and, eq, gt, inArray, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";
import type { FlashInput, PricingLineInput, VoucherInput } from "@/lib/pricing/cart";

export type Buyer = { customerId: number | null; phone: string | null };

export type VariantMeta = {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  shadeName: string;
  shadeSlug: string;
  hex: string;
  sku: string;
  weightGram: number;
  brandName: string;
  brandColor: string;
  packaging: Packaging;
  variantCount: number;
  active: boolean; // varian aktif dan produk berstatus aktif
};

export async function loadVariantMeta(db: AnyDb, variantIds: number[]) {
  const out = new Map<number, VariantMeta & { line: Omit<PricingLineInput, "quantity" | "flash"> }>();
  if (variantIds.length === 0) return out;
  const parent = alias(schema.categories, "parent_categories");
  const rows = await db
    .select({
      variantId: schema.variants.id,
      productId: schema.products.id,
      productName: schema.products.name,
      productSlug: schema.products.slug,
      productStatus: schema.products.status,
      shadeName: schema.variants.shadeName,
      shadeSlug: schema.variants.shadeSlug,
      hex: schema.variants.hex,
      sku: schema.variants.sku,
      weightGram: schema.variants.weightGram,
      normalPrice: schema.variants.normalPrice,
      salePrice: schema.variants.salePrice,
      promoPrice: schema.variants.promoPrice,
      promoStartsAt: schema.variants.promoStartsAt,
      promoEndsAt: schema.variants.promoEndsAt,
      variantActive: schema.variants.isActive,
      brandId: schema.brands.id,
      brandName: schema.brands.name,
      brandColor: schema.brands.color,
      packaging: schema.products.packaging,
      categoryId: schema.categories.id,
      parentCategoryId: parent.id,
      variantCount: sql<number>`(select count(*)::int from variants v2 where v2.product_id = ${schema.products.id} and v2.is_active)`,
    })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .leftJoin(parent, eq(schema.categories.parentId, parent.id))
    .where(inArray(schema.variants.id, variantIds));
  for (const r of rows) {
    out.set(r.variantId, {
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      productSlug: r.productSlug,
      shadeName: r.shadeName,
      shadeSlug: r.shadeSlug,
      hex: r.hex,
      sku: r.sku,
      weightGram: r.weightGram,
      brandName: r.brandName,
      brandColor: r.brandColor,
      packaging: r.packaging,
      variantCount: Number(r.variantCount),
      active: r.variantActive && r.productStatus === "aktif",
      line: {
        variantId: r.variantId,
        productId: r.productId,
        brandId: r.brandId,
        categoryId: r.categoryId,
        parentCategoryId: r.parentCategoryId ?? null,
        weightGram: r.weightGram,
        normalPrice: r.normalPrice,
        salePrice: r.salePrice,
        promoPrice: r.promoPrice,
        promoStartsAt: r.promoStartsAt,
        promoEndsAt: r.promoEndsAt,
      },
    });
  }
  return out;
}

// Flash sale yang sedang berjalan untuk varian tertentu, beserta jumlah yang sudah dibeli pembeli ini di slot itu.
export async function loadLiveFlash(db: AnyDb, variantIds: number[], buyer: Buyer, now: Date, opts: { lock?: boolean } = {}) {
  const out = new Map<number, FlashInput>();
  if (variantIds.length === 0) return out;
  const base = db
    .select({
      id: schema.flashSaleItems.id,
      variantId: schema.flashSaleItems.variantId,
      flashPrice: schema.flashSaleItems.flashPrice,
      quota: schema.flashSaleItems.quota,
      sold: schema.flashSaleItems.sold,
      maxPerCustomer: schema.flashSaleItems.maxPerCustomer,
      startsAt: schema.flashSales.startsAt,
      endsAt: schema.flashSales.endsAt,
    })
    .from(schema.flashSaleItems)
    .innerJoin(schema.flashSales, eq(schema.flashSaleItems.flashSaleId, schema.flashSales.id))
    .where(and(inArray(schema.flashSaleItems.variantId, variantIds), eq(schema.flashSales.isActive, true), lte(schema.flashSales.startsAt, now), gt(schema.flashSales.endsAt, now)))
    // Slot buatan admin selalu menang atas slot otomatis bila keduanya berjalan bersamaan.
    .orderBy(sql`case when ${schema.flashSales.source} = 'admin' then 0 else 1 end`, schema.flashSaleItems.id);
  const rows = opts.lock ? await base.for("update", { of: schema.flashSaleItems }) : await base;
  const bought = new Map<number, number>();
  if (buyer.phone && rows.length) {
    const b = await db
      .select({ flashSaleItemId: schema.orderItems.flashSaleItemId, qty: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int` })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(inArray(schema.orderItems.flashSaleItemId, rows.map((r) => r.id)), eq(schema.orders.guestPhone, buyer.phone), ne(schema.orders.status, "dibatalkan")))
      .groupBy(schema.orderItems.flashSaleItemId);
    for (const x of b) if (x.flashSaleItemId != null) bought.set(x.flashSaleItemId, Number(x.qty));
  }
  for (const r of rows) {
    if (out.has(r.variantId)) continue;
    out.set(r.variantId, { flashSaleItemId: r.id, flashPrice: r.flashPrice, quota: r.quota, sold: r.sold, maxPerCustomer: r.maxPerCustomer, boughtByBuyer: bought.get(r.id) ?? 0, startsAt: r.startsAt, endsAt: r.endsAt });
  }
  return out;
}

export async function loadVoucher(db: AnyDb, code: string | null | undefined, buyer: Buyer, opts: { lock?: boolean } = {}): Promise<(VoucherInput & { id: number }) | null> {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  const q = db.select().from(schema.vouchers).where(eq(schema.vouchers.code, c)).limit(1);
  const [v] = opts.lock ? await q.for("update") : await q;
  if (!v) return null;
  let usedByBuyer = 0;
  if (buyer.phone || buyer.customerId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.voucherRedemptions)
      .where(and(eq(schema.voucherRedemptions.voucherId, v.id), buyer.customerId ? eq(schema.voucherRedemptions.customerId, buyer.customerId) : eq(schema.voucherRedemptions.guestPhone, buyer.phone!)));
    usedByBuyer = Number(row?.n ?? 0);
  }
  return {
    id: v.id,
    code: v.code,
    type: v.type,
    value: v.value,
    maxDiscount: v.maxDiscount,
    minSpend: v.minSpend,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    quota: v.quota,
    used: v.used,
    quotaPerCustomer: v.quotaPerCustomer,
    usedByBuyer,
    scope: v.scope ?? {},
    stackWithFlash: v.stackWithFlash,
    isActive: v.isActive,
  };
}

export async function buildPricingLines(db: AnyDb, items: { variantId: number; quantity: number }[], buyer: Buyer, now: Date, opts: { lockFlash?: boolean } = {}) {
  const ids = [...new Set(items.map((i) => i.variantId))];
  const [meta, flash] = await Promise.all([loadVariantMeta(db, ids), loadLiveFlash(db, ids, buyer, now, { lock: opts.lockFlash })]);
  const lines: PricingLineInput[] = [];
  for (const it of items) {
    const m = meta.get(it.variantId);
    if (!m) continue;
    lines.push({ ...m.line, quantity: it.quantity, flash: flash.get(it.variantId) ?? null });
  }
  return { lines, meta, flash };
}
