import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  orderMethodEnum,
  orderStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  priceSourceEnum,
} from "./enums";
import { locations, variants } from "./catalog";
import { flashSaleItems } from "./promos";
import { customers } from "./customers";

export type OrderAddressSnapshot = {
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  street: string;
  lat?: number;
  lng?: number;
};

export type ShipmentEvent = { at: string; status: string; note?: string };

// Salinan rincian harga saat pesanan dibuat (dari mesin harga), untuk ditampilkan apa adanya.
export type OrderPricingSnapshot = {
  normalSubtotal: number;
  subtotal: number;
  productDiscount: number;
  voucherCode: string | null;
  voucherDiscount: number;
  shippingCost: number;
  shippingDiscount: number;
  pointsUsed: number;
  total: number;
  weightGram: number;
  billableKg: number;
};

export const orders = pgTable(
  "orders",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    number: text().notNull(), // RONA-2610-000123
    customerId: integer().references(() => customers.id),
    guestName: text(),
    guestPhone: text(),
    guestEmail: text(),
    method: orderMethodEnum().notNull(),
    locationId: integer()
      .notNull()
      .references(() => locations.id), // lokasi asal stok
    shippingAddress: jsonb().$type<OrderAddressSnapshot>(),
    courier: text(),
    service: text(),
    shippingCost: integer().notNull().default(0),
    shippingDiscount: integer().notNull().default(0),
    subtotal: integer().notNull().default(0),
    productDiscount: integer().notNull().default(0),
    voucherDiscount: integer().notNull().default(0),
    discount: integer().notNull().default(0), // total potongan (voucher + ongkir), untuk laporan
    pricing: jsonb().$type<OrderPricingSnapshot>(),
    voucherCode: text(),
    pointsUsed: integer().notNull().default(0),
    total: integer().notNull().default(0),
    status: orderStatusEnum().notNull().default("menunggu_pembayaran"),
    expiresAt: timestamp({ withTimezone: true }),
    note: text().notNull().default(""),
    cancelReason: text(),
    // Token acak untuk membuka pesanan tamu lewat tautan.
    accessToken: text().notNull().default(""),
    paidAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    index("orders_status_created_idx").on(t.status, t.createdAt),
    index("orders_customer_idx").on(t.customerId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer()
      .notNull()
      .references(() => variants.id),
    productName: text().notNull(),
    shadeName: text().notNull(),
    brandName: text().notNull().default(""),
    unitPrice: integer().notNull(),
    normalPrice: integer().notNull().default(0),
    quantity: integer().notNull(),
    priceSource: priceSourceEnum().notNull().default("normal"),
    flashSaleItemId: integer().references(() => flashSaleItems.id, { onDelete: "set null" }),
    weightGram: integer().notNull().default(0),
    // Asal item dari keranjang (Fase 7A), misal "advisor" untuk mengukur penjualan dari Rona Advisor.
    source: text(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_flash_idx").on(t.flashSaleItemId)],
);

export const payments = pgTable(
  "payments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: paymentMethodEnum().notNull(),
    vaNumber: text(),
    qrPayload: text(),
    amount: integer().notNull(),
    status: paymentStatusEnum().notNull().default("menunggu"),
    idempotencyKey: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_idempotency_idx").on(t.idempotencyKey),
    index("payments_order_idx").on(t.orderId),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: text().notNull(),
    service: text().notNull().default(""),
    trackingNumber: text(),
    status: text().notNull().default("menunggu"),
    history: jsonb().$type<ShipmentEvent[]>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipments_order_idx").on(t.orderId)],
);

// Riwayat transisi status untuk lini masa pesanan.
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum(),
    toStatus: orderStatusEnum().notNull(),
    actor: text().notNull(), // "sistem", "pembeli", "staf demo", atau nama staf
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.createdAt)],
);

// Penghitung nomor pesanan per bulan (YYMM). Dinaikkan dengan upsert supaya aman saat bersamaan.
export const orderNumberCounters = pgTable("order_number_counters", {
  period: text().primaryKey(),
  lastValue: integer().notNull().default(0),
});
