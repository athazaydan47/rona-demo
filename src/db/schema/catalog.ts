import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  finishEnum,
  locationTypeEnum,
  packagingEnum,
  productStatusEnum,
  restockStatusEnum,
  stockMovementTypeEnum,
  undertoneEnum,
} from "./enums";
import { customers } from "./customers";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

export const brands = pgTable(
  "brands",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    slug: text().notNull(),
    color: text().notNull(), // warna merek (hex) untuk ProductArt dan etalase merek
    tagline: text().notNull().default(""),
    description: text().notNull().default(""),
    priceMin: integer().notNull().default(0),
    priceMax: integer().notNull().default(0),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("brands_slug_idx").on(t.slug)],
);

export const categories = pgTable(
  "categories",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    slug: text().notNull(),
    parentId: integer().references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    sortOrder: integer().notNull().default(0),
    description: text().notNull().default(""),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("categories_slug_idx").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
  ],
);

export type OpeningHours = Record<
  "sen" | "sel" | "rab" | "kam" | "jum" | "sab" | "min",
  { open: string; close: string } | null
>;

export const locations = pgTable("locations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  type: locationTypeEnum().notNull(),
  address: text().notNull().default(""),
  district: text().notNull().default(""),
  city: text().notNull().default("Kota Malang"),
  phone: text().notNull().default(""),
  lat: doublePrecision(),
  lng: doublePrecision(),
  openingHours: jsonb().$type<OpeningHours>(),
  hoursLabel: text().notNull().default(""),
  canPickup: boolean().notNull().default(false),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
});

export const products = pgTable(
  "products",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    slug: text().notNull(),
    brandId: integer()
      .notNull()
      .references(() => brands.id),
    categoryId: integer()
      .notNull()
      .references(() => categories.id),
    shortDescription: text().notNull().default(""),
    benefits: text().notNull().default(""), // tab Manfaat
    ingredients: text().notNull().default(""), // tab Kandungan
    howToUse: text().notNull().default(""), // tab Cara Pakai
    activeIngredients: text().array().notNull().default(sql`'{}'::text[]`),
    skinTypes: text().array().notNull().default(sql`'{}'::text[]`),
    skinConcerns: text().array().notNull().default(sql`'{}'::text[]`),
    finish: finishEnum(),
    spf: integer(),
    bpom: text().notNull().default(""),
    netto: text().notNull().default(""),
    packaging: packagingEnum().notNull(),
    status: productStatusEnum().notNull().default("aktif"),
    ratingAvg: doublePrecision().notNull().default(0),
    reviewCount: integer().notNull().default(0),
    soldCount: integer().notNull().default(0),
    isNew: boolean().notNull().default(false),
    isBestseller: boolean().notNull().default(false),
    searchText: text().notNull().default(""),
    seoTitle: text(),
    seoDescription: text(),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_brand_idx").on(t.brandId),
    index("products_category_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
    // Trigram untuk pencarian tahan salah ketik, full-text untuk relevansi.
    index("products_search_trgm_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
    index("products_search_fts_idx").using("gin", sql`to_tsvector('simple', ${t.searchText})`),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    shadeName: text().notNull(),
    shadeSlug: text().notNull(),
    hex: text().notNull(),
    undertone: undertoneEnum(),
    depth: integer(), // 1 (paling terang) sampai 6 (paling gelap)
    sku: text().notNull(),
    barcode: text().notNull().default(""),
    weightGram: integer().notNull().default(100),
    normalPrice: integer().notNull(),
    salePrice: integer().notNull(),
    promoPrice: integer(),
    promoStartsAt: timestamp({ withTimezone: true }),
    promoEndsAt: timestamp({ withTimezone: true }),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("variants_sku_idx").on(t.sku),
    uniqueIndex("variants_product_shade_idx").on(t.productId, t.shadeSlug),
    index("variants_product_idx").on(t.productId),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    variantId: integer()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    locationId: integer()
      .notNull()
      .references(() => locations.id),
    onHand: integer().notNull().default(0), // stok fisik
    reserved: integer().notNull().default(0), // dipesan
    ...timestamps,
  },
  (t) => [
    uniqueIndex("inventory_variant_location_idx").on(t.variantId, t.locationId),
    index("inventory_location_idx").on(t.locationId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    variantId: integer()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    locationId: integer()
      .notNull()
      .references(() => locations.id),
    type: stockMovementTypeEnum().notNull(),
    quantity: integer().notNull(), // positif masuk, negatif keluar
    reference: text().notNull().default(""),
    note: text().notNull().default(""),
    actor: text().notNull().default("sistem"), // nama staf atau "sistem"
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_variant_idx").on(t.variantId, t.createdAt),
    index("stock_movements_location_idx").on(t.locationId, t.createdAt),
  ],
);

export const restockRequests = pgTable(
  "restock_requests",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    variantId: integer()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    customerId: integer().references(() => customers.id),
    contact: text().notNull(), // nomor WA atau email
    status: restockStatusEnum().notNull().default("menunggu"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("restock_requests_variant_idx").on(t.variantId, t.status)],
);
