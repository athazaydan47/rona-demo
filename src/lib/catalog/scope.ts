// Kondisi SQL untuk cakupan katalog. Tidak mengimpor koneksi database supaya bisa diuji murni.
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { PgDialect, alias } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

export type CatalogScope =
  | { kind: "all" }
  | { kind: "category"; slug: string; subSlug?: string }
  | { kind: "brand"; slug: string }
  | { kind: "search"; q: string }
  | { kind: "promo" }
  | { kind: "ids"; ids: number[] };

// Alias untuk self-join kategori induk.
export const parent = alias(schema.categories, "parent_categories");
const SIMILARITY_MIN = 0.35;

// Kondisi SQL untuk cakupan. Diekspor supaya bisa diuji tanpa database.
export function buildScopeCondition(scope: CatalogScope): SQL {
  const base = eq(schema.products.status, "aktif");
  switch (scope.kind) {
    case "category":
      if (scope.subSlug) return and(base, eq(schema.categories.slug, scope.subSlug), eq(parent.slug, scope.slug))!;
      return and(base, or(eq(schema.categories.slug, scope.slug), eq(parent.slug, scope.slug)))!;
    case "brand":
      return and(base, eq(schema.brands.slug, scope.slug))!;
    case "search": {
      const q = scope.q.trim();
      if (!q) return base;
      return and(
        base,
        or(
          sql`word_similarity(${q}, ${schema.products.searchText}) >= ${SIMILARITY_MIN}`,
          sql`to_tsvector('simple', ${schema.products.searchText}) @@ plainto_tsquery('simple', ${q})`,
          sql`${schema.products.searchText} ILIKE ${"%" + q + "%"}`,
        ),
      )!;
    }
    case "ids":
      return scope.ids.length ? and(base, inArray(schema.products.id, scope.ids))! : sql`false`;
    default:
      return base;
  }
}

// Skor relevansi: kemiripan kata (tahan salah ketik) digabung peringkat full-text.
export function relevanceExpr(q: string): SQL<number> {
  if (!q) return sql<number>`0`;
  return sql<number>`greatest(word_similarity(${q}, ${schema.products.searchText}), ts_rank(to_tsvector('simple', ${schema.products.searchText}), plainto_tsquery('simple', ${q})) * 2)`;
}

export function renderScopeSql(scope: CatalogScope) {
  return new PgDialect().sqlToQuery(buildScopeCondition(scope));
}


// Cakupan sebagai parameter URL untuk route API (muat bertahap dan hitung hasil).
export function scopeToParams(scope: CatalogScope): Record<string, string> {
  switch (scope.kind) {
    case "category":
      return scope.subSlug ? { jenis: "kategori", slug: scope.slug, sub: scope.subSlug } : { jenis: "kategori", slug: scope.slug };
    case "brand":
      return { jenis: "merek", slug: scope.slug };
    case "search":
      return { jenis: "cari", q: scope.q };
    case "promo":
      return { jenis: "promo" };
    case "ids":
      return { jenis: "ids", ids: scope.ids.join(",") };
    default:
      return { jenis: "semua" };
  }
}

export function parseScopeParams(get: (key: string) => string | null): CatalogScope {
  const jenis = get("jenis") ?? "semua";
  const slug = (get("slug") ?? "").trim().toLowerCase();
  const sub = (get("sub") ?? "").trim().toLowerCase();
  switch (jenis) {
    case "kategori":
      return slug ? { kind: "category", slug, subSlug: sub || undefined } : { kind: "all" };
    case "merek":
      return slug ? { kind: "brand", slug } : { kind: "all" };
    case "cari":
      return { kind: "search", q: (get("q") ?? "").trim().slice(0, 80) };
    case "promo":
      return { kind: "promo" };
    case "ids":
      return { kind: "ids", ids: (get("ids") ?? "").split(",").map((n) => Number.parseInt(n, 10)).filter((n) => Number.isFinite(n)) };
    default:
      return { kind: "all" };
  }
}
