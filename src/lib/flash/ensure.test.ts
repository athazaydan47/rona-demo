import { config } from "dotenv";
import { and, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { wibDate } from "@/lib/format";
import { DAYS_AHEAD, ensureFlashSaleSlots, missingFlashSlots, planFlashSlots, resetEnsureMemo } from "./ensure";

describe("planFlashSlots", () => {
  it("merencanakan 2 slot per hari untuk hari ini sampai 3 hari ke depan, dalam WIB", () => {
    const now = wibDate(2026, 10, 13, 9, 0);
    const slots = planFlashSlots(now);
    expect(slots).toHaveLength((DAYS_AHEAD + 1) * 2);
    expect(slots[0]).toEqual({ name: "Flash Sale Siang", startsAt: wibDate(2026, 10, 13, 12), endsAt: wibDate(2026, 10, 13, 14) });
    expect(slots[1].name).toBe("Flash Sale Malam");
    expect(slots.at(-1)?.endsAt).toEqual(wibDate(2026, 10, 16, 22));
  });
  it("tanggal WIB dipakai walau UTC masih hari sebelumnya", () => {
    const now = new Date("2026-10-13T18:30:00.000Z"); // 14 Okt 01.30 WIB
    expect(planFlashSlots(now)[0].startsAt).toEqual(wibDate(2026, 10, 14, 12));
  });
});

describe("missingFlashSlots", () => {
  it("hanya mengembalikan slot yang belum ada, dan kosong bila semua sudah ada", () => {
    const planned = planFlashSlots(wibDate(2026, 10, 13, 9));
    const existing = planned.slice(0, 3);
    const missing = missingFlashSlots(planned, existing);
    expect(missing).toHaveLength(planned.length - 3);
    expect(missingFlashSlots(planned, planned)).toEqual([]);
  });
});

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("ensureFlashSaleSlots (integrasi)", () => {
  const client = postgres(url ?? "", { max: 4, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  // Dipakai tanggal jauh di depan supaya tidak bentrok dengan slot seed; dibersihkan setelah uji.
  const now = wibDate(2031, 1, 5, 9, 0);
  const horizon = wibDate(2031, 1, 5, 0);

  afterAll(async () => {
    await db.delete(schema.flashSales).where(gte(schema.flashSales.startsAt, horizon));
    await client.end();
  });

  it("tidak melakukan apa pun di luar DEMO_MODE", async () => {
    resetEnsureMemo();
    const r = await ensureFlashSaleSlots(db, { now, demoMode: false, force: true });
    expect(r).toEqual({ created: 0, skipped: true });
  });

  it("membuat 8 slot dengan item, lalu idempoten walau dipanggil bersamaan", async () => {
    resetEnsureMemo();
    const first = await ensureFlashSaleSlots(db, { now, demoMode: true, force: true });
    expect(first.created).toBe(8);
    const again = await Promise.all([1, 2, 3].map(() => ensureFlashSaleSlots(db, { now, demoMode: true, force: true })));
    expect(again.every((r) => r.created === 0)).toBe(true);

    const rows = await db
      .select({ name: schema.flashSales.name, startsAt: schema.flashSales.startsAt, n: sql<number>`count(*)` })
      .from(schema.flashSales)
      .where(gte(schema.flashSales.startsAt, horizon))
      .groupBy(schema.flashSales.name, schema.flashSales.startsAt);
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => Number(r.n) === 1)).toBe(true);

    const [slot] = await db
      .select({ id: schema.flashSales.id })
      .from(schema.flashSales)
      .where(and(gte(schema.flashSales.startsAt, horizon), eq(schema.flashSales.name, "Flash Sale Siang")))
      .limit(1);
    const items = await db.select({ sold: schema.flashSaleItems.sold }).from(schema.flashSaleItems).where(eq(schema.flashSaleItems.flashSaleId, slot.id));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.sold === 0)).toBe(true);
  });
});
