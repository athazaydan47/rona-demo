// Visual etalase (Fase 8B): packshot contoh untuk lingkaran kategori, panel MegaMenu, dan hero beranda. Konten toko
// (merujuk merek dan shade dari seed demo), dipisah dari komponen supaya toko klien cukup mengganti data di sini.
import type { Packaging } from "@/db/schema/enums";

export type ArtContoh = { packaging: Packaging; shade: string; brand: string; brandName: string };

// Kategori utama: lingkaran kategori di beranda. Kategori tanpa entri memakai entri pertama.
export const ART_KATEGORI: Record<string, ArtContoh> = {
  skincare: { packaging: "serum_dropper", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab" },
  "makeup-wajah": { packaging: "cushion", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam" },
  "makeup-mata": { packaging: "mascara", shade: "#1B1818", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
  bibir: { packaging: "lipstick", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi" },
  "sun-care": { packaging: "sunscreen_tube", shade: "#FBE7B8", brand: "#E0A227", brandName: "Surya Shield" },
  "body-dan-hair": { packaging: "lotion_pump", shade: "#F3ECE4", brand: "#D98E8E", brandName: "Mekar" },
  fragrance: { packaging: "perfume_bottle", shade: "#E8F0DE", brand: "#7A4E8C", brandName: "Arunika" },
  pria: { packaging: "cream_jar", shade: "#C9B07A", brand: "#2E4057", brandName: "Nara Men" },
};

// Panel kanan MegaMenu per kategori (boleh beda dengan lingkaran kategori).
export const ART_MEGAMENU: Record<string, ArtContoh> = {
  ...ART_KATEGORI,
  "makeup-mata": { packaging: "eyeshadow_palette", shade: "#C5714F", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
};

export const artKategori = (slug: string, peta: Record<string, ArtContoh> = ART_KATEGORI) => peta[slug] ?? Object.values(peta)[0];

// Hero beranda di HP: tiga packshot berjajar.
export const HERO_HP: (ArtContoh & { judul: string; geser: string })[] = [
  { packaging: "serum_dropper", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab", judul: "Ilustrasi serum", geser: "translate-y-3" },
  { packaging: "cushion", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam", judul: "Ilustrasi cushion", geser: "-translate-y-2" },
  { packaging: "lipstick", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi", judul: "Ilustrasi lipstick", geser: "translate-y-4" },
];

// Hero desktop: packshot di atas podium (posisi dalam persen kanvas 640 x 520) dan dua swatch tekstur.
export const HERO_PACKSHOT: (ArtContoh & { left: string; top: string; width: string; bayangan: string })[] = [
  { packaging: "lotion_pump", shade: "#F3ECE4", brand: "#D98E8E", brandName: "Mekar", left: "26%", top: "6%", width: "30%", bayangan: "drop-shadow-[0_18px_22px_rgb(42_31_29/0.18)]" },
  { packaging: "perfume_bottle", shade: "#E8F0DE", brand: "#7A4E8C", brandName: "Arunika", left: "58%", top: "0%", width: "32%", bayangan: "drop-shadow-[0_18px_22px_rgb(42_31_29/0.18)]" },
  { packaging: "serum_dropper", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab", left: "8%", top: "34%", width: "28%", bayangan: "drop-shadow-[0_22px_26px_rgb(42_31_29/0.22)]" },
  { packaging: "cushion", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam", left: "44%", top: "26%", width: "40%", bayangan: "drop-shadow-[0_26px_30px_rgb(42_31_29/0.24)]" },
  { packaging: "lipstick", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi", left: "30%", top: "50%", width: "22%", bayangan: "drop-shadow-[0_26px_28px_rgb(42_31_29/0.26)]" },
  { packaging: "lip_tint", shade: "#E2654A", brand: "#C2416B", brandName: "Lumi", left: "60%", top: "54%", width: "20%", bayangan: "drop-shadow-[0_22px_26px_rgb(42_31_29/0.22)]" },
];
export const HERO_SWATCH: { shade: string; texture: "krim" | "satin"; left: string; top: string; width: string; putar: string }[] = [
  { shade: "#B8475D", texture: "krim", left: "12%", top: "22%", width: "26%", putar: "rotate-[-8deg]" },
  { shade: "#DAB085", texture: "satin", left: "70%", top: "78%", width: "22%", putar: "rotate-[10deg]" },
];
