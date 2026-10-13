// Pemilihan rekomendasi halaman produk: murni, diuji di related.test.ts.
import { emptyFilters, sortItems, type CatalogItem } from "@/lib/catalog/filters";
import { hexToRgb } from "@/lib/color";

export type RelatedRef = { id: number; categorySlug: string; parentSlug: string | null; hex: string; price: number };

// Pelengkap per sub kategori: tiga sub kategori lain yang biasa dibeli bersama.
export const complements: Record<string, string[]> = {
  cushion: ["sunscreen-wajah", "primer-dan-setting-spray", "lip-tint"],
  foundation: ["primer-dan-setting-spray", "bedak", "concealer"],
  bedak: ["cushion", "blush", "primer-dan-setting-spray"],
  concealer: ["foundation", "bedak", "perawatan-mata"],
  blush: ["highlighter-dan-contour", "lip-tint", "cushion"],
  "highlighter-dan-contour": ["blush", "bedak", "primer-dan-setting-spray"],
  "primer-dan-setting-spray": ["cushion", "foundation", "sunscreen-wajah"],
  lipstick: ["lip-balm-dan-lip-care", "blush", "cushion"],
  "lip-tint": ["lip-balm-dan-lip-care", "blush", "cushion"],
  "lip-cream": ["lip-balm-dan-lip-care", "lip-gloss", "cushion"],
  "lip-gloss": ["lipstick", "lip-balm-dan-lip-care", "blush"],
  "lip-balm-dan-lip-care": ["lipstick", "lip-tint", "pelembap"],
  mascara: ["eyeliner", "alis", "eyeshadow"],
  eyeliner: ["mascara", "alis", "eyeshadow"],
  eyeshadow: ["primer-dan-setting-spray", "mascara", "eyeliner"],
  alis: ["mascara", "eyeliner", "highlighter-dan-contour"],
  "bulu-mata": ["mascara", "eyeliner", "eyeshadow"],
  pembersih: ["toner", "pelembap", "sunscreen-wajah"],
  toner: ["serum-dan-essence", "pelembap", "sunscreen-wajah"],
  "serum-dan-essence": ["toner", "pelembap", "sunscreen-wajah"],
  pelembap: ["serum-dan-essence", "sunscreen-wajah", "pembersih"],
  masker: ["toner", "pelembap", "serum-dan-essence"],
  "perawatan-mata": ["serum-dan-essence", "pelembap", "concealer"],
  "perawatan-jerawat": ["pembersih", "pelembap", "sunscreen-wajah"],
  "paket-skincare": ["sunscreen-wajah", "masker", "perawatan-mata"],
  "sunscreen-wajah": ["pelembap", "cushion", "pembersih"],
  "sunscreen-tubuh": ["body-lotion", "body-wash", "sunscreen-wajah"],
  "tinted-sunscreen": ["bedak", "lip-tint", "pelembap"],
  "body-lotion": ["body-wash", "scrub", "body-mist"],
  "body-wash": ["body-lotion", "scrub", "deodoran"],
  scrub: ["body-lotion", "body-wash", "body-mist"],
  deodoran: ["body-wash", "body-mist", "body-lotion"],
  shampoo: ["hair-treatment", "body-wash", "body-lotion"],
  "hair-treatment": ["shampoo", "body-lotion", "body-mist"],
  "eau-de-parfum": ["body-mist", "body-lotion", "scrub"],
  "body-mist": ["body-lotion", "eau-de-parfum", "body-wash"],
  "skincare-pria": ["rambut-pria", "parfum-pria", "sunscreen-wajah"],
  "rambut-pria": ["skincare-pria", "parfum-pria", "shampoo"],
  "parfum-pria": ["skincare-pria", "rambut-pria", "body-mist"],
};

// "Sering dibeli bersama": produk terlaris dari tiap sub kategori pelengkap, selalu kategori berbeda dari produk ini.
export function pickTogether(items: CatalogItem[], ref: RelatedRef, count = 3): CatalogItem[] {
  const others = items.filter((i) => i.id !== ref.id);
  const bySold = sortItems(others, { ...emptyFilters(), sort: "terlaris" });
  const out: CatalogItem[] = [];
  for (const sub of complements[ref.categorySlug] ?? []) {
    if (sub === ref.categorySlug) continue;
    const pick = bySold.find((i) => i.categorySlug === sub && !out.includes(i));
    if (pick) out.push(pick);
    if (out.length >= count) break;
  }
  for (const i of bySold) {
    if (out.length >= count) break;
    if (i.categorySlug !== ref.categorySlug && i.parentSlug !== ref.parentSlug && !out.includes(i)) out.push(i);
  }
  return out.slice(0, count);
}

// "Produk serupa": sub kategori sama, diurutkan dari warna shade dan harga yang paling mirip, lalu cadangan dari induk yang sama.
export function pickSimilar(items: CatalogItem[], ref: RelatedRef, count = 8): CatalogItem[] {
  const others = items.filter((i) => i.id !== ref.id);
  const baseRgb = hexToRgb(ref.hex);
  const similar = others
    .filter((i) => i.categorySlug === ref.categorySlug)
    .map((i) => {
      const v = i.variants[0];
      const rgb = hexToRgb(v.hex);
      const colorDist = Math.hypot(rgb.r - baseRgb.r, rgb.g - baseRgb.g, rgb.b - baseRgb.b) / 441;
      const priceDist = ref.price ? Math.min(1, Math.abs(v.price - ref.price) / ref.price) : 0;
      return { item: i, score: colorDist + priceDist };
    })
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, "id"))
    .slice(0, count)
    .map((s) => s.item);
  if (similar.length >= Math.min(4, count)) return similar;
  const bySold = sortItems(others, { ...emptyFilters(), sort: "terlaris" });
  const fallback = bySold.filter((i) => i.parentSlug === ref.parentSlug && !similar.includes(i)).slice(0, count - similar.length);
  return [...similar, ...fallback];
}
