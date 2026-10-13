import type { Packaging } from "@/db/schema/enums";
import { darken, lighten, mix, readableOn } from "@/lib/color";

export type ProductArtView = "front" | "side";

export type ArtCtx = {
  id: string;
  view: ProductArtView;
  packaging: Packaging;
  shade: string;
  brand: string;
  brandName: string;
  // Warna turunan yang sering dipakai bentuk kemasan.
  shadeLight: string;
  shadeDark: string;
  pastel: string; // shade yang dilembutkan ke arah putih, untuk kemasan plastik terang
  brandLight: string;
  brandDark: string;
  ink: string; // hampir hitam hangat untuk tutup
  gold: string;
  textOnBrand: string;
  textOnPastel: string;
  textOnShade: string;
};

export const INK = "#2B2426";
export const GOLD = "#C9A35C";
export const KOPI = "#2A1F1D";

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
  const pastel = mix(shade, "#FFFFFF", 0.55);
  return {
    ...input,
    shade,
    brand,
    shadeLight: lighten(shade, 0.22),
    shadeDark: darken(shade, 0.22),
    pastel,
    brandLight: lighten(brand, 0.2),
    brandDark: darken(brand, 0.3),
    ink: INK,
    gold: GOLD,
    textOnBrand: readableOn(brand),
    textOnPastel: readableOn(pastel, KOPI, "#FFFFFF"),
    textOnShade: readableOn(shade),
  };
}

function normalizeHex(hex: string, fallback: string) {
  const h = (hex ?? "").trim();
  return /^#?[0-9a-fA-F]{6}$/.test(h) ? (h.startsWith("#") ? h : `#${h}`).toUpperCase() : fallback;
}
