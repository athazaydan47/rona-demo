// Revalidasi cache katalog setelah perubahan yang memengaruhi data produk ter-cache (jumlah terjual).
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { productTags, revalidateCatalog } from "@/lib/cache-tags";

export async function revalidateProducts(productIds: number[]) {
  if (productIds.length === 0) return;
  const rows = await db.select({ slug: schema.products.slug }).from(schema.products).where(inArray(schema.products.id, productIds));
  revalidateCatalog(rows.flatMap((r) => productTags({ slug: r.slug })));
}
