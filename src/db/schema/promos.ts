import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { voucherTypeEnum } from "./enums";
import { variants } from "./catalog";
import { customers } from "./customers";
import { orders } from "./orders";

export const flashSales = pgTable(
  "flash_sales",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    isActive: boolean().notNull().default(true),
    // "admin" (dibuat staf) atau "otomatis" (ensureFlashSaleSlots). Slot admin selalu menang.
    source: text().notNull().default("otomatis"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("flash_sales_window_idx").on(t.startsAt, t.endsAt)],
);

export const flashSaleItems = pgTable(
  "flash_sale_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    flashSaleId: integer()
      .notNull()
      .references(() => flashSales.id, { onDelete: "cascade" }),
    variantId: integer()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    flashPrice: integer().notNull(),
    quota: integer().notNull(),
    sold: integer().notNull().default(0),
    maxPerCustomer: integer().notNull().default(2),
  },
  (t) => [uniqueIndex("flash_sale_items_sale_variant_idx").on(t.flashSaleId, t.variantId)],
);

export type VoucherScope = {
  categoryIds?: number[];
  brandIds?: number[];
};

export const vouchers = pgTable(
  "vouchers",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    type: voucherTypeEnum().notNull(),
    value: integer().notNull(), // rupiah untuk nominal/ongkir, persen untuk persen
    maxDiscount: integer(),
    minSpend: integer().notNull().default(0),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    quota: integer(),
    quotaPerCustomer: integer().notNull().default(1),
    used: integer().notNull().default(0),
    scope: jsonb().$type<VoucherScope>().notNull().default({}),
    stackWithFlash: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    // Fase 8C: voucher yang boleh ditawarkan ke semua pembeli (Tanya Rona). Voucher lain hanya dibagikan langsung.
    isPublic: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vouchers_code_idx").on(t.code)],
);

export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    voucherId: integer()
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    customerId: integer().references(() => customers.id),
    guestPhone: text(),
    orderId: integer().references(() => orders.id, { onDelete: "set null" }),
    discount: integer().notNull().default(0),
    redeemedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("voucher_redemptions_voucher_idx").on(t.voucherId, t.customerId)],
);
