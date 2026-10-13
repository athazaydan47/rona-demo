// Jumlah produk aktif per merek dan produk terlaris per merek. Dipisah dari queries.ts supaya bisa diuji
// dengan koneksi database sendiri tanpa runtime Next.
import { eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<any, any, any>;

export type BrandTopProduct = { name: string; slug: string; packaging: Packaging; hex: string };

// Catatan: jangan menulis subquery berkorelasi dengan ${schema.brands.id} di dalam sql``; pada select satu tabel
// Drizzle merendernya sebagai "id" tanpa nama tabel, sehingga di dalam subquery tertukar dengan products.id.
export async function countActiveProductsByBrand(db: AnyDb): Promise<Map<number, number>> {
  const rows = await db
    .select({ brandId: schema.products.brandId, count: sql<number>`count(*)` })
    .from(schema.products)
    .where(eq(schema.products.status, "aktif"))
    .groupBy(schema.products.brandId);
  return new Map(rows.map((r) => [r.brandId, Number(r.count)]));
}

// Produk aktif dengan penjualan tertinggi per merek, beserta warna varian pertamanya (untuk ProductArt kecil).
export async function topProductByBrand(db: AnyDb): Promise<Map<number, BrandTopProduct>> {
  const rows = await db
    .select({
      brandId: schema.products.brandId,
      name: schema.products.name,
      slug: schema.products.slug,
      packaging: schema.products.packaging,
      soldCount: schema.products.soldCount,
      hex: sql<string | null>`(select v.hex from variants v where v.product_id = ${schema.products.id} and v.is_active order by v.sort_order limit 1)`,
    })
    .from(schema.products)
    .where(eq(schema.products.status, "aktif"));
  const best = new Map<number, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = best.get(r.brandId);
    if (!cur || r.soldCount > cur.soldCount || (r.soldCount === cur.soldCount && r.name < cur.name)) best.set(r.brandId, r);
  }
  return new Map([...best.entries()].map(([id, r]) => [id, { name: r.name, slug: r.slug, packaging: r.packaging, hex: r.hex ?? "#D9A98B" }]));
}
