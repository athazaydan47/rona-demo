import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { reviewStatusEnum } from "./enums";
import { products, variants } from "./catalog";
import { customers } from "./customers";
import { orderItems } from "./orders";

export const reviews = pgTable(
  "reviews",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderItemId: integer().references(() => orderItems.id, { onDelete: "set null" }),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: integer().references(() => variants.id, { onDelete: "set null" }),
    customerId: integer().references(() => customers.id, { onDelete: "set null" }),
    authorName: text().notNull(),
    rating: integer().notNull(),
    body: text().notNull(),
    photos: text().array().notNull().default(sql`'{}'::text[]`),
    skinType: text(),
    isVerified: boolean().notNull().default(true),
    status: reviewStatusEnum().notNull().default("tampil"),
    storeReply: text(),
    repliedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId, t.status, t.createdAt),
    index("reviews_customer_idx").on(t.customerId),
  ],
);
