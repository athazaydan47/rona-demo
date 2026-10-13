import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { notificationChannelEnum, notificationStatusEnum } from "./enums";
import { products, variants } from "./catalog";

export type SkinProfile = {
  skinType?: string;
  concerns?: string[];
  sensitivity?: "rendah" | "sedang" | "tinggi";
  budget?: number;
  undertone?: "warm" | "neutral" | "cool";
  depth?: number;
  routine?: string;
  updatedAt?: string;
};

export const customers = pgTable(
  "customers",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    phone: text().notNull(),
    email: text(),
    points: integer().notNull().default(0),
    skinProfile: jsonb().$type<SkinProfile>(),
    registeredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("customers_phone_idx").on(t.phone)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer()
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text().notNull().default("Rumah"),
    recipient: text().notNull(),
    phone: text().notNull(),
    province: text().notNull(),
    city: text().notNull(),
    district: text().notNull(),
    postalCode: text().notNull().default(""),
    street: text().notNull(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    isPrimary: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);

export const carts = pgTable(
  "carts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer().references(() => customers.id, { onDelete: "cascade" }),
    guestToken: uuid(),
    voucherCode: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("carts_guest_token_idx").on(t.guestToken),
    index("carts_customer_idx").on(t.customerId),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    cartId: integer()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: integer()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    quantity: integer().notNull().default(1),
    savedForLater: boolean().notNull().default(false),
    // Harga terakhir yang dilihat pembeli, untuk memberi tahu bila harga berubah (misal flash sale berakhir).
    seenPrice: integer(),
    seenSource: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cart_items_cart_variant_idx").on(t.cartId, t.variantId)],
);

export const wishlists = pgTable(
  "wishlists",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer()
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wishlists_customer_product_idx").on(t.customerId, t.productId)],
);

export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer()
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amount: integer().notNull(), // plus atau minus
    reason: text().notNull(),
    reference: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("points_ledger_customer_idx").on(t.customerId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer().references(() => customers.id, { onDelete: "cascade" }),
    // Pesanan terkait (bila ada) dan jenis peristiwa, misal "dibuat", "dibayar".
    orderId: integer(),
    kind: text().notNull().default(""),
    channel: notificationChannelEnum().notNull(),
    recipient: text().notNull(),
    subject: text().notNull().default(""),
    body: text().notNull(),
    status: notificationStatusEnum().notNull().default("antre"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("notifications_customer_idx").on(t.customerId, t.createdAt), index("notifications_order_idx").on(t.orderId), index("notifications_recipient_idx").on(t.recipient, t.createdAt)],
);
