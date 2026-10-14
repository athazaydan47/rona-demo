// Data pendukung formulir produk (merek, kategori) dan konversi produk ke nilai formulir.
import { asc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { getProductForEdit } from "@/lib/admin/products";
import { leafCategories } from "@/lib/admin/taxonomy";
import type { ProductFormValue } from "@/components/admin/product-form";

export async function productFormData() {
  const [brands, categories] = await Promise.all([db.select({ id: schema.brands.id, name: schema.brands.name, color: schema.brands.color }).from(schema.brands).orderBy(asc(schema.brands.name)), leafCategories(db)]);
  return { brands, categories };
}

export function toFormValue(found: NonNullable<Awaited<ReturnType<typeof getProductForEdit>>>): ProductFormValue {
  const p = found.product;
  return {
    name: p.name,
    slug: p.slug,
    brandId: p.brandId,
    categoryId: p.categoryId,
    packaging: p.packaging,
    shortDescription: p.shortDescription,
    benefits: p.benefits,
    ingredients: p.ingredients,
    howToUse: p.howToUse,
    activeIngredients: p.activeIngredients.join(", "),
    skinTypes: p.skinTypes,
    skinConcerns: p.skinConcerns,
    finish: p.finish ?? "",
    spf: p.spf != null ? String(p.spf) : "",
    bpom: p.bpom,
    netto: p.netto,
    imageUrl: p.imageUrl,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    status: p.status,
    variants: found.variants.map((v) => ({ id: v.id, shadeName: v.shadeName, hex: v.hex, undertone: v.undertone ?? "", depth: v.depth != null ? String(v.depth) : "", sku: v.sku, barcode: v.barcode, weightGram: String(v.weightGram), normalPrice: String(v.normalPrice), salePrice: String(v.salePrice), isActive: v.isActive })),
  };
}
