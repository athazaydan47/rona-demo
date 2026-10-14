// Pencocokan nama deterministik untuk Asisten Admin: merek, produk, varian, cabang, dan pelanggan dicocokkan di kode,
// bukan ditebak model. Urutan: persis (setelah normalisasi), lalu semua kata cocok, lalu kemiripan trigram.
// Satu cocok dipakai; banyak cocok tanpa yang persis menjadi "ambigu" beserta kandidat (model wajib bertanya balik);
// tidak ada yang cocok menjadi "tidak_ditemukan". Model tidak pernah memberi id.
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { MEREK } from "@/config/merek";
import { normalizeName, trigramSimilarity } from "@/lib/teks/mirip";

export { normalizeName, trigramSimilarity };

export type Candidate<T = unknown> = { id: number; name: string; aliases?: string[]; data?: T };
export type MatchResult<T = unknown> = { status: "cocok"; item: Candidate<T> } | { status: "ambigu"; kandidat: Candidate<T>[] } | { status: "tidak_ditemukan" };

const FILLER = new Set(["shade", "warna", "varian", "yang", "ukuran", "produk", "merek", "brand", "cabang", "toko", MEREK.kunci, "di", "the"]);


const tokens = (s: string) => normalizeName(s).split(" ").filter((t) => t && !FILLER.has(t));


// Kemiripan trigram ala pg_trgm: irisan dibagi gabungan.

export const MAX_CANDIDATES = 5;

export function matchName<T>(query: string, candidates: Candidate<T>[]): MatchResult<T> {
  const q = normalizeName(query);
  if (!q) return { status: "tidak_ditemukan" };
  const names = (c: Candidate<T>) => [c.name, ...(c.aliases ?? [])];
  const exact = candidates.filter((c) => names(c).some((n) => normalizeName(n) === q));
  if (exact.length === 1) return { status: "cocok", item: exact[0] };
  if (exact.length > 1) return { status: "ambigu", kandidat: exact.slice(0, MAX_CANDIDATES) };
  // Semua kata pertanyaan ada di nama kandidat (kata boleh awalan, misal "02" cocok dengan "02N").
  const qt = tokens(query);
  if (qt.length) {
    const words = (c: Candidate<T>) => names(c).map((n) => normalizeName(n).split(" "));
    const contains = candidates.filter((c) => words(c).some((ws) => qt.every((t) => ws.some((w) => w === t || (t.length >= 2 && w.startsWith(t))))));
    if (contains.length === 1) return { status: "cocok", item: contains[0] };
    if (contains.length > 1) return { status: "ambigu", kandidat: rank(query, contains).slice(0, MAX_CANDIDATES) };
  }
  const scored = rank(query, candidates).map((c) => ({ c, s: Math.max(...names(c).map((n) => trigramSimilarity(query, n))) })).filter((x) => x.s >= 0.3);
  if (!scored.length) return { status: "tidak_ditemukan" };
  if (scored.length === 1 || (scored[0].s >= 0.5 && scored[1].s <= scored[0].s - 0.15)) return { status: "cocok", item: scored[0].c };
  return { status: "ambigu", kandidat: scored.slice(0, MAX_CANDIDATES).map((x) => x.c) };
}

function rank<T>(query: string, list: Candidate<T>[]) {
  const score = (c: Candidate<T>) => Math.max(...[c.name, ...(c.aliases ?? [])].map((n) => trigramSimilarity(query, n)));
  return [...list].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name) || a.id - b.id);
}

// ---------- Pemuat kandidat dari database ----------

export async function brandCandidates(db: AnyDb): Promise<Candidate<{ slug: string }>[]> {
  const rows = await db.select({ id: schema.brands.id, name: schema.brands.name, slug: schema.brands.slug }).from(schema.brands).orderBy(asc(schema.brands.name));
  return rows.map((r) => ({ id: r.id, name: r.name, aliases: [r.slug.replace(/-/g, " ")], data: { slug: r.slug } }));
}

export async function categoryCandidates(db: AnyDb): Promise<Candidate<{ slug: string }>[]> {
  const rows = await db.select({ id: schema.categories.id, name: schema.categories.name, slug: schema.categories.slug }).from(schema.categories).orderBy(asc(schema.categories.sortOrder));
  return rows.map((r) => ({ id: r.id, name: r.name, aliases: [r.slug.replace(/-/g, " ")], data: { slug: r.slug } }));
}

export async function locationCandidates(db: AnyDb): Promise<Candidate<{ slug: string; type: string }>[]> {
  const rows = await db.select({ id: schema.locations.id, name: schema.locations.name, slug: schema.locations.slug, type: schema.locations.type }).from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(asc(schema.locations.sortOrder));
  return rows.map((r) => ({ id: r.id, name: r.name, aliases: [r.slug.replace(/-/g, " "), r.name.replace(new RegExp(`^${MEREK.nama} `), "")], data: { slug: r.slug, type: r.type } }));
}

export async function productCandidates(db: AnyDb): Promise<Candidate<{ slug: string; brand: string }>[]> {
  const rows = await db.select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug, brand: schema.brands.name }).from(schema.products).innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id)).where(eq(schema.products.status, "aktif")).orderBy(asc(schema.products.name));
  return rows.map((r) => ({ id: r.id, name: r.name, data: { slug: r.slug, brand: r.brand } }));
}

export async function variantCandidates(db: AnyDb): Promise<Candidate<{ productId: number; productName: string; shadeName: string; sku: string }>[]> {
  const rows = await db
    .select({ id: schema.variants.id, productId: schema.products.id, productName: schema.products.name, shadeName: schema.variants.shadeName, sku: schema.variants.sku })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(and(eq(schema.variants.isActive, true), eq(schema.products.status, "aktif")))
    .orderBy(asc(schema.products.name), asc(schema.variants.sortOrder));
  return rows.map((r) => ({ id: r.id, name: `${r.productName} ${r.shadeName}`, aliases: [r.sku], data: { productId: r.productId, productName: r.productName, shadeName: r.shadeName, sku: r.sku } }));
}

// Pelanggan dicari di database (trigram pg_trgm untuk nama, awalan untuk nomor), maksimal 20 kandidat lalu dicocokkan.
export async function customerCandidates(db: AnyDb, query: string): Promise<Candidate<{ phone: string }>[]> {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, "");
  const rows = await db
    .select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone })
    .from(schema.customers)
    .where(or(ilike(schema.customers.name, `%${q.replace(/[%_]/g, "")}%`), sql`similarity(${schema.customers.name}, ${q}) > 0.3`, digits.length >= 6 ? ilike(schema.customers.phone, `%${digits.slice(-8)}%`) : undefined))
    .orderBy(sql`similarity(${schema.customers.name}, ${q}) desc`)
    .limit(20);
  return rows.map((r) => ({ id: r.id, name: r.name ?? "", aliases: [r.phone], data: { phone: r.phone } }));
}
