// Penjaga stok (Fase 8B): setiap jalur yang bisa membuat stok negatif atau tidak sinkron dengan ledger harus menolak
// dengan StockError, tidak mengubah inventory, dan tidak menulis stock_movements. Setiap skenario berjalan di dalam
// transaksi yang dibatalkan di akhir, jadi database uji tidak berubah.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import type { AnyDb } from "@/lib/db-types";
import { adjustOnHand, availabilityByVariant, available, commitReserved, lockInventory, release, reserve, restock, StockError } from "./index";

const BATAL = new Error("batalkan transaksi uji");

describe.skipIf(!dbUrl)("penjaga modul inventory (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, and } = t;
  let variantId = 0;
  let gudang = 0;
  let dinoyo = 0;
  const ref = { reference: "UJI-PENJAGA", actor: "uji" };

  beforeAll(async () => {
    variantId = (await t.variant("teduh-gentle-milk-cleanser")).id;
    gudang = await t.location("gudang-online");
    dinoyo = await t.location("dinoyo");
    await t.setStock(variantId, gudang, 5);
  });
  afterAll(() => t.cleanup());

  // Jalankan skenario di transaksi yang selalu dibatalkan; kembalikan apa pun yang dihasilkan skenario.
  async function dalamTx<T>(fn: (tx: AnyDb) => Promise<T>): Promise<T> {
    let out: T | undefined;
    await db
      .transaction(async (tx) => {
        out = await fn(tx as unknown as AnyDb);
        throw BATAL;
      })
      .catch((e) => {
        if (e !== BATAL) throw e;
      });
    return out as T;
  }

  const gerakan = (tx: AnyDb) =>
    (tx as typeof db).select({ type: schema.stockMovements.type, quantity: schema.stockMovements.quantity }).from(schema.stockMovements).where(and(eq(schema.stockMovements.variantId, variantId), eq(schema.stockMovements.reference, ref.reference)));

  it("mengunci daftar kosong tanpa query, dan membuat baris stok 0 untuk lokasi yang belum punya", async () => {
    expect((await lockInventory(db as unknown as AnyDb, [])).size).toBe(0);
    const r = await dalamTx(async (tx) => {
      await (tx as typeof db).delete(schema.inventory).where(and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.locationId, dinoyo)));
      const locked = await lockInventory(tx, [{ variantId, locationId: dinoyo }, { variantId, locationId: dinoyo }]);
      return [...locked.values()];
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ variantId, locationId: dinoyo, onHand: 0, reserved: 0 });
  });

  it("menolak mengubah baris yang belum dikunci", async () => {
    await expect(dalamTx(async (tx) => reserve(tx, new Map(), { variantId, locationId: gudang, quantity: 1, ...ref }))).rejects.toThrow(/belum dikunci/);
  });

  it("menolak memesan melebihi stok tersedia, tanpa menulis apa pun", async () => {
    const out = await dalamTx(async (tx) => {
      const locked = await lockInventory(tx, [{ variantId, locationId: gudang }]);
      const e = await reserve(tx, locked, { variantId, locationId: gudang, quantity: 6, ...ref }).catch((x: unknown) => x);
      return { e, row: [...locked.values()][0], moves: await gerakan(tx) };
    });
    expect(out.e).toBeInstanceOf(StockError);
    expect(out.e).toMatchObject({ message: "Stok tidak cukup.", variantId, available: 5 });
    expect(out.row).toMatchObject({ onHand: 5, reserved: 0 });
    expect(out.moves).toEqual([]);
  });

  it("alur pesan, bayar, dan retur menulis ledger yang jumlahnya sama dengan perubahan stok", async () => {
    const out = await dalamTx(async (tx) => {
      const locked = await lockInventory(tx, [{ variantId, locationId: gudang }]);
      const k = { variantId, locationId: gudang, ...ref };
      await reserve(tx, locked, { ...k, quantity: 3 });
      const setelahPesan = { ...[...locked.values()][0] };
      await commitReserved(tx, locked, { ...k, quantity: 2 });
      await release(tx, locked, { ...k, quantity: 1 });
      await restock(tx, locked, { ...k, quantity: 2 });
      const [db1] = await (tx as typeof db).select().from(schema.inventory).where(and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.locationId, gudang)));
      return { setelahPesan, akhir: db1, moves: await gerakan(tx) };
    });
    expect(available(out.setelahPesan)).toBe(2);
    expect(out.akhir).toMatchObject({ onHand: 5, reserved: 0 });
    expect(out.moves).toEqual([
      { type: "pesan", quantity: -3 },
      { type: "keluar", quantity: -2 },
      { type: "lepas", quantity: 1 },
      { type: "masuk", quantity: 2 },
    ]);
    // Ledger stok fisik: keluar dan masuk saja yang mengubah on_hand.
    expect(out.moves.filter((m) => m.type === "keluar" || m.type === "masuk").reduce((s, m) => s + m.quantity, 0)).toBe(0);
  });

  it("melepas reservasi tidak pernah melebihi yang dipesan, dan ledger mencatat jumlah sebenarnya", async () => {
    const out = await dalamTx(async (tx) => {
      const locked = await lockInventory(tx, [{ variantId, locationId: gudang }]);
      await reserve(tx, locked, { variantId, locationId: gudang, quantity: 1, ...ref });
      await release(tx, locked, { variantId, locationId: gudang, quantity: 4, ...ref });
      return { row: [...locked.values()][0], moves: await gerakan(tx) };
    });
    expect(out.row).toMatchObject({ onHand: 5, reserved: 0 });
    expect(out.moves.at(-1)).toEqual({ type: "lepas", quantity: 1 });
  });

  it("menolak memotong stok melebihi yang dipesan", async () => {
    const e = await dalamTx(async (tx) => {
      const locked = await lockInventory(tx, [{ variantId, locationId: gudang }]);
      await reserve(tx, locked, { variantId, locationId: gudang, quantity: 1, ...ref });
      return commitReserved(tx, locked, { variantId, locationId: gudang, quantity: 2, ...ref }).catch((x: unknown) => x);
    });
    expect(e).toMatchObject({ name: "StockError", message: "Stok dipesan tidak sesuai." });
  });

  it("opname dan transfer tidak boleh membuat stok fisik di bawah jumlah dipesan", async () => {
    const out = await dalamTx(async (tx) => {
      const locked = await lockInventory(tx, [{ variantId, locationId: gudang }]);
      await reserve(tx, locked, { variantId, locationId: gudang, quantity: 4, ...ref });
      const opname = await adjustOnHand(tx, locked, { variantId, locationId: gudang, delta: -2, type: "opname", ...ref }).catch((x: unknown) => x);
      const transfer = await adjustOnHand(tx, locked, { variantId, locationId: gudang, delta: -2, type: "transfer", ...ref }).catch((x: unknown) => x);
      await adjustOnHand(tx, locked, { variantId, locationId: gudang, delta: -1, type: "opname", ...ref });
      return { opname, transfer, row: [...locked.values()][0], moves: await gerakan(tx) };
    });
    expect(out.opname).toMatchObject({ name: "StockError", message: "Jumlah fisik lebih kecil dari stok yang sedang dipesan." });
    expect(out.transfer).toMatchObject({ name: "StockError", message: "Stok tersedia di lokasi asal tidak cukup." });
    expect(out.row).toMatchObject({ onHand: 4, reserved: 4 });
    expect(out.moves.at(-1)).toEqual({ type: "opname", quantity: -1 });
  });

  it("ketersediaan tanpa kunci: daftar kosong dan stok minus dibaca 0", async () => {
    expect((await availabilityByVariant(db as unknown as AnyDb, [])).size).toBe(0);
    const m = await availabilityByVariant(db as unknown as AnyDb, [variantId]);
    expect(m.get(variantId)?.get(gudang)).toBe(5);
    expect(available({ id: 0, variantId, locationId: gudang, onHand: 2, reserved: 3 })).toBe(0);
  });
});
