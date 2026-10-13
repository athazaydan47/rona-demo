// Tag cache terpusat. Semua pemanggilan cacheTag dan revalidateTag memakai helper ini.
import { revalidateTag } from "next/cache";

export const cacheTags = {
  categories: () => "categories",
  category: (slug: string) => `category:${slug}`,
  brands: () => "brands",
  brand: (slug: string) => `brand:${slug}`,
  products: () => "products",
  product: (slug: string) => `product:${slug}`,
  locations: () => "locations",
  settings: () => "settings",
  articles: () => "articles",
  article: (slug: string) => `article:${slug}`,
  banners: () => "banners",
} as const;

// Dipakai modul yang mengubah data: panggil sekali dengan daftar tag yang terdampak.
export function revalidateCatalog(tags: string[]) {
  for (const tag of new Set(tags)) revalidateTag(tag, "max");
}

// Tag yang terdampak bila sebuah produk berubah (nama, deskripsi, atribut, varian).
export function productTags(product: { slug: string; brandSlug?: string | null; categorySlugs?: string[] }) {
  const tags = [cacheTags.products(), cacheTags.product(product.slug)];
  if (product.brandSlug) tags.push(cacheTags.brand(product.brandSlug));
  for (const c of product.categorySlugs ?? []) tags.push(cacheTags.category(c));
  return tags;
}
