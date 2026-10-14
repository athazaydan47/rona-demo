// Fungsi katalog (Fase 7A): dipakai UI dan dipanggil AI sebagai tool. Semua angka (harga efektif, stok) dibaca
// segar dari database lewat loadCatalogItems, jadi AI tidak pernah mengarang produk, harga, shade, atau stok.
import { and, asc, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { SkinProfile } from "@/db/schema/customers";
import type { AnyDb } from "@/lib/db-types";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import { rankShades, SHADE_GROUPS } from "@/lib/skin/shade";
import { buildRoutine, STEP_DEFS, type Routine, type RoutineProduct } from "@/lib/skin/routine";
import type { CatalogItem } from "./filters";
import { loadCatalogItems } from "./load-items";

export const SKIN_TYPE_VALUES = ["normal", "kering", "berminyak", "kombinasi", "sensitif"] as const;
export const CONCERN_VALUES = ["jerawat", "kusam", "pori", "penuaan", "dehidrasi"] as const;
export const FINISH_VALUES = ["matte", "satin", "glowy"] as const;
export const UNDERTONE_VALUES = ["warm", "neutral", "cool"] as const;

export type ProductFilter = {
  teks?: string;
  kategori?: string; // slug kategori atau induk
  merek?: string; // slug merek
  jenisKulit?: string;
  masalah?: string;
  finish?: string;
  spfMin?: number;
  hargaMaks?: number; // harga efektif sekarang
  undertone?: string;
  kedalaman?: number;
  lokasi?: string; // slug lokasi yang harus punya stok
  promo?: boolean;
  batas?: number;
};

export type ProductSummary = {
  id: number;
  slug: string;
  nama: string;
  merek: string;
  kategori: string;
  kategoriSlug: string;
  harga: number; // harga efektif termurah dari varian yang cocok
  hargaNormal: number;
  sumberHarga: "flash" | "promo" | "normal";
  rating: number;
  jumlahUlasan: number;
  stokOnline: number;
  cabangDenganStok: string[];
  varianCocok: { id: number; shade: string; harga: number; stokOnline: number }[];
};

// Nama kategori dan lokasi dibaca setiap kali (murah) supaya perubahan dari admin langsung terpakai.
async function categoryNameMap(db: AnyDb) {
  const rows = await db.select({ slug: schema.categories.slug, name: schema.categories.name }).from(schema.categories);
  return new Map(rows.map((r) => [r.slug, r.name]));
}
async function locationNameMap(db: AnyDb) {
  const rows = await db.select({ slug: schema.locations.slug, name: schema.locations.name }).from(schema.locations);
  return new Map(rows.map((r) => [r.slug, r.name]));
}

// Filter murni atas item katalog. Varian yang cocok dihitung per produk (harga, undertone, kedalaman, lokasi).
export function filterCatalog(items: CatalogItem[], f: ProductFilter): { item: CatalogItem; variants: CatalogItem["variants"] }[] {
  const out: { item: CatalogItem; variants: CatalogItem["variants"] }[] = [];
  for (const item of items) {
    if (f.kategori && item.categorySlug !== f.kategori && item.parentSlug !== f.kategori) continue;
    if (f.merek && item.brandSlug !== f.merek) continue;
    if (f.jenisKulit && !item.skinTypes.includes(f.jenisKulit)) continue;
    if (f.masalah && !item.concerns.includes(f.masalah)) continue;
    if (f.finish && item.finish !== f.finish) continue;
    if (f.spfMin != null && (item.spf ?? 0) < f.spfMin) continue;
    const variants = item.variants.filter(
      (v) =>
        (f.hargaMaks == null || v.price <= f.hargaMaks) &&
        (!f.undertone || v.undertone === f.undertone) &&
        (f.kedalaman == null || (v.depth != null && Math.abs(v.depth - f.kedalaman) <= 1)) &&
        (!f.lokasi || (v.stockByLocation[f.lokasi] ?? 0) > 0) &&
        (!f.promo || v.source !== "normal"),
    );
    if (variants.length) out.push({ item, variants });
  }
  return out;
}

export async function cariProduk(db: AnyDb, f: ProductFilter, now: Date): Promise<ProductSummary[]> {
  const teks = (f.teks ?? "").trim().slice(0, 80);
  const items = await loadCatalogItems(db, teks ? { kind: "search", q: teks } : { kind: "all" }, now);
  const cats = await categoryNameMap(db);
  const locs = await locationNameMap(db);
  const matched = filterCatalog(items, f);
  matched.sort((a, b) => (teks ? b.item.relevance - a.item.relevance : 0) || b.item.soldCount - a.item.soldCount || a.item.id - b.item.id);
  return matched.slice(0, Math.min(10, Math.max(1, f.batas ?? 6))).map(({ item, variants }) => summarize(item, variants, cats, locs));
}

function summarize(item: CatalogItem, variants: CatalogItem["variants"], cats: Map<string, string>, locs: Map<string, string>): ProductSummary {
  const cheapest = [...variants].sort((a, b) => a.price - b.price || a.id - b.id)[0];
  const branches = new Set<string>();
  for (const v of variants) for (const [slug, n] of Object.entries(v.stockByLocation)) if (n > 0 && slug !== ONLINE_WAREHOUSE_SLUG) branches.add(locs.get(slug) ?? slug);
  return {
    id: item.id,
    slug: item.slug,
    nama: item.name,
    merek: item.brandName,
    kategori: cats.get(item.categorySlug) ?? item.categorySlug,
    kategoriSlug: item.categorySlug,
    harga: cheapest.price,
    hargaNormal: cheapest.normalPrice,
    sumberHarga: cheapest.source,
    rating: item.ratingAvg,
    jumlahUlasan: item.reviewCount,
    stokOnline: variants.reduce((s, v) => s + (v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0), 0),
    cabangDenganStok: [...branches].sort(),
    varianCocok: variants.slice(0, 8).map((v) => ({ id: v.id, shade: v.shadeName, harga: v.price, stokOnline: v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0 })),
  };
}

export type ProductDetailForAi = ProductSummary & {
  deskripsi: string;
  manfaat: string;
  bahanAktif: string[];
  jenisKulit: string[];
  masalahKulit: string[];
  finish: string | null;
  spf: number | null;
  netto: string;
};

export async function detailProduk(db: AnyDb, id: number, now: Date): Promise<ProductDetailForAi | null> {
  const [item] = await loadCatalogItems(db, { kind: "ids", ids: [id] }, now);
  if (!item) return null;
  const [p] = await db.select({ shortDescription: schema.products.shortDescription, benefits: schema.products.benefits, activeIngredients: schema.products.activeIngredients, netto: schema.products.netto }).from(schema.products).where(eq(schema.products.id, id));
  const base = summarize(item, item.variants, await categoryNameMap(db), await locationNameMap(db));
  return {
    ...base,
    varianCocok: item.variants.map((v) => ({ id: v.id, shade: v.shadeName, harga: v.price, stokOnline: v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0 })),
    deskripsi: p.shortDescription.slice(0, 400),
    manfaat: p.benefits.slice(0, 600),
    bahanAktif: p.activeIngredients,
    jenisKulit: item.skinTypes,
    masalahKulit: item.concerns,
    finish: item.finish,
    spf: item.spf,
    netto: p.netto,
  };
}

export type StockInfo = { varianId: number; produkId: number; produk: string; shade: string; lokasi: { slug: string; nama: string; jenis: string; tersedia: number; bisaAmbil: boolean }[] };

export async function cekStok(db: AnyDb, varianId: number, lokasiSlug?: string | null): Promise<StockInfo | null> {
  const [v] = await db
    .select({ id: schema.variants.id, shade: schema.variants.shadeName, produk: schema.products.name, produkId: schema.products.id })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(and(eq(schema.variants.id, varianId), eq(schema.variants.isActive, true), eq(schema.products.status, "aktif")));
  if (!v) return null;
  const rows = await db
    .select({ slug: schema.locations.slug, nama: schema.locations.name, jenis: schema.locations.type, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved, bisaAmbil: schema.locations.canPickup })
    .from(schema.inventory)
    .innerJoin(schema.locations, eq(schema.inventory.locationId, schema.locations.id))
    .where(and(eq(schema.inventory.variantId, varianId), eq(schema.locations.isActive, true)))
    .orderBy(asc(schema.locations.sortOrder));
  return {
    varianId,
    produkId: v.produkId,
    produk: v.produk,
    shade: v.shade,
    lokasi: rows.filter((r) => !lokasiSlug || r.slug === lokasiSlug).map((r) => ({ slug: r.slug, nama: r.nama, jenis: r.jenis, tersedia: Math.max(0, r.onHand - r.reserved), bisaAmbil: r.bisaAmbil })),
  };
}

export type ShadeMatch = { varianId: number; produkId: number; produkSlug: string; produk: string; merek: string; shade: string; hex: string; harga: number; stokOnline: number; alasan: string; skor: number; deltaE: number };

// Padanan shade: 3 shade terdekat dari produk lain dalam kategori yang sama (atau kelompok kategori bila terlalu
// sedikit), atau dari satu produk tujuan (dialog di halaman produk).
export async function padananShade(db: AnyDb, varianId: number, now: Date, opts: { targetProductId?: number } = {}): Promise<{ sumber: { varianId: number; produk: string; shade: string; hex: string } | null; hasil: ShadeMatch[] }> {
  const [src] = await db
    .select({ id: schema.variants.id, hex: schema.variants.hex, depth: schema.variants.depth, undertone: schema.variants.undertone, shade: schema.variants.shadeName, productId: schema.products.id, produk: schema.products.name, categorySlug: schema.categories.slug })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(eq(schema.variants.id, varianId));
  if (!src) return { sumber: null, hasil: [] };
  const items = await loadCatalogItems(db, { kind: "all" }, now);
  const sameCat = items.filter((i) => (opts.targetProductId ? i.id === opts.targetProductId : i.id !== src.productId && i.categorySlug === src.categorySlug));
  const group = SHADE_GROUPS[src.categorySlug];
  const pool = !opts.targetProductId && sameCat.flatMap((i) => i.variants).length < 3 && group ? items.filter((i) => i.id !== src.productId && SHADE_GROUPS[i.categorySlug] === group) : sameCat;
  const candidates = pool.flatMap((i) => i.variants.filter((v) => v.depth != null || v.undertone != null).map((v) => ({ id: v.id, hex: v.hex, depth: v.depth, undertone: v.undertone, item: i, v })));
  const ranked = rankShades({ id: src.id, hex: src.hex, depth: src.depth, undertone: src.undertone }, candidates);
  return {
    sumber: { varianId: src.id, produk: src.produk, shade: src.shade, hex: src.hex },
    hasil: ranked.map((r) => ({ varianId: r.id, produkId: r.item.id, produkSlug: r.item.slug, produk: r.item.name, merek: r.item.brandName, shade: r.v.shadeName, hex: r.hex, harga: r.v.price, stokOnline: r.v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0, alasan: r.reason, skor: r.score, deltaE: r.deltaE })),
  };
}

// Produk perawatan untuk penyusun rutinitas (varian termurah per produk, harga efektif sekarang).
export async function routineProducts(db: AnyDb, now: Date): Promise<RoutineProduct[]> {
  const cats = new Set(Object.values(STEP_DEFS).flatMap((d) => d.categories));
  const items = (await loadCatalogItems(db, { kind: "all" }, now)).filter((i) => cats.has(i.categorySlug));
  if (!items.length) return [];
  const extra = await db.select({ id: schema.products.id, activeIngredients: schema.products.activeIngredients, ingredients: schema.products.ingredients }).from(schema.products).where(inArray(schema.products.id, items.map((i) => i.id)));
  const ex = new Map(extra.map((e) => [e.id, e]));
  return items.map((i) => {
    const v = [...i.variants].sort((a, b) => a.price - b.price || a.id - b.id)[0];
    return {
      productId: i.id,
      variantId: v.id,
      slug: i.slug,
      name: i.name,
      brandName: i.brandName,
      brandColor: i.brandColor,
      packaging: i.packaging,
      hex: v.hex,
      shadeName: v.shadeName,
      categorySlug: i.categorySlug,
      price: v.price,
      normalPrice: v.normalPrice,
      priceSource: v.source,
      rating: i.ratingAvg,
      onlineStock: v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0,
      skinTypes: i.skinTypes,
      concerns: i.concerns,
      activeIngredients: ex.get(i.id)?.activeIngredients ?? [],
      ingredients: ex.get(i.id)?.ingredients ?? null,
    };
  });
}

export async function susunRutinitas(db: AnyDb, profil: SkinProfile, budget: number | undefined, now: Date): Promise<Routine> {
  return buildRoutine(profil, await routineProducts(db, now), budget);
}
