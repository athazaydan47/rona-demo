// Daftar pesanan milik pembeli untuk /akun/pesanan: tab per status dan paginasi.
import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";
import type { OrderStatus } from "@/lib/orders/status";

export const ORDER_TABS = [
  { key: "semua", label: "Semua", statuses: null },
  { key: "belum-bayar", label: "Belum Bayar", statuses: ["menunggu_pembayaran"] },
  { key: "diproses", label: "Diproses", statuses: ["dibayar", "diproses", "siap_diambil"] },
  { key: "dikirim", label: "Dikirim", statuses: ["dikirim"] },
  { key: "selesai", label: "Selesai", statuses: ["selesai"] },
  { key: "batal", label: "Batal dan Retur", statuses: ["dibatalkan", "diretur"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly OrderStatus[] | null }[];

export type OrderTabKey = (typeof ORDER_TABS)[number]["key"];
export const ACTIVE_STATUSES: OrderStatus[] = ["menunggu_pembayaran", "dibayar", "diproses", "dikirim", "siap_diambil"];
export const ORDERS_PAGE_SIZE = 5;

export type AccountOrderCard = {
  id: number;
  number: string;
  status: OrderStatus;
  method: "kirim" | "ambil";
  createdAt: Date;
  total: number;
  itemCount: number;
  items: { orderItemId: number; variantId: number; productName: string; shadeName: string; brandName: string; brandColor: string; packaging: Packaging; hex: string; productSlug: string; reviewed: boolean }[];
};

export async function listCustomerOrders(db: AnyDb, customerId: number, opts: { tab?: string; page?: number; pageSize?: number; statuses?: OrderStatus[] } = {}) {
  const tab = ORDER_TABS.find((t) => t.key === opts.tab) ?? ORDER_TABS[0];
  const statuses = opts.statuses ?? (tab.statuses ? [...tab.statuses] : null);
  const pageSize = opts.pageSize ?? ORDERS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where: SQL = statuses ? and(eq(schema.orders.customerId, customerId), inArray(schema.orders.status, statuses))! : eq(schema.orders.customerId, customerId);
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(schema.orders).where(where),
    db
      .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, method: schema.orders.method, createdAt: schema.orders.createdAt, total: schema.orders.total })
      .from(schema.orders)
      .where(where)
      .orderBy(desc(schema.orders.createdAt), desc(schema.orders.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db
        .select({
          orderId: schema.orderItems.orderId,
          orderItemId: schema.orderItems.id,
          variantId: schema.orderItems.variantId,
          quantity: schema.orderItems.quantity,
          productName: schema.orderItems.productName,
          shadeName: schema.orderItems.shadeName,
          brandName: schema.orderItems.brandName,
          brandColor: schema.brands.color,
          packaging: schema.products.packaging,
          hex: schema.variants.hex,
          productSlug: schema.products.slug,
          reviewId: schema.reviews.id,
        })
        .from(schema.orderItems)
        .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
        .leftJoin(schema.reviews, eq(schema.reviews.orderItemId, schema.orderItems.id))
        .where(inArray(schema.orderItems.orderId, ids))
        .orderBy(asc(schema.orderItems.id))
    : [];
  const cards: AccountOrderCard[] = rows.map((r) => {
    const mine = items.filter((i) => i.orderId === r.id);
    // Satu varian bisa terpecah jadi beberapa baris (flash sale + harga biasa); tampilkan sekali.
    const seen = new Set<number>();
    const unique = mine.filter((i) => (seen.has(i.variantId) ? false : (seen.add(i.variantId), true)));
    const reviewedVariants = new Set(mine.filter((i) => i.reviewId != null).map((i) => i.variantId));
    return {
      ...r,
      itemCount: mine.reduce((s, i) => s + i.quantity, 0),
      items: unique.map((i) => ({ orderItemId: i.orderItemId, variantId: i.variantId, productName: i.productName, shadeName: i.shadeName, brandName: i.brandName, brandColor: i.brandColor, packaging: i.packaging, hex: i.hex, productSlug: i.productSlug, reviewed: reviewedVariants.has(i.variantId) })),
    };
  });
  return { orders: cards, total: Number(total), page, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)), tab: tab.key as OrderTabKey };
}
