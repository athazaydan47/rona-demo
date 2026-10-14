// Filter katalog: parsing URL, predikat murni, dan pengurutan. Tidak menyentuh database.
import type { Packaging } from "@/db/schema/enums";
import { formatRupiah } from "@/lib/format";
import { SHADE_GROUPS } from "@/lib/skin/shade";

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

// Atribut produk dari teks manfaat, deskripsi, dan komposisi (dipakai tafsiran pencarian bahasa sehari-hari).
export const ATTRIBUTES: Record<string, { label: string; test: (text: string) => boolean }> = {
  melembapkan: { label: "Melembapkan", test: (t) => /melembap|lembap|hidrasi|hydrat|moistur/.test(t) },
  tahan_lama: { label: "Tahan lama", test: (t) => /tahan lama|long ?lasting|tidak mudah luntur|transfer ?proof|tahan seharian/.test(t) },
  ringan: { label: "Ringan", test: (t) => /ringan|lightweight|tidak lengket|tidak berat/.test(t) },
  tanpa_parfum: { label: "Tanpa parfum", test: (t) => !/\b(parfum|fragrance|pewangi)\b/.test(t.split("bahan aktif utama")[0]) },
  tahan_air: { label: "Tahan air", test: (t) => /waterproof|tahan air|water ?resistant|tahan keringat/.test(t) },
  mencerahkan: { label: "Mencerahkan", test: (t) => /cerah|brighten|kusam|glow/.test(t) },
  menenangkan: { label: "Menenangkan", test: (t) => /menenangkan|calming|centella|kemerahan|soothing/.test(t) },
};

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
  category: string | null; // slug kategori atau induk (dari tafsiran pencarian)
  attributes: string[]; // kunci ATTRIBUTES
  interpreted: boolean; // hasil tafsiran AI (tafsir=1): jangan ditafsirkan ulang
  keyword: string; // kata kunci sisa tafsiran (kata) untuk pencarian teks
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
  attrText: string; // manfaat, deskripsi, bahan aktif, dan komposisi (huruf kecil) untuk filter atribut
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
    category: /^[a-z0-9-]{1,60}$/.test(first(params.kategori)) ? first(params.kategori) : null,
    attributes: list(params.atribut).filter((a) => a in ATTRIBUTES),
    interpreted: first(params.tafsir) === "1",
    keyword: first(params.kata).trim().slice(0, 60),
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
  if (f.category) p.set("kategori", f.category);
  if (f.attributes.length) p.set("atribut", f.attributes.join(","));
  if (f.interpreted) p.set("tafsir", "1");
  if (f.keyword) p.set("kata", f.keyword);
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
    (f.promo ? 1 : 0) +
    (f.category ? 1 : 0) +
    f.attributes.length
  );
}

export function clearFilters(f: CatalogFilters): CatalogFilters {
  return { ...emptyFilters(), q: f.q, sort: f.sort, interpreted: f.interpreted, keyword: f.keyword };
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
  if (f.category && item.categorySlug !== f.category && item.parentSlug !== f.category) return false;
  if (f.attributes.length && !f.attributes.every((a) => ATTRIBUTES[a]?.test(item.attrText) ?? true)) return false;
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

export type ActiveChip = { key: FacetKey | "category" | "attributes"; label: string; next: CatalogFilters };

// Chip filter aktif, masing-masing membawa filter baru bila chip itu dihapus.
export function activeFilterChips(f: CatalogFilters, labels: { brands?: Record<string, string>; locations?: Record<string, string>; categories?: Record<string, string> } = {}): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (f.category) chips.push({ key: "category", label: labels.categories?.[f.category] ?? f.category, next: { ...f, category: null, page: 1 } });
  for (const b of f.brands) chips.push({ key: "brands", label: labels.brands?.[b] ?? b, next: { ...f, brands: f.brands.filter((x) => x !== b), page: 1 } });
  if (f.priceMin != null || f.priceMax != null) {
    const fmt = formatRupiah;
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
  for (const a of f.attributes) chips.push({ key: "attributes", label: ATTRIBUTES[a]?.label ?? a, next: { ...f, attributes: f.attributes.filter((x) => x !== a), page: 1 } });
  return chips;
}

// ---------- Tafsiran pencarian: filter wajib dan penambah peringkat (Fase 7C) ----------
// Pada hasil tafsiran AI (tafsir=1), hanya kategori, merek, dan batas harga yang menjadi filter wajib. Jenis kulit,
// masalah, finish, undertone, SPF, atribut manfaat, dan kata sisa (misal "kondangan") menjadi penambah peringkat.
// Bila produk yang cocok dengan semuanya kurang dari 3, kriteria dilonggarkan bertahap dan pembeli diberi tahu.

export const MIN_INTERPRETED_RESULTS = 3;

export function hardFilters(f: CatalogFilters): CatalogFilters {
  if (!f.interpreted) return f;
  return { ...f, skinTypes: [], concerns: [], finishes: [], undertones: [], spf: false, attributes: [] };
}

export type SoftCriterion = { key: string; label: string; test: (item: CatalogItem) => boolean };

const keywordWords = (k: string) => k.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);

