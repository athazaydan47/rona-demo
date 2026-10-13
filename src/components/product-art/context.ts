import type { Packaging } from "@/db/schema/enums";
import { darken, lighten, luminance, mix, readableOn } from "@/lib/color";

// "depan": packshot utama. "detail": adegan pelengkap per bentuk (aplikator, tetesan, olesan, dan sebagainya).
export type ProductArtView = "depan" | "detail";

export type ArtCtx = {
  id: string;
  view: ProductArtView;
  packaging: Packaging;
  shade: string; // warna isi: peluru, cairan, pan, krim. Untuk skincare: warna produk dari data.
  brand: string; // warna merek: badan kemasan, tutup, label.
  brandName: string;
  shadeLight: string;
  shadeDark: string;
  shadePale: string; // isi yang diencerkan (olesan tipis, kapas basah)
  brandLight: string;
  brandDark: string;
  brandDeep: string; // sangat gelap, untuk dasar palet dan bayangan merek
  tubeDark: string; // mascara dan eyeliner: merek bila sudah gelap, kalau tidak hitam hangat
  ink: string;
  gold: string;
  cream: string; // krim putih gading untuk lotion dan sunscreen yang keluar
  textOnBrand: string;
  textOnBrandDark: string;
  textOnShade: string;
};

export const INK = "#2B2426";
export const GOLD = "#C9A35C";
export const KOPI = "#2A1F1D";
export const CREAM = "#FBF6EE";

export function buildCtx(input: {
  id: string;
  view: ProductArtView;
  packaging: Packaging;
  shade: string;
  brand: string;
  brandName: string;
}): ArtCtx {
  const shade = normalizeHex(input.shade, "#D9A98B");
  const brand = normalizeHex(input.brand, "#B8475D");
  const brandDark = darken(brand, 0.3);
  return {
    ...input,
    shade,
    brand,
    shadeLight: lighten(shade, 0.22),
    shadeDark: darken(shade, 0.22),
    shadePale: mix(shade, "#FFFFFF", 0.45),
    brandLight: lighten(brand, 0.22),
    brandDark,
    brandDeep: darken(brand, 0.55),
    tubeDark: luminance(brand) < 0.08 ? brand : INK,
    ink: INK,
    gold: GOLD,
    cream: mix(CREAM, shade, 0.08),
    textOnBrand: readableOn(brand),
    textOnBrandDark: readableOn(brandDark),
    textOnShade: readableOn(shade),
  };
}

function normalizeHex(hex: string, fallback: string) {
  const h = (hex ?? "").trim();
  return /^#?[0-9a-fA-F]{6}$/.test(h) ? (h.startsWith("#") ? h : `#${h}`).toUpperCase() : fallback;
}
