// Perhitungan facet dari daftar produk dalam cakupan. Tiap dimensi dihitung dengan semua filter lain
// diterapkan kecuali dimensinya sendiri, supaya pilihan yang belum dipilih tetap terlihat beserta jumlahnya.
import { productMatches, variantMatches, type CatalogFilters, type CatalogItem, type FacetKey } from "./filters";

export type FacetCount = { value: string; count: number };

export type CatalogFacets = {
  brands: FacetCount[];
  skinTypes: FacetCount[];
  concerns: FacetCount[];
  finishes: FacetCount[];
  undertones: FacetCount[];
  locations: FacetCount[];
  ratings: FacetCount[]; // value "4" berarti 4 ke atas
  spf: number;
  promo: number;
  price: { min: number; max: number } | null;
};

function tally(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sorted(map: Map<string, number>, order?: string[]): FacetCount[] {
  const list = [...map.entries()].map(([value, count]) => ({ value, count }));
  if (order) return list.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
  return list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "id"));
}

export const RATING_STEPS = [4.5, 4, 3];

export function computeFacets(items: CatalogItem[], f: CatalogFilters, order: Partial<Record<"skinTypes" | "concerns" | "finishes" | "undertones", string[]>> = {}): CatalogFacets {
  const brands = new Map<string, number>();
  const skinTypes = new Map<string, number>();
  const concerns = new Map<string, number>();
  const finishes = new Map<string, number>();
  const undertones = new Map<string, number>();
  const locations = new Map<string, number>();
  const ratings = new Map<string, number>();
  let spf = 0;
  let promo = 0;
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = Number.NEGATIVE_INFINITY;

  const matchesExcept = (item: CatalogItem, skip: FacetKey) => productMatches(item, f, skip);

  for (const item of items) {
    if (matchesExcept(item, "brands")) tally(brands, item.brandSlug);
    if (matchesExcept(item, "skinTypes")) for (const s of item.skinTypes) tally(skinTypes, s);
    if (matchesExcept(item, "concerns")) for (const c of item.concerns) tally(concerns, c);
    if (matchesExcept(item, "finishes") && item.finish) tally(finishes, item.finish);
    if (matchesExcept(item, "spf") && item.spf && item.spf > 0) spf += 1;
    if (matchesExcept(item, "rating") && item.reviewCount > 0) {
      for (const step of RATING_STEPS) if (item.ratingAvg >= step) tally(ratings, String(step));
    }
    // Dimensi varian: produk dihitung sekali per nilai bila ada varian yang cocok dengan filter lain.
    if (productLevelOk(item, f, "undertones")) {
      const seen = new Set<string>();
      for (const v of item.variants) if (v.undertone && variantMatches(v, f, "undertones")) seen.add(v.undertone);
      for (const u of seen) tally(undertones, u);
    }
    if (productLevelOk(item, f, "location")) {
      const seen = new Set<string>();
      for (const v of item.variants) {
        if (!variantMatches(v, f, "location")) continue;
        for (const [slug, qty] of Object.entries(v.stockByLocation)) if (qty > 0) seen.add(slug);
      }
      for (const l of seen) tally(locations, l);
    }
    if (productLevelOk(item, f, "promo") && item.variants.some((v) => variantMatches(v, f, "promo") && v.price < v.normalPrice)) promo += 1;
    if (productLevelOk(item, f, "price")) {
      for (const v of item.variants) {
        if (!variantMatches(v, f, "price")) continue;
        priceMin = Math.min(priceMin, v.price);
        priceMax = Math.max(priceMax, v.price);
      }
    }
  }

  return {
    brands: sorted(brands),
    skinTypes: sorted(skinTypes, order.skinTypes),
    concerns: sorted(concerns, order.concerns),
    finishes: sorted(finishes, order.finishes),
    undertones: sorted(undertones, order.undertones),
    locations: sorted(locations),
    ratings: sorted(ratings, RATING_STEPS.map(String)),
    spf,
    promo,
    price: Number.isFinite(priceMin) ? { min: priceMin, max: priceMax } : null,
  };
}

// Filter tingkat produk saja (tanpa syarat varian), dengan satu dimensi dilewati.
function productLevelOk(item: CatalogItem, f: CatalogFilters, skip: FacetKey) {
  if (skip !== "brands" && f.brands.length && !f.brands.includes(item.brandSlug)) return false;
  if (skip !== "rating" && f.ratingMin != null && (item.reviewCount === 0 || item.ratingAvg < f.ratingMin)) return false;
  if (skip !== "skinTypes" && f.skinTypes.length && !f.skinTypes.some((s) => item.skinTypes.includes(s))) return false;
  if (skip !== "concerns" && f.concerns.length && !f.concerns.some((c) => item.concerns.includes(c))) return false;
  if (skip !== "finishes" && f.finishes.length && (!item.finish || !f.finishes.includes(item.finish))) return false;
  if (skip !== "spf" && f.spf && !(item.spf && item.spf > 0)) return false;
  return true;
}
