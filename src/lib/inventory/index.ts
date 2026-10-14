// Modul inventory: satu-satunya jalan untuk mengubah stok. Setiap perubahan menulis stock_movements.
// Semua fungsi dipanggil di dalam transaksi setelah baris inventory dikunci dengan lockInventory.
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { pesanStokKembali } from "@/lib/content/notifikasi";

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

async function write(tx: AnyDb, r: LockedRow, onHand: number, reserved: number, at?: Date) {
  if (onHand < 0 || reserved < 0 || reserved > onHand) throw new StockError("Perubahan stok tidak valid.", r.variantId, available(r));
  const before = available(r);
  await tx.update(schema.inventory).set({ onHand, reserved, updatedAt: sql`now()` }).where(eq(schema.inventory.id, r.id));
  r.onHand = onHand;
  r.reserved = reserved;
  // "Kabari aku": dipicu di sini supaya semua jalur perubahan stok ikut (batal, retur, stok masuk dari admin).
  if (before === 0 && available(r) > 0) await notifyRestockIfOnline(tx, r, at);
}

export const ONLINE_WAREHOUSE_SLUG = "gudang-online";

// Stok tersedia Gudang Online naik dari 0: buat notifikasi untuk setiap peminat varian ini, lalu tandai selesai.
async function notifyRestockIfOnline(tx: AnyDb, r: LockedRow, at?: Date) {
  const [loc] = await tx.select({ slug: schema.locations.slug }).from(schema.locations).where(eq(schema.locations.id, r.locationId)).limit(1);
  if (loc?.slug !== ONLINE_WAREHOUSE_SLUG) return;
  const waiting = await tx
    .select({ id: schema.restockRequests.id, customerId: schema.restockRequests.customerId, contact: schema.restockRequests.contact })
    .from(schema.restockRequests)
    .where(and(eq(schema.restockRequests.variantId, r.variantId), eq(schema.restockRequests.status, "menunggu")))
    .orderBy(asc(schema.restockRequests.id))
    .for("update", { skipLocked: true });
  if (waiting.length === 0) return;
  const [v] = await tx
    .select({ productName: schema.products.name, slug: schema.products.slug, shadeName: schema.variants.shadeName })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(eq(schema.variants.id, r.variantId));
  const ids = waiting.map((w) => w.id);
  const when = at ?? new Date();
  const label = v ? `${v.productName} (${v.shadeName})` : "Produk incaranmu";
  const customerIds = [...new Set(waiting.map((w) => w.customerId).filter((x): x is number => x != null))];
  const names = new Map(
    customerIds.length
      ? (await tx.select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone }).from(schema.customers).where(inArray(schema.customers.id, customerIds))).map((c) => [c.id, c])
      : [],
  );
  await tx.insert(schema.notifications).values(
    waiting.map((w) => {
      const c = w.customerId ? names.get(w.customerId) : undefined;
      const email = w.contact.includes("@");
      const greet = c?.name ? `Halo ${c.name.split(" ")[0]}` : "Halo";
      return {
        customerId: w.customerId,
        kind: "stok_kembali",
        channel: email ? ("email" as const) : ("wa" as const),
        recipient: c?.phone ?? w.contact,
        ...pesanStokKembali(greet, label, v?.slug ?? ""),
        createdAt: when,
      };
    }),
  );
  await tx.update(schema.restockRequests).set({ status: "terkirim", notifiedAt: when }).where(inArray(schema.restockRequests.id, ids));
}

async function log(tx: AnyDb, m: Move, type: "masuk" | "keluar" | "pesan" | "lepas" | "retur" | "transfer" | "opname", quantity: number, at?: Date) {
  await tx.insert(schema.stockMovements).values({ variantId: m.variantId, locationId: m.locationId, type, quantity, reference: m.reference, actor: m.actor, note: m.note ?? "", ...(at ? { createdAt: at } : {}) });
}

// Pesanan dibuat: stok dipesan (reserved) bertambah.
export async function reserve(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  if (available(r) < m.quantity) throw new StockError("Stok tidak cukup.", m.variantId, available(r));
  await write(tx, r, r.onHand, r.reserved + m.quantity, at);
  await log(tx, m, "pesan", -m.quantity, at);
}

// Pesanan batal sebelum dibayar: stok dipesan dilepas.
export async function release(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  const qty = Math.min(m.quantity, r.reserved);
  await write(tx, r, r.onHand, r.reserved - qty, at);
  await log(tx, m, "lepas", qty, at);
}

// Pesanan dibayar: stok dipesan diubah menjadi potongan stok fisik.
export async function commitReserved(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  if (r.reserved < m.quantity) throw new StockError("Stok dipesan tidak sesuai.", m.variantId, available(r));
  await write(tx, r, r.onHand - m.quantity, r.reserved - m.quantity, at);
  await log(tx, m, "keluar", -m.quantity, at);
}

// Barang yang sudah dipotong kembali ke stok (pesanan dibayar lalu dibatalkan).
export async function restock(tx: AnyDb, locked: Map<string, LockedRow>, m: Move, at?: Date) {
  const r = row(locked, m);
  await write(tx, r, r.onHand + m.quantity, r.reserved, at);
  await log(tx, m, "masuk", m.quantity, at);
}

// Penyesuaian stok fisik oleh staf: transfer (keluar dari asal, masuk ke tujuan) dan opname (sebesar selisih).
// Stok fisik tidak boleh lebih kecil dari jumlah dipesan.
export async function adjustOnHand(tx: AnyDb, locked: Map<string, LockedRow>, m: Omit<Move, "quantity"> & { delta: number; type: "transfer" | "opname" }, at?: Date) {
  const r = row(locked, m);
  const next = r.onHand + m.delta;
  if (next < r.reserved) throw new StockError(m.type === "opname" ? "Jumlah fisik lebih kecil dari stok yang sedang dipesan." : "Stok tersedia di lokasi asal tidak cukup.", m.variantId, available(r));
  await write(tx, r, next, r.reserved, at);
  await log(tx, { ...m, quantity: Math.abs(m.delta) }, m.type, m.delta, at);
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
