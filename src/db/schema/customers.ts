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

// Bentuk data profil kulit (customers.skin_profile). Diisi formulir di /akun (Fase 5) dan kuis kulit (Fase 7).
// Dicatat juga di docs/BRIEF.md bagian Profil kulit.
export type SkinProfile = {
  skinType?: "normal" | "kering" | "berminyak" | "kombinasi" | "sensitif";
  concerns?: ("jerawat" | "kusam" | "pori" | "penuaan" | "dehidrasi")[];
  sensitivity?: "rendah" | "sedang" | "tinggi";
  undertone?: "warm" | "neutral" | "cool";
  depth?: number; // 1 sampai 6, sama dengan Shade Finder
  finish?: "matte" | "satin" | "glowy";
  budget?: number; // rupiah per produk
  routine?: string;
  source?: "formulir" | "kuis";
  updatedAt?: string; // ISO
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
    // Kode wilayah (dataset cahyadsn/wilayah) supaya pemilih wilayah dan zona ongkir bisa dipulihkan.
    provinceCode: text(),
    regencyCode: text(),
    districtCode: text(),
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
    // Asal item (Fase 7A), misal "advisor" bila ditambahkan dari Rona Advisor; diteruskan ke order_items.
    source: text(),
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
    // Kunci unik per gerakan (misal "dapat:RONA-2610-000001") supaya pemberian dan penarikan poin idempoten.
    idempotencyKey: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("points_ledger_customer_idx").on(t.customerId, t.createdAt), uniqueIndex("points_ledger_idempotency_idx").on(t.idempotencyKey)],
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
    readAt: timestamp({ withTimezone: true }),
    // Pengiriman lewat adapter email (Fase 6C): jumlah percobaan, error terakhir, kunci klaim supaya tidak dobel.
    attempts: integer().notNull().default(0),
    lastError: text(),
    claimedAt: timestamp({ withTimezone: true }),
    providerId: text(),
  },
  (t) => [index("notifications_customer_idx").on(t.customerId, t.createdAt), index("notifications_order_idx").on(t.orderId), index("notifications_recipient_idx").on(t.recipient, t.createdAt), index("notifications_status_idx").on(t.channel, t.status, t.createdAt)],
);

// Kode OTP masuk dan ganti nomor. Kode disimpan sebagai HMAC, tidak pernah teks asli.
// Tabel ini juga sumber rate limit (per nomor dan per IP) karena aplikasi serverless tidak punya memori bersama.
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    phone: text().notNull(),
    purpose: text().notNull().default("masuk"), // "masuk" atau "ganti_nomor"
    customerId: integer().references(() => customers.id, { onDelete: "cascade" }),
    codeHash: text().notNull(),
    ipHash: text().notNull().default(""),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_codes_phone_idx").on(t.phone, t.createdAt), index("otp_codes_ip_idx").on(t.ipHash, t.createdAt)],
);

// Sesi masuk pembeli. Token acak hanya ada di cookie; database menyimpan hash-nya sehingga sesi bisa dicabut.
export const sessions = pgTable(
  "sessions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tokenHash: text().notNull(),
    customerId: integer()
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    userAgent: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_customer_idx").on(t.customerId)],
);
