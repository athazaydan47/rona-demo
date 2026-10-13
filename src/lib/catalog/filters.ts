// Filter katalog: parsing URL, predikat murni, dan pengurutan. Tidak menyentuh database.
import type { Packaging } from "@/db/schema/enums";

export const SORT_KEYS = ["relevan", "terlaris", "terbaru", "rating", "termurah", "termahal"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const sortLabels: Record<SortKey, string> = {
  relevan: "Paling relevan",
  terlaris: "Terlaris",
  terbaru: "Terbaru",
  rating: "Rating tertinggi",
  termurah: "Termurah",
  termahal: "Termahal",
};

export const skinTypeLabels: Record<string, string> = {
  normal: "Normal",
  kering: "Kering",
  berminyak: "Berminyak",
  kombinasi: "Kombinasi",
  sensitif: "Sensitif",
};
export const concernLabels: Record<string, string> = {
  jerawat: "Jerawat",
  kusam: "Kusam",
  pori: "Pori",
  penuaan: "Penuaan",
  dehidrasi: "Dehidrasi",
};
export const finishLabels: Record<string, string> = { matte: "Matte", satin: "Satin", glowy: "Glowy" };
export const undertoneLabels: Record<string, string> = { warm: "Warm", neutral: "Neutral", cool: "Cool" };

export type CatalogFilters = {
  q: string;
  brands: string[];
  priceMin: number | null;
  priceMax: number | null;
  ratingMin: number | null;
  skinTypes: string[];
  concerns: string[];
  finishes: string[];
  undertones: string[];
  spf: boolean;
  location: string | null; // slug cabang
  promo: boolean;
  sort: SortKey;
  page: number;
};

export const PAGE_SIZE = 24;

export type CatalogVariant = {
  id: number;
  shadeName: string;
  shadeSlug: string;
  hex: string;
  undertone: string | null;
  depth: number | null;
  price: number; // harga efektif sekarang
  normalPrice: number;
  source: "flash" | "promo" | "normal";
  stockByLocation: Record<string, number>; // slug lokasi -> tersedia
};

export type CatalogItem = {
  id: number;
  name: string;
  slug: string;
  brandSlug: string;
  brandName: string;
  brandColor: string;
  categorySlug: string;
  parentSlug: string;
  packaging: Packaging;
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  isNew: boolean;
  isBestseller: boolean;
  publishedAt: string; // ISO
  skinTypes: string[];
  concerns: string[];
  finish: string | null;
  spf: number | null;
  relevance: number; // skor pencarian, 0 bila tanpa kata kunci
  variants: CatalogVariant[];
};

export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : [v ?? ""])
    .flatMap((s) => s.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
const int = (v: string | string[] | undefined) => {
  const n = Number.parseInt(first(v), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function parseCatalogParams(params: RawParams): CatalogFilters {
  const sort = first(params.urut) as SortKey;
  const page = int(params.hal) ?? 1;
  return {
    q: first(params.q).trim().slice(0, 80),
    brands: list(params.merek),
    priceMin: int(params.harga_min),
    priceMax: int(params.harga_maks),
    ratingMin: ((): number | null => {
      const r = Number.parseFloat(first(params.rating));
      return Number.isFinite(r) && r > 0 && r <= 5 ? r : null;
    })(),
    skinTypes: list(params.kulit).filter((s) => s in skinTypeLabels),
    concerns: list(params.masalah).filter((s) => s in concernLabels),
    finishes: list(params.finish).filter((s) => s in finishLabels),
    undertones: list(params.undertone).filter((s) => s in undertoneLabels),
    spf: first(params.spf) === "1",
    location: first(params.cabang).trim().toLowerCase() || null,
    promo: first(params.promo) === "1",
    sort: SORT_KEYS.includes(sort) ? sort : "relevan",
    page: Math.max(1, page),
  };
}

export const emptyFilters = (): CatalogFilters => parseCatalogParams({});

// Query string tanpa tanda tanya; hanya parameter yang aktif yang ditulis supaya URL bersih.
export function serializeCatalogParams(f: CatalogFilters, opts: { omitPage?: boolean } = {}): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.brands.length) p.set("merek", f.brands.join(","));
  if (f.priceMin != null) p.set("harga_min", String(f.priceMin));
  if (f.priceMax != null) p.set("harga_maks", String(f.priceMax));
  if (f.ratingMin != null) p.set("rating", String(f.ratingMin));
  if (f.skinTypes.length) p.set("kulit", f.skinTypes.join(","));
  if (f.concerns.length) p.set("masalah", f.concerns.join(","));
  if (f.finishes.length) p.set("finish", f.finishes.join(","));
  if (f.undertones.length) p.set("undertone", f.undertones.join(","));
  if (f.spf) p.set("spf", "1");
  if (f.location) p.set("cabang", f.location);
  if (f.promo) p.set("promo", "1");
  if (f.sort !== "relevan") p.set("urut", f.sort);
  if (!opts.omitPage && f.page > 1) p.set("hal", String(f.page));
  return p.toString();
}

export type FacetKey = "brands" | "price" | "rating" | "skinTypes" | "concerns" | "finishes" | "undertones" | "spf" | "location" | "promo";

export function countActiveFilters(f: CatalogFilters) {
  return (
    f.brands.length +
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    (f.ratingMin != null ? 1 : 0) +
    f.skinTypes.length +
    f.concerns.length +
    f.finishes.length +
    f.undertones.length +
    (f.spf ? 1 : 0) +
    (f.location ? 1 : 0) +
    (f.promo ? 1 : 0)
  );
}

export function clearFilters(f: CatalogFilters): CatalogFilters {
  return { ...emptyFilters(), q: f.q, sort: f.sort };
}

// Varian cocok dengan filter tingkat varian (harga, undertone, cabang, promo).
export function variantMatches(v: CatalogVariant, f: CatalogFilters, skip?: FacetKey) {
  if (skip !== "price") {
    if (f.priceMin != null && v.price < f.priceMin) return false;
    if (f.priceMax != null && v.price > f.priceMax) return false;
  }
  if (skip !== "undertones" && f.undertones.length && (!v.undertone || !f.undertones.includes(v.undertone))) return false;
  if (skip !== "location" && f.location && (v.stockByLocation[f.location] ?? 0) <= 0) return false;
  if (skip !== "promo" && f.promo && v.price >= v.normalPrice) return false;
  return true;
}

// Produk cocok bila atribut produk cocok dan minimal satu varian cocok. skip = dimensi yang diabaikan (untuk facet).
export function productMatches(item: CatalogItem, f: CatalogFilters, skip?: FacetKey) {
  if (skip !== "brands" && f.brands.length && !f.brands.includes(item.brandSlug)) return false;
  if (skip !== "rating" && f.ratingMin != null && (item.reviewCount === 0 || item.ratingAvg < f.ratingMin)) return false;
  if (skip !== "skinTypes" && f.skinTypes.length && !f.skinTypes.some((s) => item.skinTypes.includes(s))) return false;
  if (skip !== "concerns" && f.concerns.length && !f.concerns.some((c) => item.concerns.includes(c))) return false;
  if (skip !== "finishes" && f.finishes.length && (!item.finish || !f.finishes.includes(item.finish))) return false;
  if (skip !== "spf" && f.spf && !(item.spf && item.spf > 0)) return false;
  return item.variants.some((v) => variantMatches(v, f, skip));
}

export function applyFilters(items: CatalogItem[], f: CatalogFilters) {
  return items.filter((item) => productMatches(item, f));
}

// Harga termurah di antara varian yang cocok (untuk urutan dan "Mulai Rp").
export function matchingMinPrice(item: CatalogItem, f: CatalogFilters) {
  const prices = item.variants.filter((v) => variantMatches(v, f)).map((v) => v.price);
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
}

export function sortItems(items: CatalogItem[], f: CatalogFilters): CatalogItem[] {
  const byName = (a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name, "id");
  const sorted = [...items];
  switch (f.sort) {
    case "terlaris":
      return sorted.sort((a, b) => b.soldCount - a.soldCount || byName(a, b));
    case "terbaru":
      return sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || byName(a, b));
    case "rating":
      return sorted.sort((a, b) => b.ratingAvg - a.ratingAvg || b.reviewCount - a.reviewCount || byName(a, b));
    case "termurah":
      return sorted.sort((a, b) => matchingMinPrice(a, f) - matchingMinPrice(b, f) || byName(a, b));
    case "termahal":
      return sorted.sort((a, b) => matchingMinPrice(b, f) - matchingMinPrice(a, f) || byName(a, b));
    default:
      // Relevan: skor pencarian bila ada kata kunci, kalau tidak terlaris lalu penjualan.
      if (f.q) return sorted.sort((a, b) => b.relevance - a.relevance || b.soldCount - a.soldCount || byName(a, b));
      return sorted.sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller) || b.soldCount - a.soldCount || byName(a, b));
  }
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), total: items.length, hasMore: start + size < items.length };
}

