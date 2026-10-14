// Memuat data mentah laporan untuk satu rentang. Agregasinya ada di index.ts (murni) supaya Dashboard, Laporan,
// Excel, dan asisten AI memakai angka yang sama. Data dibaca segar (tanpa cache): angka penjualan tidak boleh basi.
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import {
  REVENUE_EXCLUDED,
  type ReportData,
  type ReportItem,
  type ReportOrder,
  type ReportRange,
} from "./index";

export type ReportScope = { locationIds: number[] | null }; // null = semua lokasi

export async function loadReportData(
  db: AnyDb,
  range: ReportRange,
  scope: ReportScope = { locationIds: null },
): Promise<ReportData> {
  const from = range.from;
  const to = range.to;
  const locFilter = scope.locationIds
    ? inArray(
        schema.orders.locationId,
        scope.locationIds.length ? scope.locationIds : [-1],
      )
    : undefined;
  const orderRows = await db
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      createdAt: schema.orders.createdAt,
      paidAt: schema.orders.paidAt,
      status: schema.orders.status,
      method: schema.orders.method,
      locationId: schema.orders.locationId,
      locationName: schema.locations.name,
      courier: schema.orders.courier,
      customerId: schema.orders.customerId,
      guestName: schema.orders.guestName,
      guestPhone: schema.orders.guestPhone,
      subtotal: schema.orders.subtotal,
      productDiscount: schema.orders.productDiscount,
      voucherDiscount: schema.orders.voucherDiscount,
      shippingCost: schema.orders.shippingCost,
      shippingDiscount: schema.orders.shippingDiscount,
      pointsUsed: schema.orders.pointsUsed,
      total: schema.orders.total,
      voucherCode: schema.orders.voucherCode,
      paymentMethod: sql<
        string | null
      >`(select p.method::text from payments p where p.order_id = "orders"."id" order by p.id limit 1)`,
    })
    .from(schema.orders)
    .innerJoin(
      schema.locations,
      eq(schema.orders.locationId, schema.locations.id),
    )
    .where(
      and(
        locFilter,
        or(
          and(
            gte(schema.orders.createdAt, from),
            lt(schema.orders.createdAt, to),
          ),
          and(gte(schema.orders.paidAt, from), lt(schema.orders.paidAt, to)),
        ),
      ),
    )
    .orderBy(asc(schema.orders.createdAt), asc(schema.orders.id));

  const orders: ReportOrder[] = orderRows.map((o) => ({
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    status: o.status,
    method: o.method,
    locationId: o.locationId,
    locationName: o.locationName,
    paymentMethod: o.paymentMethod,
    courier: o.courier,
    customerId: o.customerId,
    buyerKey:
      o.customerId != null
        ? `c:${o.customerId}`
        : `t:${o.guestPhone ?? o.number}`,
    buyerName: o.guestName ?? "",
    subtotal: o.subtotal,
    productDiscount: o.productDiscount,
    voucherDiscount: o.voucherDiscount,
    shippingCost: o.shippingCost,
    shippingDiscount: o.shippingDiscount,
    pointsUsed: o.pointsUsed,
    total: o.total,
    voucherCode: o.voucherCode,
  }));

  const ids = orders.map((o) => o.id);
  const parent = alias(schema.categories, "parent_cat");
  const itemRows = await db
    .select({
      orderId: schema.orderItems.orderId,
      variantId: schema.orderItems.variantId,
      sku: schema.variants.sku,
      productId: schema.products.id,
      productName: schema.orderItems.productName,
      productSlug: schema.products.slug,
      shadeName: schema.orderItems.shadeName,
      hex: schema.variants.hex,
      packaging: schema.products.packaging,
      brandId: schema.brands.id,
      brandName: schema.brands.name,
      brandColor: schema.brands.color,
      categoryId: schema.categories.id,
      categoryName: schema.categories.name,
      parentCategoryName: parent.name,
      quantity: schema.orderItems.quantity,
      unitPrice: schema.orderItems.unitPrice,
      normalPrice: schema.orderItems.normalPrice,
      priceSource: schema.orderItems.priceSource,
      flashSaleItemId: schema.orderItems.flashSaleItemId,
    })
    .from(schema.orderItems)
    .innerJoin(
      schema.variants,
      eq(schema.orderItems.variantId, schema.variants.id),
    )
    .innerJoin(
      schema.products,
      eq(schema.variants.productId, schema.products.id),
    )
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(
      schema.categories,
      eq(schema.products.categoryId, schema.categories.id),
    )
    .leftJoin(parent, eq(schema.categories.parentId, parent.id))
    .where(inArray(schema.orderItems.orderId, ids.length ? ids : [-1]))
    .orderBy(asc(schema.orderItems.orderId), asc(schema.orderItems.id));
  const items: ReportItem[] = itemRows.map((i) => ({
    ...i,
    parentCategoryName: i.parentCategoryName ?? "",
  }));

  // Pesanan omzet pertama per pembeli sepanjang masa (semua lokasi), untuk pembeli baru dibanding kembali.
  const keys = [...new Set(orders.map((o) => o.buyerKey))];
  const firstRevenueAt = new Map<string, Date>();
  if (keys.length) {
    const keyExpr = sql<string>`case when ${schema.orders.customerId} is not null then 'c:' || ${schema.orders.customerId} else 't:' || coalesce(${schema.orders.guestPhone}, ${schema.orders.number}) end`;
    const firsts = await db
      .select({
        key: keyExpr,
        first: sql<string>`min(${schema.orders.paidAt})`,
      })
      .from(schema.orders)
      .where(
        and(
          isNotNull(schema.orders.paidAt),
          notInArray(schema.orders.status, [...REVENUE_EXCLUDED]),
        ),
      )
      .groupBy(keyExpr);
    const wanted = new Set(keys);
    for (const f of firsts)
      if (wanted.has(f.key)) firstRevenueAt.set(f.key, new Date(f.first));
  }

  const slots = await db
    .select({
      id: schema.flashSales.id,
      name: schema.flashSales.name,
      startsAt: schema.flashSales.startsAt,
      endsAt: schema.flashSales.endsAt,
      source: schema.flashSales.source,
    })
    .from(schema.flashSales)
    .where(
      and(
        gte(schema.flashSales.startsAt, from),
        lt(schema.flashSales.startsAt, to),
      ),
    )
    .orderBy(asc(schema.flashSales.startsAt));
  const slotItems = slots.length
    ? await db
        .select({
          id: schema.flashSaleItems.id,
          flashSaleId: schema.flashSaleItems.flashSaleId,
          quota: schema.flashSaleItems.quota,
          sold: schema.flashSaleItems.sold,
        })
        .from(schema.flashSaleItems)
        .where(
          inArray(
            schema.flashSaleItems.flashSaleId,
            slots.map((s) => s.id),
          ),
        )
    : [];
  const codes = [
    ...new Set(
      orders.map((o) => o.voucherCode).filter((c): c is string => Boolean(c)),
    ),
  ];
  const vouchers = codes.length
    ? await db
        .select({
          code: schema.vouchers.code,
          title: schema.vouchers.title,
          quota: schema.vouchers.quota,
          used: schema.vouchers.used,
        })
        .from(schema.vouchers)
        .where(inArray(schema.vouchers.code, codes))
    : [];

  return {
    range,
    orders,
    items,
    firstRevenueAt,
    flashSlots: slots.map((s) => ({
      ...s,
      items: slotItems
        .filter((i) => i.flashSaleId === s.id)
        .map(({ id, quota, sold }) => ({ id, quota, sold })),
    })),
    vouchers,
  };
}
