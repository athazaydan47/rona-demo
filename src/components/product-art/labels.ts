// Label bentuk kemasan dan tampilan detail ProductArt. Dipisah dari shapes.tsx (Fase 8B) supaya komponen klien yang
// hanya butuh <img> packshot tidak ikut memuat semua gambar SVG.
import type { Packaging } from "@/db/schema/enums";

export const packagingLabels: Record<Packaging, string> = {
  lipstick: "Lipstick",
  lip_tint: "Lip tint",
  lip_cream: "Lip cream",
  cushion: "Cushion",
  foundation_bottle: "Botol foundation",
  sunscreen_tube: "Tube sunscreen",
  serum_dropper: "Botol serum pipet",
  toner_bottle: "Botol toner",
  cream_jar: "Jar krim",
  mascara: "Mascara",
  eyeshadow_palette: "Palet eyeshadow",
  perfume_bottle: "Botol parfum",
  lotion_pump: "Botol pompa",
  sheet_mask: "Sachet sheet mask",
};

export const detailLabels: Record<Packaging, string> = {
  lipstick: "Peluru keluar, tutup rebah",
  lip_tint: "Aplikator doe-foot dicabut",
  lip_cream: "Aplikator doe-foot dicabut",
  cushion: "Tertutup dari atas",
  foundation_bottle: "Olesan cairan shade",
  sunscreen_tube: "Tube rebah, krim keluar",
  serum_dropper: "Pipet terangkat, satu tetes",
  toner_bottle: "Kapas basah",
  cream_jar: "Tutup terbuka, tekstur krim",
  mascara: "Sikat dicabut",
  eyeshadow_palette: "Close-up 3 pan dan swatch",
  perfume_bottle: "Sudut 3/4 dengan pantulan",
  lotion_pump: "Setetes lotion",
  sheet_mask: "Lembar masker terbuka",
};
