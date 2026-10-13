import { pgEnum } from "drizzle-orm/pg-core";

// Bentuk kemasan yang bisa digambar ProductArt (14 bentuk sesuai BRIEF).
export const packagingValues = [
  "lipstick",
  "lip_tint",
  "lip_cream",
  "cushion",
  "foundation_bottle",
  "sunscreen_tube",
  "serum_dropper",
  "toner_bottle",
  "cream_jar",
  "mascara",
  "eyeshadow_palette",
  "perfume_bottle",
  "lotion_pump",
  "sheet_mask",
] as const;
export type Packaging = (typeof packagingValues)[number];
export const packagingEnum = pgEnum("packaging", packagingValues);

export const productStatusEnum = pgEnum("product_status", ["aktif", "draf", "arsip"]);
export const finishEnum = pgEnum("finish", ["matte", "satin", "glowy"]);
export const undertoneEnum = pgEnum("undertone", ["warm", "neutral", "cool"]);
export const locationTypeEnum = pgEnum("location_type", ["gudang", "toko"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "masuk",
  "keluar",
  "transfer",
  "opname",
  "retur",
  "pesan",
  "lepas",
]);
export const orderMethodEnum = pgEnum("order_method", ["kirim", "ambil"]);
export const orderStatusEnum = pgEnum("order_status", [
  "menunggu_pembayaran",
  "dibayar",
  "diproses",
  "dikirim",
  "siap_diambil",
  "selesai",
  "dibatalkan",
  "diretur",
]);
export const priceSourceEnum = pgEnum("price_source", ["flash", "promo", "normal"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "qris",
  "va_bca",
  "va_bni",
  "va_bri",
  "va_mandiri",
  "bayar_di_toko",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "menunggu",
  "lunas",
  "kedaluwarsa",
  "batal",
]);
export const voucherTypeEnum = pgEnum("voucher_type", ["nominal", "persen", "ongkir"]);
export const reviewStatusEnum = pgEnum("review_status", ["tampil", "sembunyi", "menunggu"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["wa", "email"]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "antre",
  "terkirim",
  "gagal",
]);
export const restockStatusEnum = pgEnum("restock_status", ["menunggu", "terkirim"]);
export const skinTypeValues = ["normal", "kering", "berminyak", "kombinasi", "sensitif"] as const;
export type SkinType = (typeof skinTypeValues)[number];
export const skinConcernValues = ["jerawat", "kusam", "pori", "penuaan", "dehidrasi"] as const;
export type SkinConcern = (typeof skinConcernValues)[number];
