import { cacheLife, cacheTag } from "next/cache";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { cacheTags } from "@/lib/cache-tags";
import { countActiveProductsByBrand, topProductByBrand, type BrandTopProduct } from "./brand-counts";

export type CategoryChild = { id: number; name: string; slug: string };
export type CategoryNode = {
  id: number;
  name: string;
  slug: string;
  description: string;
  children: CategoryChild[];
};

// Pohon kategori 2 tingkat untuk MegaMenu, footer, dan menu HP.
export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.categories());
  const rows = await db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
      parentId: schema.categories.parentId,
      description: schema.categories.description,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));
  const parents = rows.filter((r) => r.parentId === null);
  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    children: rows
      .filter((r) => r.parentId === p.id)
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  }));
}

export type StoreLocation = {
  id: number;
  name: string;
  slug: string;
  type: "gudang" | "toko";
  address: string;
  district: string;
  city: string;
  hoursLabel: string;
  canPickup: boolean;
};

export async function getLocations(): Promise<StoreLocation[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.locations());
  return db
    .select({
      id: schema.locations.id,
      name: schema.locations.name,
      slug: schema.locations.slug,
      type: schema.locations.type,
      address: schema.locations.address,
      district: schema.locations.district,
      city: schema.locations.city,
      hoursLabel: schema.locations.hoursLabel,
      canPickup: schema.locations.canPickup,
    })
    .from(schema.locations)
    .where(eq(schema.locations.isActive, true))
    .orderBy(asc(schema.locations.sortOrder));
}

export async function getPromoMessages(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.settings());
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, "promo.bar"));
  const value = row?.value;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}


export type BrandSummary = {
  id: number;
  name: string;
  slug: string;
  color: string;
  tagline: string;
  description: string;
  priceMin: number;
  priceMax: number;
  productCount: number;
  topProduct: BrandTopProduct | null;
};

// Daftar merek beserta jumlah produk aktif dan produk terlarisnya. Deskriptif, jarang berubah.
export async function getBrands(): Promise<BrandSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.brands());
  cacheTag(cacheTags.products());
  const [rows, counts, tops] = await Promise.all([
    db
      .select({
        id: schema.brands.id,
        name: schema.brands.name,
        slug: schema.brands.slug,
        color: schema.brands.color,
        tagline: schema.brands.tagline,
        description: schema.brands.description,
        priceMin: schema.brands.priceMin,
        priceMax: schema.brands.priceMax,
      })
      .from(schema.brands)
      .orderBy(asc(schema.brands.name)),
    countActiveProductsByBrand(db),
    topProductByBrand(db),
  ]);
  return rows.map((r) => ({ ...r, productCount: counts.get(r.id) ?? 0, topProduct: tops.get(r.id) ?? null }));
}

export async function getBrand(slug: string): Promise<BrandSummary | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.brands());
  cacheTag(cacheTags.brand(slug));
  const all = await getBrands();
  return all.find((b) => b.slug === slug) ?? null;
}

export type CategoryInfo = {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: { name: string; slug: string } | null;
};

export async function getCategoryInfo(slug: string): Promise<CategoryInfo | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.categories());
  cacheTag(cacheTags.category(slug));
  const tree = await getCategoryTree();
  for (const p of tree) {
    if (p.slug === slug) return { id: p.id, name: p.name, slug: p.slug, description: p.description, parent: null };
    const c = p.children.find((x) => x.slug === slug);
    if (c) return { id: c.id, name: c.name, slug: c.slug, description: "", parent: { name: p.name, slug: p.slug } };
  }
  return null;
}

export type ArticleSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  publishedAt: Date | null;
  linkedProductIds: number[];
};

export async function getArticles(limit = 10): Promise<ArticleSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles());
  return db
    .select({
      id: schema.articles.id,
      title: schema.articles.title,
      slug: schema.articles.slug,
      excerpt: schema.articles.excerpt,
      author: schema.articles.author,
      publishedAt: schema.articles.publishedAt,
      linkedProductIds: schema.articles.linkedProductIds,
    })
    .from(schema.articles)
    .orderBy(desc(schema.articles.publishedAt))
    .limit(limit);
}

export async function getArticle(slug: string): Promise<(ArticleSummary & { body: string }) | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles());
  cacheTag(cacheTags.article(slug));
  const [row] = await db
    .select({
      id: schema.articles.id,
      title: schema.articles.title,
      slug: schema.articles.slug,
      excerpt: schema.articles.excerpt,
      author: schema.articles.author,
      publishedAt: schema.articles.publishedAt,
      linkedProductIds: schema.articles.linkedProductIds,
      body: schema.articles.body,
    })
    .from(schema.articles)
    .where(eq(schema.articles.slug, slug))
    .limit(1);
  return row ?? null;
}
