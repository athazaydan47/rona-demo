import type { Packaging } from "../schema";
import type { BrandSlug } from "./brands";

export type Undertone = "warm" | "neutral" | "cool";

export type VariantSpec = {
  name: string;
  hex: string;
  undertone?: Undertone;
  depth?: number;
  weightGram?: number;
  priceDelta?: number; // tambahan harga dari harga dasar (untuk ukuran besar)
};

export type ProductKind =
  | "cleanser"
  | "toner"
  | "serum"
  | "moisturizer"
  | "sheetmask"
  | "eyecream"
  | "spot"
  | "exfoliant"
  | "bundle"
  | "cushion"
  | "foundation"
  | "powder"
  | "concealer"
  | "blush"
  | "highlighter"
  | "contour"
  | "primer"
  | "settingspray"
  | "mascara"
  | "liner"
  | "eyeshadow"
  | "brow"
  | "lash"
  | "lipstick"
  | "tint"
  | "lipcream"
  | "gloss"
  | "balm"
  | "sunscreen"
  | "bodylotion"
  | "bodywash"
  | "scrub"
  | "deo"
  | "shampoo"
  | "hairmask"
  | "hairserum"
  | "perfume"
  | "mist"
  | "pomade";

export type ProductSeed = {
  brand: BrandSlug;
  category: string; // nama sub kategori persis seperti di BRIEF
  name: string;
  kind: ProductKind;
  packaging: Packaging;
  short: string;
  benefits: string;
  active: string[];
  skinTypes: string[];
  concerns?: string[];
  finish?: "matte" | "satin" | "glowy";
  spf?: number;
  netto: string;
  weightGram: number;
  normalPrice: number;
  salePrice: number;
  variants: VariantSpec[];
  isNew?: boolean;
  isBestseller?: boolean;
  popularity: number; // 1 sampai 10, memengaruhi jumlah ulasan dan terjual
};
