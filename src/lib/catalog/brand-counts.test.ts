import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { countActiveProductsByBrand, topProductByBrand } from "./brand-counts";

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;

// Uji integrasi terhadap database lokal yang sudah di-seed (npm run db:reset). Dilewati bila DATABASE_URL kosong.
describe.skipIf(!url)("jumlah produk per merek", () => {
  const client = postgres(url ?? "", { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });

  beforeAll(async () => {
    await db.execute(sql`select 1`);
  });
  afterAll(async () => {
    await client.end();
  });

  it("sama dengan jumlah produk aktif tiap merek di tabel products", async () => {
    const counts = await countActiveProductsByBrand(db);
    const raw = await client`select b.id, b.name, (select count(*)::int from products p where p.brand_id = b.id and p.status = 'aktif') as n from brands b`;
    expect(raw.length).toBeGreaterThan(0);
    for (const row of raw) {
      expect(counts.get(row.id) ?? 0, `merek ${row.name}`).toBe(row.n);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const [{ n }] = await client`select count(*)::int as n from products where status = 'aktif'`;
    expect(total).toBe(n);
    expect([...counts.values()].some((c) => c > 0)).toBe(true);
  });

  it("produk terlaris per merek memang milik merek itu dan punya warna varian", async () => {
    const tops = await topProductByBrand(db);
    const raw = await client`select id, brand_id, slug from products where status = 'aktif'`;
    const brandOf = new Map(raw.map((r) => [r.slug as string, r.brand_id as number]));
    for (const [brandId, top] of tops) {
      expect(brandOf.get(top.slug)).toBe(brandId);
      expect(top.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