// Urutan = urutan dilonggarkan (yang pertama paling dulu dilepas). Manfaat yang diminta pembeli (misal "ga bikin
// kering") dan jenis kulit paling akhir dilepas.
export function softCriteria(f: CatalogFilters): SoftCriterion[] {
  if (!f.interpreted) return [];
  const out: SoftCriterion[] = [];
  const words = f.category ? keywordWords(f.keyword) : [];
  if (words.length) out.push({ key: "kata", label: `kata "${f.keyword}"`, test: (i) => words.some((w) => i.name.toLowerCase().includes(w) || i.attrText.includes(w)) });
  for (const x of f.finishes) out.push({ key: `finish:${x}`, label: finishLabels[x] ?? x, test: (i) => i.finish === x });
  for (const u of f.undertones) out.push({ key: `undertone:${u}`, label: `undertone ${undertoneLabels[u] ?? u}`, test: (i) => i.variants.some((v) => v.undertone === u) });
  if (f.spf) out.push({ key: "spf", label: "SPF", test: (i) => Boolean(i.spf && i.spf > 0) });
  for (const a of [...f.attributes].reverse()) out.push({ key: `atribut:${a}`, label: ATTRIBUTES[a]?.label ?? a, test: (i) => ATTRIBUTES[a]?.test(i.attrText) ?? true });
  for (const c of f.concerns) out.push({ key: `masalah:${c}`, label: concernLabels[c] ?? c, test: (i) => i.concerns.includes(c) });
  for (const s of f.skinTypes) out.push({ key: `kulit:${s}`, label: `kulit ${(skinTypeLabels[s] ?? s).toLowerCase()}`, test: (i) => i.skinTypes.includes(s) });
  return out;
}

export type Loosened = { kind: "soft"; label: string } | { kind: "brands"; values: string[] } | { kind: "category"; from: string; to: string; group: boolean } | { kind: "price"; max: number };

const GROUP_LABELS: Record<string, string> = { wajah: "produk alas wajah", bibir: "produk bibir", pipi: "produk pipi" };

// Kategori lebih luas untuk pelonggaran: kategori shade ke kelompok sejenis (cushion ke alas wajah lain, lipstik ke
// produk bibir lain), kategori lain ke induknya.
function widerCategory(slug: string, items: CatalogItem[]): { label: string; group: boolean; test: (i: CatalogItem) => boolean } | null {
  const group = SHADE_GROUPS[slug];
  if (group) return { label: group, group: true, test: (i) => SHADE_GROUPS[i.categorySlug] === group };
  const parentSlug = items.find((i) => i.categorySlug === slug && i.parentSlug !== slug)?.parentSlug;
  return parentSlug ? { label: parentSlug, group: false, test: (i) => i.parentSlug === parentSlug } : null;
}

