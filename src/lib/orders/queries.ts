// Pembacaan detail pesanan untuk halaman bayar, sukses, dan pesanan. Selalu segar (tanpa cache).
import { timingSafeEqual } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";

export type OrderDetail = {
  id: number;
  number: string;
  status: (typeof schema.orderStatusEnum.enumValues)[number];
  method: "kirim" | "ambil";
  customerId: number | null;
  name: string;
  phone: string;
  email: string | null;
  accessToken: string;
  createdAt: Date;
  expiresAt: Date | null;
  paidAt: Date | null;
  completedAt: Date | null;
  cancelReason: string | null;
  note: string;
  courier: string | null;
  service: string | null;
  address: schema.OrderAddressSnapshot | null;
  pricing: schema.OrderPricingSnapshot;
  location: { name: string; slug: string; address: string; district: string; hoursLabel: string; phone: string };
  items: { id: number; variantId: number; productId: number; productName: string; shadeName: string; brandName: string; brandColor: string; productSlug: string; shadeSlug: string; packaging: Packaging; hex: string; showShade: boolean; unitPrice: number; normalPrice: number; quantity: number; priceSource: string }[];
  payment: { method: string; status: string; amount: number; vaNumber: string | null; qrPayload: string | null; expiresAt: Date | null; paidAt: Date | null; idempotencyKey: string } | null;
  history: { fromStatus: string | null; toStatus: string; actor: string; reason: string | null; at: Date }[];
  shipment: { courier: string; trackingNumber: string | null; status: string } | null;
};

export async function getOrderDetail(db: AnyDb, number: string): Promise<OrderDetail | null> {
  const [o] = await db
    .select({ order: schema.orders, location: schema.locations })
    .from(schema.orders)
    .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
    .where(eq(schema.orders.number, number.trim().toUpperCase()))
    .limit(1);
  if (!o) return null;
  const [items, payments, history, shipments] = await Promise.all([
    db
      .select({
        id: schema.orderItems.id,
        variantId: schema.orderItems.variantId,
        productName: schema.orderItems.productName,
        shadeName: schema.orderItems.shadeName,
        brandName: schema.orderItems.brandName,
        unitPrice: schema.orderItems.unitPrice,
        normalPrice: schema.orderItems.normalPrice,
        quantity: schema.orderItems.quantity,
        priceSource: schema.orderItems.priceSource,
        hex: schema.variants.hex,
        shadeSlug: schema.variants.shadeSlug,
        productSlug: schema.products.slug,
        packaging: schema.products.packaging,
        brandColor: schema.brands.color,
        productId: schema.products.id,
      })
      .from(schema.orderItems)
      .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
      .where(eq(schema.orderItems.orderId, o.order.id))
      .orderBy(asc(schema.orderItems.id)),
    db.select().from(schema.payments).where(eq(schema.payments.orderId, o.order.id)).orderBy(desc(schema.payments.id)).limit(1),
    db.select().from(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, o.order.id)).orderBy(asc(schema.orderStatusHistory.createdAt), asc(schema.orderStatusHistory.id)),
    db.select().from(schema.shipments).where(eq(schema.shipments.orderId, o.order.id)).limit(1),
  ]);
  const variantCounts = new Map<string, number>();
  for (const it of items) variantCounts.set(it.productSlug, (variantCounts.get(it.productSlug) ?? 0) + 1);
  const p = payments[0];
  const order = o.order;
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    method: order.method,
    customerId: order.customerId,
    name: order.guestName ?? "",
    phone: order.guestPhone ?? "",
    email: order.guestEmail,
    accessToken: order.accessToken,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
    cancelReason: order.cancelReason,
    note: order.note,
    courier: order.courier,
    service: order.service,
    address: order.shippingAddress,
    pricing: order.pricing ?? { normalSubtotal: order.subtotal, subtotal: order.subtotal, productDiscount: order.productDiscount, voucherCode: order.voucherCode, voucherDiscount: order.voucherDiscount, shippingCost: order.shippingCost, shippingDiscount: order.shippingDiscount, pointsUsed: order.pointsUsed, total: order.total, weightGram: 0, billableKg: 0 },
    location: { name: o.location.name, slug: o.location.slug, address: o.location.address, district: o.location.district, hoursLabel: o.location.hoursLabel, phone: o.location.phone },
    items: items.map((i) => ({ ...i, showShade: !/^\d+\s?(ml|g)$/i.test(i.shadeName) })),
    payment: p ? { method: p.method, status: p.status, amount: p.amount, vaNumber: p.vaNumber, qrPayload: p.qrPayload, expiresAt: p.expiresAt, paidAt: p.paidAt, idempotencyKey: p.idempotencyKey } : null,
    history: history.map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, actor: h.actor, reason: h.reason, at: h.createdAt })),
    shipment: shipments[0] ? { courier: shipments[0].courier, trackingNumber: shipments[0].trackingNumber, status: shipments[0].status } : null,
  };
}

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Pemilik yang sedang masuk selalu bisa membuka pesanannya. Tamu membuka lewat tautan bertoken,
// atau token tersimpan di cookie perangkat yang membuat pesanan.
export function canAccessOrder(order: { accessToken: string; customerId?: number | null }, token: string | null | undefined, cookieTokens: string[], viewerCustomerId?: number | null) {
  if (viewerCustomerId != null && order.customerId === viewerCustomerId) return true;
  if (token && safeEqual(token, order.accessToken)) return true;
  return cookieTokens.some((t) => safeEqual(t, order.accessToken));
}
