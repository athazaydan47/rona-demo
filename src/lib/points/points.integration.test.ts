// Poin terhadap database lokal: gerakan idempoten, tukar dengan batas 50%, kembali saat batal dan kedaluwarsa,
// tarik saat retur tanpa saldo negatif, dan pemeriksa konsistensi.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { awardOrderPoints, expireIfDue, transitionOrder } from "@/lib/orders/service";
import { checkPointsConsistency, earnedPoints, movePoints, pointKeys } from "./index";

describe.skipIf(!dbUrl)("poin (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, and } = t;
  let variantId = 0;
  let gudang = 0;
  const key = (s: string) => `uji:${s}:${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    variantId = (await t.variant("arunika-melati-malam-edp")).id;
    gudang = await t.location("gudang-online");
    await t.setStock(variantId, gudang, 60);
  });
  afterAll(() => t.cleanup());

  const buyerOf = (c: { id: number; name: string; phone: string }) => ({ name: c.name, phone: c.phone, customerId: c.id });
  const orderRow = async (number: string) => (await db.select().from(schema.orders).where(eq(schema.orders.number, number)))[0];

  it("gerakan poin idempoten lewat kunci unik", async () => {
    const c = await t.customer();
    const k = key("idempoten");
    const first = await movePoints(db, { customerId: c.id, amount: 100, reason: "Uji", key: k });
    const second = await movePoints(db, { customerId: c.id, amount: 100, reason: "Uji", key: k });
    expect(first).toMatchObject({ applied: 100, duplicate: false, balance: 100 });
    expect(second).toMatchObject({ applied: 0, duplicate: true, balance: 100 });
    expect(await t.points(c.id)).toBe(100);
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
  });

  it("penarikan tidak pernah membuat saldo negatif dan alasannya dicatat", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 30, reason: "Awal", key: key("awal") });
    const r = await movePoints(db, { customerId: c.id, amount: -100, reason: "Tarik uji", key: key("tarik") });
    expect(r).toMatchObject({ applied: -30, balance: 0 });
    const rows = await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.customerId, c.id));
    expect(rows.find((x) => x.amount === -30)?.reason).toContain("saldo tidak cukup");
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
  });

  it("pemeriksa konsistensi menemukan saldo yang tidak sama dengan ledger", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 40, reason: "Awal", key: key("k") });
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
    await db.update(schema.customers).set({ points: 45 }).where(eq(schema.customers.id, c.id));
    expect(await checkPointsConsistency(db, c.id)).toEqual([{ customerId: c.id, balance: 45, ledger: 40 }]);
    await db.update(schema.customers).set({ points: 40 }).where(eq(schema.customers.id, c.id));
  });

  it("tukar poin dibatasi 50% dari belanja setelah voucher dan dipotong di transaksi pesanan", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 1_000_000, reason: "Saldo besar", key: key("besar") });
    const r = await t.order({ items: [{ variantId, quantity: 1 }], buyer: buyerOf(c), pointsRequested: 1_000_000 });
    const o = await orderRow(r.number);
    expect(o.pointsUsed).toBe(Math.floor((o.subtotal - o.voucherDiscount) * 0.5));
    expect(await t.points(c.id)).toBe(1_000_000 - o.pointsUsed);
    const [ledger] = await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.idempotencyKey, pointKeys.redeem(r.number)));
    expect(ledger.amount).toBe(-o.pointsUsed);
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
  });

  it("dua pesanan bersamaan tidak bisa memakai poin yang sama", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 20_000, reason: "Saldo", key: key("saldo") });
    const settled = await Promise.allSettled([
      t.order({ items: [{ variantId, quantity: 1 }], buyer: buyerOf(c), pointsRequested: 20_000 }),
      t.order({ items: [{ variantId, quantity: 1 }], buyer: buyerOf(c), pointsRequested: 20_000 }),
    ]);
    // Baris pembeli dikunci: pesanan kedua melihat saldo yang sudah berkurang, sehingga totalnya berubah dan ditolak
    // (pembeli diminta mengecek ringkasan terbaru), atau berhasil dengan sisa poin yang benar.
    const ok = settled.filter((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof t.order>>> => x.status === "fulfilled").map((x) => x.value);
    const failed = settled.filter((x) => x.status === "rejected");
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const f of failed) expect(String((f as PromiseRejectedResult).reason)).toContain("harga_berubah");
    let used = 0;
    for (const o of ok) used += (await orderRow(o.number)).pointsUsed;
    expect(used).toBe(20_000 - (await t.points(c.id)));
    expect(await t.points(c.id)).toBeGreaterThanOrEqual(0);
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
  });

  it("poin yang dipakai kembali saat pesanan kedaluwarsa, hanya sekali", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 5_000, reason: "Saldo", key: key("saldo") });
    const placedAt = new Date();
    const r = await t.order({ items: [{ variantId, quantity: 1 }], buyer: buyerOf(c), pointsRequested: 5_000, now: placedAt });
    expect(await t.points(c.id)).toBe(0);
    expect(await expireIfDue(db, r.number, new Date(placedAt.getTime() + 16 * 60_000))).toBe(true);
    expect(await expireIfDue(db, r.number, new Date(placedAt.getTime() + 17 * 60_000))).toBe(false);
    expect(await t.points(c.id)).toBe(5_000);
    const refunds = await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.idempotencyKey, pointKeys.refundRedeem(r.number)));
    expect(refunds).toHaveLength(1);
  });

  it("poin yang dipakai kembali saat pesanan yang sudah dibayar dibatalkan", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 3_000, reason: "Saldo", key: key("saldo") });
    const r = await t.order({ items: [{ variantId, quantity: 1 }], buyer: buyerOf(c), pointsRequested: 3_000 });
    await t.pay(r.orderId);
    await transitionOrder(db, r.number, "dibatalkan", { actor: "uji", reason: "Dibatalkan admin" });
    expect(await t.points(c.id)).toBe(3_000);
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
  });

  it("pesanan Selesai memberi poin sesuai rumus, sekali saja", async () => {
    const c = await t.customer();
    await movePoints(db, { customerId: c.id, amount: 1_250, reason: "Saldo", key: key("saldo") });
    const r = await t.order({ items: [{ variantId, quantity: 2 }], buyer: buyerOf(c), pointsRequested: 1_250 });
    await t.pay(r.orderId);
    await transitionOrder(db, r.number, "diproses", { actor: "uji" });
    await transitionOrder(db, r.number, "dikirim", { actor: "uji" });
    await transitionOrder(db, r.number, "selesai", { actor: "pembeli" });
    const o = await orderRow(r.number);
    const expected = Math.floor((o.subtotal - o.voucherDiscount - o.pointsUsed) / 1000);
    expect(expected).toBe(earnedPoints(o));
    expect(o.pointsUsed).toBe(1_250);
    expect(await t.points(c.id)).toBe(expected);
    expect(await awardOrderPoints(db, o, new Date())).toBe(0);
    expect(await t.points(c.id)).toBe(expected);
  });

  it("retur menarik poin yang diberikan tanpa membuat saldo negatif", async () => {
    const c = await t.customer();
    const r = await t.order({ items: [{ variantId, quantity: 1 }], buyer: buyerOf(c) });
    await t.pay(r.orderId);
    await transitionOrder(db, r.number, "diproses", { actor: "uji" });
    await transitionOrder(db, r.number, "dikirim", { actor: "uji" });
    await transitionOrder(db, r.number, "selesai", { actor: "pembeli" });
    const earned = await t.points(c.id);
    expect(earned).toBeGreaterThan(10);
    // Sebagian poin sudah dibelanjakan sebelum retur disetujui.
    await movePoints(db, { customerId: c.id, amount: -10, reason: "Dipakai", key: key("pakai") });
    await transitionOrder(db, r.number, "diretur", { actor: "uji", reason: "Retur disetujui" });
    expect(await t.points(c.id)).toBe(0);
    const [claw] = await db.select().from(schema.pointsLedger).where(and(eq(schema.pointsLedger.customerId, c.id), eq(schema.pointsLedger.idempotencyKey, pointKeys.clawback(r.number))));
    expect(claw.amount).toBe(-(earned - 10));
    expect(claw.reason).toContain("saldo tidak cukup");
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
  });
});
