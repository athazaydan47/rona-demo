// Modul inventory: satu-satunya jalan untuk mengubah stok. Setiap perubahan menulis stock_movements.
// Semua fungsi dipanggil di dalam transaksi setelah baris inventory dikunci dengan lockInventory.
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export type InventoryKey = { variantId: number; locationId: number };
export type LockedRow = { id: number; variantId: number; locationId: number; onHand: number; reserved: number };

export class StockError extends Error {
  constructor(
    message: string,
    public variantId: number,
    public available: number,
  ) {
    super(message);
    this.name = "StockError";
  }
}

const key = (k: InventoryKey) => `${k.variantId}:${k.locationId}`;

// Kunci baris inventory dengan SELECT FOR UPDATE, berurutan berdasarkan id supaya tidak terjadi deadlock.
export async function lockInventory(tx: AnyDb, keys: InventoryKey[]): Promise<Map<string, LockedRow>> {
  const unique = [...new Map(keys.map((k) => [key(k), k])).values()];
  if (unique.length === 0) return new Map();
  const conds = unique.map((k) => and(eq(schema.inventory.variantId, k.variantId), eq(schema.inventory.locationId, k.locationId)));
  const rows = await tx
    .select({ id: schema.inventory.id, variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved })
    .from(schema.inventory)
    .where(or(...conds))
    .orderBy(asc(schema.inventory.id))
    .for("update");
  const map = new Map(rows.map((r) => [key(r), r]));
  // Baris yang belum ada dibuat dengan stok 0 supaya bisa dikunci dan dicatat.
  const missing = unique.filter((k) => !map.has(key(k)));
  if (missing.length) {
    await tx.insert(schema.inventory).values(missing.map((k) => ({ variantId: k.variantId, locationId: k.locationId, onHand: 0, reserved: 0 }))).onConflictDoNothing();
    return lockInventory(tx, keys);
  }
  return map;
}

export const available = (row: LockedRow) => Math.max(0, row.onHand - row.reserved);

type Move = InventoryKey & { quantity: number; reference: string; actor: string; note?: string };

function row(locked: Map<string, LockedRow>, k: InventoryKey) {
  const r = locked.get(key(k));
  if (!r) throw new Error(`Baris inventory ${key(k)} belum dikunci.`);
  return r;
}

async function write(tx: AnyDb, r: LockedRow, onHand: number, reserved: number) {
  if (onHand < 0 || reserved < 0 || reserved > onHand) throw new StockError("Perubahan stok tidak valid.", r.variantId, available(r));
  await tx.update(schema.inventory).set({ onHand, reserved, updatedAt: sql`now()` }).where(eq(schema.inventory.id, r.id));
  r.onHand = onHand;
  r.reserved = reserved;
}

async function log(tx: AnyDb, m: Move, type: "masuk" | "keluar" | "pesan" | "lepas" | "retur", quantity: number, at?: Date) {
  await tx.insert(schema.stockMovements).values({ variantId: m.variantId, locationId: m.locationId, type, quantity, reference: m.reference, actor: m.actor, note: m.note ?? "", ...(at ? { createdAt: at } : {}) });
}

// Pesanan dibuat: stok dipesan (reserved) bertambah.
export async function reserve(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  if (available(r) < m.quantity) throw new StockError("Stok tidak cukup.", m.variantId, available(r));
  await write(tx, r, r.onHand, r.reserved + m.quantity);
  await log(tx, m, "pesan", -m.quantity, at);
}

// Pesanan batal sebelum dibayar: stok dipesan dilepas.
export async function release(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  const qty = Math.min(m.quantity, r.reserved);
  await write(tx, r, r.onHand, r.reserved - qty);
  await log(tx, m, "lepas", qty, at);
}

// Pesanan dibayar: stok dipesan diubah menjadi potongan stok fisik.
export async function commitReserved(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  if (r.reserved < m.quantity) throw new StockError("Stok dipesan tidak sesuai.", m.variantId, available(r));
  await write(tx, r, r.onHand - m.quantity, r.reserved - m.quantity);
  await log(tx, m, "keluar", -m.quantity, at);
}

// Barang yang sudah dipotong kembali ke stok (pesanan dibayar lalu dibatalkan).
export async function restock(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  await write(tx, r, r.onHand + m.quantity, r.reserved);
  await log(tx, m, "masuk", m.quantity, at);
}

// Ketersediaan per lokasi tanpa mengunci (untuk tampilan dan validasi awal).
export async function availabilityByVariant(db: AnyDb, variantIds: number[]) {
  if (variantIds.length === 0) return new Map<number, Map<number, number>>();
  const rows = await db
    .select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved })
    .from(schema.inventory)
    .where(inArray(schema.inventory.variantId, variantIds));
  const out = new Map<number, Map<number, number>>();
  for (const r of rows) {
    const m = out.get(r.variantId) ?? new Map<number, number>();
    m.set(r.locationId, Math.max(0, r.onHand - r.reserved));
    out.set(r.variantId, m);
  }
  return out;
}
