// Ulasan terhadap database lokal: syarat Selesai, satu per item, bonus pertama sekali, hitung ulang rating.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { transitionOrder } from "@/lib/orders/service";
import { checkPointsConsistency } from "@/lib/points";
import { createReview, reviewableItems } from "./service";

describe.skipIf(!dbUrl)("ulasan (integrasi)", () => {
  const t = integration();
  const { db, schema, eq } = t;
  let v1 = { id: 0, productId: 0 };
  let v2 = { id: 0, productId: 0 };
  const now = new Date();
  const body = "Teksturnya ringan dan wanginya lembut, cocok dipakai harian.";

  beforeAll(async () => {
    const gudang = await t.location("gudang-online");
    v1 = await t.variant("arunika-hujan-edp");
    v2 = await t.variant("dayu-brow-pencil-duo");
    await t.setStock(v1.id, gudang, 40);
    await t.setStock(v2.id, gudang, 40);
  });
  afterAll(() => t.cleanup());

  async function completedOrder(c: { id: number; name: string; phone: string }, items: { variantId: number; quantity: number }[], finish = true) {
    const r = await t.order({ items, buyer: { name: c.name, phone: c.phone, customerId: c.id } });
    await t.pay(r.orderId);
    if (finish) {
      await transitionOrder(db, r.number, "diproses", { actor: "uji" });
      await transitionOrder(db, r.number, "dikirim", { actor: "uji" });
      await transitionOrder(db, r.number, "selesai", { actor: "pembeli" });
    }
    const items2 = await db.select({ id: schema.orderItems.id, variantId: schema.orderItems.variantId }).from(schema.orderItems).where(eq(schema.orderItems.orderId, r.orderId));
    return { ...r, items: items2 };
  }

  it("hanya untuk pesanan Selesai milik pembeli itu sendiri", async () => {
    const a = await t.customer({ name: "Ayu Lestari" });
    const b = await t.customer();
    const paid = await completedOrder(a, [{ variantId: v1.id, quantity: 1 }], false);
    expect(await createReview(db, { customerId: a.id, orderItemId: paid.items[0].id, rating: 5, body, now })).toMatchObject({ ok: false, code: "belum_selesai" });
    const done = await completedOrder(a, [{ variantId: v1.id, quantity: 1 }]);
    expect(await createReview(db, { customerId: b.id, orderItemId: done.items[0].id, rating: 5, body, now })).toMatchObject({ ok: false, code: "tidak_ditemukan" });
    expect(await reviewableItems(db, b.id, done.number)).toEqual([]);
    expect(await createReview(db, { customerId: a.id, orderItemId: done.items[0].id, rating: 5, body: "terlalu pendek", now })).toMatchObject({ ok: false, code: "tidak_valid" });
    const ok = await createReview(db, { customerId: a.id, orderItemId: done.items[0].id, rating: 5, body, skinType: "kombinasi", now });
    expect(ok).toMatchObject({ ok: true });
    const [rev] = await db.select().from(schema.reviews).where(eq(schema.reviews.customerId, a.id));
    expect(rev).toMatchObject({ authorName: "Ayu L.", isVerified: true, status: "tampil", variantId: v1.id, skinType: "kombinasi" });
  });

  it("satu ulasan per item, bonus 50 poin hanya untuk ulasan pertama", async () => {
    const c = await t.customer();
    const o = await completedOrder(c, [
      { variantId: v1.id, quantity: 1 },
      { variantId: v2.id, quantity: 1 },
    ]);
    const before = await t.points(c.id);
    const first = await createReview(db, { customerId: c.id, orderItemId: o.items[0].id, rating: 4, body, now });
    expect(first).toMatchObject({ ok: true, bonus: 50 });
    expect(await t.points(c.id)).toBe(before + 50);
    expect(await createReview(db, { customerId: c.id, orderItemId: o.items[0].id, rating: 1, body, now })).toMatchObject({ ok: false, code: "sudah_diulas" });
    const second = await createReview(db, { customerId: c.id, orderItemId: o.items[1].id, rating: 5, body, now });
    expect(second).toMatchObject({ ok: true, bonus: 0 });
    expect(await t.points(c.id)).toBe(before + 50);
    const bonusRows = await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.idempotencyKey, `bonus-ulasan-pertama:${c.id}`));
    expect(bonusRows).toHaveLength(1);
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
    const items = await reviewableItems(db, c.id, o.number);
    expect(items.every((i) => i.reviewId != null)).toBe(true);
  });

  it("dua ulasan bersamaan untuk item yang sama: hanya satu tersimpan", async () => {
    const c = await t.customer();
    const o = await completedOrder(c, [{ variantId: v2.id, quantity: 1 }]);
    const results = await Promise.all([1, 2, 3].map(() => createReview(db, { customerId: c.id, orderItemId: o.items[0].id, rating: 5, body, now })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await t.points(c.id)).toBe((await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.customerId, c.id))).reduce((s, r) => s + r.amount, 0));
  });

  it("rating rata-rata dan jumlah ulasan produk dihitung ulang dari ulasan tayang", async () => {
    const c = await t.customer();
    const o = await completedOrder(c, [{ variantId: v2.id, quantity: 1 }]);
    await createReview(db, { customerId: c.id, orderItemId: o.items[0].id, rating: 1, body, now });
    const all = await db.select({ rating: schema.reviews.rating }).from(schema.reviews).where(eq(schema.reviews.productId, v2.productId));
    const [p] = await db.select({ ratingAvg: schema.products.ratingAvg, reviewCount: schema.products.reviewCount }).from(schema.products).where(eq(schema.products.id, v2.productId));
    expect(p.reviewCount).toBe(all.length);
    expect(p.ratingAvg).toBe(Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10);
  });
});
