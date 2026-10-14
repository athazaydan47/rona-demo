// Reset data demo: ditolak saat DEMO_MODE mati, idempoten (dua kali reset menghasilkan data yang sama), dan
// aman dari dua reset bersamaan. Memakai database terpisah rona_demo_uji supaya data kerja lokal tidak terhapus.
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { dbUrl } from "@/test/integration";
import { checkDataConsistency } from "./consistency";
import { DemoResetError, resetDemoData } from "./reset";

const ON = { DEMO_MODE: "true" };
const noPhotos = async () => ({ kind: "uji", deleted: 0 });

describe("reset data demo tanpa DEMO_MODE", () => {
  it("ditolak sebelum menyentuh database", async () => {
    const untouchable = new Proxy({}, { get: () => () => Promise.reject(new Error("database tidak boleh disentuh")) }) as unknown as AnyDb;
    for (const env of [{}, { DEMO_MODE: "false" }, { DEMO_MODE: "TRUE" }, { DEMO_DAILY_RESET: "true" }]) {
      await expect(resetDemoData(untouchable, { env, source: "uji", deletePhotos: noPhotos })).rejects.toMatchObject({ name: "DemoResetError", code: "nonaktif" });
    }
  });
});

describe.skipIf(!dbUrl)("reset data demo (integrasi, database rona_demo_uji)", () => {
  const testUrl = (() => {
    const u = new URL(dbUrl ?? "postgres://localhost/x");
    u.pathname = "/rona_demo_uji";
    return u.toString();
  })();
  let client: ReturnType<typeof postgres>;
  let db: AnyDb;

  beforeAll(async () => {
    const admin = postgres(dbUrl!, { max: 1, onnotice: () => {} });
    const [exists] = await admin`select 1 as ok from pg_database where datname = 'rona_demo_uji'`;
    if (!exists) await admin.unsafe("create database rona_demo_uji");
    await admin.end();
    client = postgres(testUrl, { max: 4, onnotice: () => {} });
    const d = drizzle(client, { schema, casing: "snake_case" });
    await d.execute(sql`create extension if not exists pg_trgm`);
    await migrate(d, { migrationsFolder: "./drizzle" });
    db = d as unknown as AnyDb;
  }, 60_000);
  afterAll(async () => {
    await client?.end();
  });

  async function fingerprint() {
    const rows = (await db.execute(sql`
      select
        (select md5(string_agg(concat_ws('|', id, slug, sold_count, rating_avg, review_count), ',' order by id)) from products) as produk,
        (select md5(string_agg(concat_ws('|', variant_id, location_id, on_hand, reserved), ',' order by id)) from inventory) as stok,
        (select md5(string_agg(concat_ws('|', number, status, total, points_used), ',' order by id)) from orders) as pesanan,
        (select md5(string_agg(concat_ws('|', email, is_active), ',' order by id)) from staff) as staf,
        (select md5(string_agg(concat_ws('|', customer_id, amount, idempotency_key), ',' order by id)) from points_ledger) as poin,
        (select count(*) from customers)::int as pembeli,
        (select count(*) from staff_locations)::int as lokasi_staf
    `)) as unknown as Record<string, string | number>[];
    return rows[0];
  }

  it("idempoten: dua kali reset menghasilkan data yang sama, termasuk setelah data diubah pengunjung", async () => {
    const now = new Date();
    const first = await resetDemoData(db, { env: ON, now, source: "uji", deletePhotos: noPhotos });
    expect(first.summary).toMatchObject({ products: 79, variants: 228, demoOrders: 5 });
    const a = await fingerprint();
    // Pengunjung mengubah data: stok, pelanggan baru.
    await db.execute(sql`update inventory set on_hand = on_hand + 7 where id = 1`);
    await db.insert(schema.customers).values({ name: "Pengunjung", phone: "089900000001" });
    await resetDemoData(db, { env: ON, now, source: "uji", deletePhotos: noPhotos });
    const b = await fingerprint();
    expect(b).toEqual(a);
    expect(a.lokasi_staf).toBe(1);
    const [log] = (await db.execute(sql`select action, object_id from audit_logs where action = 'demo.reset' order by id desc limit 1`)) as unknown as { action: string; object_id: string }[];
    expect(log).toEqual({ action: "demo.reset", object_id: "uji" });
  }, 120_000);

  it("riwayat 90 hari konsisten setelah reset: buku stok, dipesan, poin, terjual, kuota flash, dan voucher", async () => {
    const r = await resetDemoData(db, { env: ON, source: "uji", deletePhotos: noPhotos });
    expect(r.summary.historyOrders).toBeGreaterThan(90 * 8 * 0.9);
    expect(r.summary.historyCustomers).toBe(150);
    expect(await checkDataConsistency(db)).toEqual({ ok: true, issues: [] });
    const [mix] = (await db.execute(sql`
      select count(*) filter (where status = 'selesai')::int as selesai, count(*) filter (where status = 'dibatalkan')::int as batal,
             count(*) filter (where status = 'diretur')::int as retur, count(*) filter (where status in ('dibayar', 'diproses', 'dikirim', 'siap_diambil', 'menunggu_pembayaran'))::int as aktif,
             count(distinct location_id) filter (where method = 'ambil')::int as cabang_ambil,
             (select count(distinct method)::int from payments) as metode
      from orders`)) as unknown as Record<string, number>[];
    expect(mix.selesai).toBeGreaterThan(mix.batal + mix.retur + mix.aktif);
    expect(mix.batal).toBeGreaterThan(0);
    expect(mix.retur).toBeGreaterThan(0);
    expect(mix.aktif).toBeGreaterThan(0);
    expect(mix.cabang_ambil).toBe(3);
    expect(mix.metode).toBe(6);
  }, 120_000);

  it("cache AI, ringkasan ulasan, dan log AI tidak ikut dikosongkan reset", async () => {
    await db.execute(sql`insert into ai_cache (key, feature, value, expires_at) values ('uji:reset', 'uji', '{"a":1}'::jsonb, now() + interval '1 day') on conflict (key) do nothing`);
    await db.execute(sql`insert into ai_logs (feature, model, visitor_hash) values ('uji', 'uji', 'uji-reset')`);
    await resetDemoData(db, { env: ON, source: "uji", deletePhotos: noPhotos });
    const [row] = (await db.execute(sql`select (select count(*) from ai_cache where key = 'uji:reset')::int as cache, (select count(*) from ai_logs where visitor_hash = 'uji-reset')::int as logs`)) as unknown as { cache: number; logs: number }[];
    expect(row).toEqual({ cache: 1, logs: 1 });
    await db.execute(sql`delete from ai_cache where key = 'uji:reset'`);
    await db.execute(sql`delete from ai_logs where visitor_hash = 'uji-reset'`);
  }, 120_000);

  it("pelanggan riwayat: sebaran pesanan realistis, alamat tersimpan, sebagian punya profil kulit", async () => {
    const [d] = (await db.execute(sql`
      select max(n)::int as maks, count(*) filter (where n between 1 and 3)::int as kecil, count(*) filter (where n > 3)::int as setia,
        (select round(100.0 * count(*) filter (where customer_id is null) / count(*))::int from orders) as tamu,
        (select count(*)::int from addresses a join customers c on c.id = a.customer_id where c.phone like '08001%') as alamat,
        (select count(*)::int from customers where phone like '08001%' and skin_profile is not null) as profil
      from (select c.id, count(o.id) as n from customers c left join orders o on o.customer_id = c.id where c.phone like '08001%' group by c.id) x`)) as unknown as Record<string, number>[];
    expect(d.maks).toBeLessThanOrEqual(15);
    expect(d.kecil).toBeGreaterThan(d.setia);
    expect(d.tamu).toBeGreaterThanOrEqual(50);
    expect(d.alamat).toBeGreaterThan(100);
    expect(d.profil).toBeGreaterThan(40);
    // Alamat tersimpan sama dengan alamat kirim pesanan pelanggan itu.
    const [mismatch] = (await db.execute(sql`select count(*)::int as n from orders o join addresses a on a.customer_id = o.customer_id join customers c on c.id = o.customer_id where c.phone like '08001%' and o.method = 'kirim' and o.shipping_address->>'street' <> a.street`)) as unknown as { n: number }[];
    expect(mismatch.n).toBe(0);
  }, 60_000);

  it("dua reset bersamaan: satu jalan, yang lain ditolak (bukan data dobel)", async () => {
    const results = await Promise.allSettled([1, 2].map(() => resetDemoData(db, { env: ON, source: "uji", deletePhotos: noPhotos })));
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const f of failed) expect(f.reason).toBeInstanceOf(DemoResetError);
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from products`)) as unknown as { n: number }[];
    expect(n).toBe(79);
  }, 120_000);

  it("DEMO_MODE mati: data tidak berubah", async () => {
    const before = await fingerprint();
    await db.execute(sql`update inventory set on_hand = on_hand + 1 where id = 2`);
    const changed = await fingerprint();
    await expect(resetDemoData(db, { env: { DEMO_MODE: "false", DEMO_DAILY_RESET: "true" }, source: "uji", deletePhotos: noPhotos })).rejects.toBeInstanceOf(DemoResetError);
    expect(await fingerprint()).toEqual(changed);
    expect(changed.stok).not.toBe(before.stok);
  }, 60_000);
});
