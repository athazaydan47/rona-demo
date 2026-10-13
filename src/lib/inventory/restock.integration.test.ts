// "Kabari aku": notifikasi dibuat tepat sekali saat stok tersedia Gudang Online naik dari 0.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { requestRestockFor } from "@/lib/account/restock";
import { expireIfDue } from "@/lib/orders/service";
import { lockInventory, restock } from "./index";

describe.skipIf(!dbUrl)("Kabari aku (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, and } = t;
  let variantId = 0;
  let gudang = 0;
  let toko = 0;

  beforeAll(async () => {
    variantId = (await t.variant("nara-men-2-in-1-shampoo")).id;
    gudang = await t.location("gudang-online");
    toko = await t.location("dinoyo");
    await t.setStock(variantId, gudang, 0);
    await t.setStock(variantId, toko, 0);
  });
  afterAll(() => t.cleanup());

  const addStock = (locationId: number, quantity: number) =>
    db.transaction(async (tx) => {
      const locked = await lockInventory(tx, [{ variantId, locationId }]);
      await restock(tx, locked, { variantId, locationId, quantity, reference: "UJI-RESTOK", actor: "uji" });
    });
  const notifs = (customerId: number) => db.select().from(schema.notifications).where(and(eq(schema.notifications.customerId, customerId), eq(schema.notifications.kind, "stok_kembali")));

  it("terpicu sekali untuk setiap peminat saat stok online naik dari 0, lalu ditandai selesai", async () => {
    const a = await t.customer();
    const b = await t.customer();
    expect(await requestRestockFor(db, { customerId: a.id, phone: a.phone }, variantId)).toMatchObject({ ok: true, duplicate: false });
    expect(await requestRestockFor(db, { customerId: a.id, phone: a.phone }, variantId)).toMatchObject({ ok: true, duplicate: true });
    await requestRestockFor(db, { customerId: b.id, phone: b.phone }, variantId);

    // Stok toko naik tidak memicu (yang dipantau hanya Gudang Online).
    await addStock(toko, 3);
    expect(await notifs(a.id)).toHaveLength(0);

    await addStock(gudang, 5);
    expect(await notifs(a.id)).toHaveLength(1);
    expect(await notifs(b.id)).toHaveLength(1);
    expect((await notifs(a.id))[0]).toMatchObject({ channel: "wa", recipient: a.phone });
    const reqs = await db.select().from(schema.restockRequests).where(eq(schema.restockRequests.variantId, variantId));
    expect(reqs.filter((r) => r.customerId === a.id || r.customerId === b.id).every((r) => r.status === "terkirim" && r.notifiedAt)).toBe(true);

    // Stok bertambah lagi (dari 5 ke 8): tidak memicu ulang.
    await addStock(gudang, 3);
    expect(await notifs(a.id)).toHaveLength(1);
  });

  it("jalur lain (pesanan kedaluwarsa melepas stok) juga memicu", async () => {
    const buyer = await t.customer();
    const waiter = await t.customer();
    await t.setStock(variantId, gudang, 2);
    const placedAt = new Date();
    const r = await t.order({ items: [{ variantId, quantity: 2 }], buyer: { name: buyer.name, phone: buyer.phone, customerId: buyer.id }, now: placedAt });
    // Stok tersedia kini 0 karena dipesan semua.
    await requestRestockFor(db, { customerId: waiter.id, phone: waiter.phone }, variantId);
    expect(await notifs(waiter.id)).toHaveLength(0);
    await expireIfDue(db, r.number, new Date(placedAt.getTime() + 16 * 60_000));
    expect(await notifs(waiter.id)).toHaveLength(1);
  });
});