export type ActiveChip = { key: FacetKey; label: string; next: CatalogFilters };

// Chip filter aktif, masing-masing membawa filter baru bila chip itu dihapus.
export function activeFilterChips(f: CatalogFilters, labels: { brands?: Record<string, string>; locations?: Record<string, string> } = {}): ActiveChip[] {
  const chips: ActiveChip[] = [];
  for (const b of f.brands) chips.push({ key: "brands", label: labels.brands?.[b] ?? b, next: { ...f, brands: f.brands.filter((x) => x !== b), page: 1 } });
  if (f.priceMin != null || f.priceMax != null) {
    const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
    const label =
      f.priceMin != null && f.priceMax != null
        ? `${fmt(f.priceMin)} sampai ${fmt(f.priceMax)}`
        : f.priceMin != null
          ? `Di atas ${fmt(f.priceMin)}`
          : `Di bawah ${fmt(f.priceMax as number)}`;
    chips.push({ key: "price", label, next: { ...f, priceMin: null, priceMax: null, page: 1 } });
  }
  if (f.ratingMin != null) chips.push({ key: "rating", label: `Rating ${String(f.ratingMin).replace(".", ",")} ke atas`, next: { ...f, ratingMin: null, page: 1 } });
  for (const s of f.skinTypes) chips.push({ key: "skinTypes", label: `Kulit ${skinTypeLabels[s] ?? s}`, next: { ...f, skinTypes: f.skinTypes.filter((x) => x !== s), page: 1 } });
  for (const c of f.concerns) chips.push({ key: "concerns", label: concernLabels[c] ?? c, next: { ...f, concerns: f.concerns.filter((x) => x !== c), page: 1 } });
  for (const x of f.finishes) chips.push({ key: "finishes", label: finishLabels[x] ?? x, next: { ...f, finishes: f.finishes.filter((y) => y !== x), page: 1 } });
  for (const u of f.undertones) chips.push({ key: "undertones", label: `Undertone ${undertoneLabels[u] ?? u}`, next: { ...f, undertones: f.undertones.filter((y) => y !== u), page: 1 } });
  if (f.spf) chips.push({ key: "spf", label: "Ada SPF", next: { ...f, spf: false, page: 1 } });
  if (f.location) chips.push({ key: "location", label: `Tersedia di ${labels.locations?.[f.location] ?? f.location}`, next: { ...f, location: null, page: 1 } });
  if (f.promo) chips.push({ key: "promo", label: "Sedang promo", next: { ...f, promo: false, page: 1 } });
  return chips;
}