// Hasil tafsiran: filter wajib, dilonggarkan bila hasilnya kurang dari 3 (merek dulu, lalu batas harga, lalu kategori
// diperluas ke yang sejenis). Produk dari kategori asli tetap di urutan teratas. Setelah itu urutan berdasarkan
// kecocokan kriteria lunak: produk yang cocok dengan semua kriteria aktif di atas. Kriteria lunak dilepas satu per
// satu (hanya yang memang menyaring) sampai ada 3 produk yang cocok semuanya. Urutan selain "relevan" dihormati.
export function rankInterpreted(items: CatalogItem[], f: CatalogFilters): { items: CatalogItem[]; loosened: Loosened[]; hard: CatalogFilters } {
  let hard = hardFilters(f);
  const loosened: Loosened[] = [];
  let widened: ((i: CatalogItem) => boolean) | null = null;
  const matches = (i: CatalogItem) => (widened ? productMatches(i, { ...hard, category: null }) && widened(i) : productMatches(i, hard));
  let base = items.filter(matches);
  const enough = () => base.length >= MIN_INTERPRETED_RESULTS;
  if (!enough() && hard.brands.length) {
    loosened.push({ kind: "brands", values: hard.brands });
    hard = { ...hard, brands: [] };
    base = items.filter(matches);
  }
  if (!enough() && hard.priceMax != null) {
    loosened.push({ kind: "price", max: hard.priceMax });
    hard = { ...hard, priceMax: null };
    base = items.filter(matches);
  }
  const original = hard.category;
  const wider = original ? widerCategory(original, items) : null;
  if (!enough() && original && wider) {
    loosened.push({ kind: "category", from: original, to: wider.label, group: wider.group });
    widened = wider.test;
    base = items.filter(matches);
  }
  const inOriginal = (i: CatalogItem) => !original || i.categorySlug === original || i.parentSlug === original;
  const all = softCriteria(f);
  // Tanpa filter wajib sama sekali (misal chip kategori dihapus), produk minimal cocok dengan satu kriteria lunak
  // supaya hasilnya tetap relevan, bukan seluruh katalog.
  if (!hard.category && !widened && !hard.brands.length && hard.priceMax == null && hard.priceMin == null && all.length) base = base.filter((i) => all.some((c) => c.test(i)));
  let active = all;
  const target = Math.min(MIN_INTERPRETED_RESULTS, base.length);
  const fullMatches = () => base.filter((i) => active.every((c) => c.test(i))).length;
  while (active.length && fullMatches() < target) {
    // Lepas kriteria pertama (menurut urutan prioritas) yang memang menyaring produk.
    const drop = active.find((c) => base.some((i) => !c.test(i))) ?? active[0];
    loosened.push({ kind: "soft", label: drop.label });
    active = active.filter((c) => c !== drop);
  }
  const effective = widened ? { ...hard, category: null } : hard;
  if (f.sort !== "relevan") return { items: sortItems(base, effective), loosened, hard: effective };
  const score = (i: CatalogItem) => (inOriginal(i) ? 2000 : 0) + (active.length && active.every((c) => c.test(i)) ? 1000 : 0) + all.filter((c) => c.test(i)).length;
  const order = new Map(sortItems(base, { ...effective, q: "" }).map((i, n) => [i.id, n]));
  const ranked = [...base].sort((a, b) => score(b) - score(a) || order.get(a.id)! - order.get(b.id)!);
  return { items: ranked, loosened, hard: effective };
}

export function loosenedText(list: Loosened[], labels: { brands?: Record<string, string>; categories?: Record<string, string> } = {}) {
  if (!list.length) return null;
  const cat = (slug: string) => labels.categories?.[slug] ?? slug;
  const parts = list.map((l) =>
    l.kind === "soft" ? `tanpa ${l.label}` : l.kind === "brands" ? `tanpa merek ${l.values.map((b) => labels.brands?.[b] ?? b).join(", ")}` : l.kind === "category" ? `${cat(l.from)} diperluas ke ${l.group ? (GROUP_LABELS[l.to] ?? l.to) : `semua ${cat(l.to)}`}` : `tanpa batas harga ${formatRupiah(l.max)}`,
  );
  return `Kami longgarkan: ${parts.join(", ")}.`;
}
