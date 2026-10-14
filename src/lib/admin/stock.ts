// Stok di panel admin. Semua perubahan lewat modul inventory (menulis stock_movements, memicu "Kabari aku"),
// diperiksa dengan can() per lokasi, dan dicatat di log aktivitas.
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";
import { toWibParts } from "@/lib/format";
import { adjustOnHand, lockInventory, restock, StockError } from "@/lib/inventory";
import { writeAudit } from "./audit";
import { allLocations, can, canAccessLocation, type StaffPrincipal } from "./permissions";
import { SETTING_KEYS } from "@/lib/settings";

export const DEFAULT_LOW_STOCK = 5;
export const MAX_LINES = 50;
export const MAX_QTY = 10_000;

export async function lowStockThreshold(db: AnyDb) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, SETTING_KEYS.lowStock)).limit(1);
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : DEFAULT_LOW_STOCK;
}

export function stockReference(prefix: "MSK" | "TRF" | "OPN", at: Date) {
  const p = toWibParts(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${String(p.year).slice(2)}${pad(p.month)}${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function visibleLocations(db: AnyDb, staff: StaffPrincipal) {
  const rows = await db.select({ id: schema.locations.id, name: schema.locations.name, slug: schema.locations.slug, type: schema.locations.type }).from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(asc(schema.locations.sortOrder), asc(schema.locations.id));
  return rows.filter((l) => canAccessLocation(staff, l.id));
}

export type MatrixRow = {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  brandName: string;
  brandColor: string;
  packaging: Packaging;
  shadeName: string;
  hex: string;
  sku: string;
  cells: Record<number, { onHand: number; reserved: number; available: number | null }>; // available null = tidak dijual di lokasi itu
};

export type MatrixFilters = { q?: string | null; brand?: string | null; category?: string | null; status?: "semua" | "menipis" | "habis"; page?: number; pageSize?: number };

export async function stockMatrix(db: AnyDb, staff: StaffPrincipal, f: MatrixFilters) {
  const [locations, threshold] = await Promise.all([visibleLocations(db, staff), lowStockThreshold(db)]);
  const conds: SQL[] = [eq(schema.variants.isActive, true)];
  const q = (f.q ?? "").trim().replace(/[%_]/g, "");
  if (q) conds.push(or(ilike(schema.products.name, `%${q}%`), ilike(schema.variants.shadeName, `%${q}%`), ilike(schema.variants.sku, `%${q}%`), ilike(schema.brands.name, `%${q}%`))!);
  if (f.brand) conds.push(eq(schema.brands.slug, f.brand));
  if (f.category) conds.push(eq(schema.categories.slug, f.category));
  const variants = await db
    .select({
      variantId: schema.variants.id,
      productId: schema.products.id,
      productName: schema.products.name,
      productSlug: schema.products.slug,
      brandName: schema.brands.name,
      brandColor: schema.brands.color,
      packaging: schema.products.packaging,
      shadeName: schema.variants.shadeName,
      hex: schema.variants.hex,
      sku: schema.variants.sku,
    })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(and(...conds))
    .orderBy(asc(schema.brands.name), asc(schema.products.name), asc(schema.variants.sortOrder));
  const locIds = locations.map((l) => l.id);
  const inv = variants.length && locIds.length
    ? await db
        .select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved })
        .from(schema.inventory)
        .where(and(inArray(schema.inventory.variantId, variants.map((v) => v.variantId)), inArray(schema.inventory.locationId, locIds)))
    : [];
  const byKey = new Map(inv.map((i) => [`${i.variantId}:${i.locationId}`, i]));
  let rows: MatrixRow[] = variants.map((v) => ({
    ...v,
    cells: Object.fromEntries(
      locIds.map((id) => {
        const i = byKey.get(`${v.variantId}:${id}`);
        if (!i) return [id, { onHand: 0, reserved: 0, available: null }];
        return [id, { onHand: i.onHand, reserved: i.reserved, available: Math.max(0, i.onHand - i.reserved) }];
      }),
    ),
  }));
  const counts = { semua: rows.length, menipis: 0, habis: 0 };
  // Habis dan menipis hanya dihitung untuk lokasi yang menjual varian itu (available null diabaikan).
  const isOut = (r: MatrixRow) => locIds.some((id) => r.cells[id].available === 0);
  const isLow = (r: MatrixRow) => locIds.some((id) => (r.cells[id].available ?? 0) > 0 && (r.cells[id].available ?? 0) <= threshold);
  counts.habis = rows.filter(isOut).length;
  counts.menipis = rows.filter(isLow).length;
  if (f.status === "habis") rows = rows.filter(isOut);
  else if (f.status === "menipis") rows = rows.filter(isLow);
  const pageSize = f.pageSize ?? 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, f.page ?? 1), pageCount);
  return { locations, threshold, counts, total: rows.length, page, pageCount, rows: rows.slice((page - 1) * pageSize, page * pageSize) };
}

export async function variantStock(db: AnyDb, staff: StaffPrincipal, variantId: number, f: { type?: string | null; from?: Date | null; to?: Date | null; page?: number } = {}) {
  const [v] = await db
    .select({ variantId: schema.variants.id, productName: schema.products.name, productSlug: schema.products.slug, shadeName: schema.variants.shadeName, sku: schema.variants.sku, hex: schema.variants.hex, packaging: schema.products.packaging, brandName: schema.brands.name, brandColor: schema.brands.color })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(eq(schema.variants.id, variantId))
    .limit(1);
  if (!v) return null;
  const locations = await visibleLocations(db, staff);
  const locIds = locations.map((l) => l.id);
  const inv = await db.select().from(schema.inventory).where(and(eq(schema.inventory.variantId, variantId), inArray(schema.inventory.locationId, locIds.length ? locIds : [-1])));
  const conds: SQL[] = [eq(schema.stockMovements.variantId, variantId), inArray(schema.stockMovements.locationId, locIds.length ? locIds : [-1])];
  const types = ["masuk", "keluar", "transfer", "opname", "retur", "pesan", "lepas"] as const;
  if (f.type && (types as readonly string[]).includes(f.type)) conds.push(eq(schema.stockMovements.type, f.type as (typeof types)[number]));
  if (f.from) conds.push(gte(schema.stockMovements.createdAt, f.from));
  if (f.to) conds.push(lt(schema.stockMovements.createdAt, f.to));
  const pageSize = 30;
  const page = Math.max(1, f.page ?? 1);
  const movements = await db
    .select({ id: schema.stockMovements.id, type: schema.stockMovements.type, quantity: schema.stockMovements.quantity, reference: schema.stockMovements.reference, note: schema.stockMovements.note, actor: schema.stockMovements.actor, createdAt: schema.stockMovements.createdAt, locationId: schema.stockMovements.locationId })
    .from(schema.stockMovements)
    .where(and(...conds))
    .orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return {
    variant: v,
    locations: locations.map((l) => {
      const i = inv.find((x) => x.locationId === l.id);
      return { ...l, onHand: i?.onHand ?? 0, reserved: i?.reserved ?? 0, available: Math.max(0, (i?.onHand ?? 0) - (i?.reserved ?? 0)) };
    }),
    movements: movements.slice(0, pageSize),
    hasMore: movements.length > pageSize,
    page,
  };
}

export async function searchVariants(db: AnyDb, q: string, limit = 12) {
  const term = q.trim().replace(/[%_]/g, "");
  if (term.length < 2) return [];
  return db
    .select({ variantId: schema.variants.id, productName: schema.products.name, shadeName: schema.variants.shadeName, sku: schema.variants.sku, hex: schema.variants.hex, brandName: schema.brands.name })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(and(eq(schema.variants.isActive, true), or(ilike(schema.products.name, `%${term}%`), ilike(schema.variants.shadeName, `%${term}%`), ilike(schema.variants.sku, `%${term}%`), ilike(schema.brands.name, `%${term}%`))))
    .orderBy(asc(schema.products.name), asc(schema.variants.sortOrder))
    .limit(limit);
}

export type StockLine = { variantId: number; quantity: number };
export type StockActionResult = { ok: true; reference: string; productIds: number[]; lines: number } | { ok: false; message: string; issues?: { variantId: number; message: string }[] };

// Gabungkan baris varian yang sama dan validasi jumlah.
export function normalizeLines(lines: StockLine[]): { ok: true; lines: StockLine[] } | { ok: false; message: string } {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, message: "Tambahkan minimal satu baris." };
  if (lines.length > MAX_LINES) return { ok: false, message: `Maksimal ${MAX_LINES} baris sekali simpan.` };
  const merged = new Map<number, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.variantId) || l.variantId <= 0) return { ok: false, message: "Ada baris tanpa varian." };
    if (!Number.isInteger(l.quantity) || l.quantity <= 0 || l.quantity > MAX_QTY) return { ok: false, message: `Jumlah harus 1 sampai ${MAX_QTY}.` };
    merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);
  }
  return { ok: true, lines: [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity })) };
}

async function productIdsOf(db: AnyDb, variantIds: number[]) {
  if (!variantIds.length) return [];
  const rows = await db.selectDistinct({ productId: schema.variants.productId }).from(schema.variants).where(inArray(schema.variants.id, variantIds));
  return rows.map((r) => r.productId);
}

async function assertVariants(db: AnyDb, ids: number[]) {
  const rows = await db.select({ id: schema.variants.id }).from(schema.variants).where(inArray(schema.variants.id, ids));
  return rows.length === new Set(ids).size;
}

export async function receiveStock(db: AnyDb, staff: StaffPrincipal, input: { locationId: number; lines: StockLine[]; reference?: string; note?: string; now?: Date }): Promise<StockActionResult> {
  if (!can(staff, "stok.masuk", { lokasiId: input.locationId })) return { ok: false, message: "Kamu tidak punya izin stok masuk di lokasi ini." };
  const n = normalizeLines(input.lines);
  if (!n.ok) return n;
  if (!(await assertVariants(db, n.lines.map((l) => l.variantId)))) return { ok: false, message: "Ada varian yang tidak ditemukan." };
  const at = input.now ?? new Date();
  const reference = (input.reference ?? "").trim().slice(0, 40) || stockReference("MSK", at);
  const note = (input.note ?? "").trim().slice(0, 200) || "Stok masuk";
  await db.transaction(async (tx) => {
    const locked = await lockInventory(tx, n.lines.map((l) => ({ variantId: l.variantId, locationId: input.locationId })));
    for (const l of n.lines) await restock(tx, locked, { variantId: l.variantId, locationId: input.locationId, quantity: l.quantity, reference, actor: staff.name, note }, at);
    await writeAudit(tx, { staff, action: "stok.masuk", objectType: "stok", objectId: reference, locationId: input.locationId, summary: `Stok masuk ${n.lines.length} varian, ${n.lines.reduce((s, l) => s + l.quantity, 0)} pcs`, after: { lokasiId: input.locationId, baris: n.lines, catatan: note }, at });
  });
  return { ok: true, reference, productIds: await productIdsOf(db, n.lines.map((l) => l.variantId)), lines: n.lines.length };
}

export async function transferStock(db: AnyDb, staff: StaffPrincipal, input: { fromId: number; toId: number; lines: StockLine[]; note?: string; now?: Date }): Promise<StockActionResult> {
  if (!fiturAktif("multiCabang")) return { ok: false, message: "Transfer antar lokasi tidak aktif di toko ini." };
  if (input.fromId === input.toId) return { ok: false, message: "Lokasi asal dan tujuan tidak boleh sama." };
  if (!can(staff, "stok.transfer", { lokasiId: input.fromId }) || !can(staff, "stok.transfer", { lokasiId: input.toId })) return { ok: false, message: "Kamu tidak punya izin transfer untuk lokasi ini." };
  const n = normalizeLines(input.lines);
  if (!n.ok) return n;
  if (!(await assertVariants(db, n.lines.map((l) => l.variantId)))) return { ok: false, message: "Ada varian yang tidak ditemukan." };
  const at = input.now ?? new Date();
  const reference = stockReference("TRF", at);
  const note = (input.note ?? "").trim().slice(0, 200);
  try {
    await db.transaction(async (tx) => {
      // Kunci baris kedua lokasi sekaligus, berurutan berdasarkan id (lockInventory).
      const locked = await lockInventory(tx, n.lines.flatMap((l) => [{ variantId: l.variantId, locationId: input.fromId }, { variantId: l.variantId, locationId: input.toId }]));
      const issues: { variantId: number; message: string }[] = [];
      for (const l of n.lines) {
        const r = locked.get(`${l.variantId}:${input.fromId}`)!;
        const avail = Math.max(0, r.onHand - r.reserved);
        if (avail < l.quantity) issues.push({ variantId: l.variantId, message: `Tersedia di asal hanya ${avail}.` });
      }
      if (issues.length) throw Object.assign(new StockError("Stok tersedia di lokasi asal tidak cukup.", issues[0].variantId, 0), { issues });
      for (const l of n.lines) {
        await adjustOnHand(tx, locked, { variantId: l.variantId, locationId: input.fromId, delta: -l.quantity, type: "transfer", reference, actor: staff.name, note: note || "Transfer keluar" }, at);
        await adjustOnHand(tx, locked, { variantId: l.variantId, locationId: input.toId, delta: l.quantity, type: "transfer", reference, actor: staff.name, note: note || "Transfer masuk" }, at);
      }
      await writeAudit(tx, { staff, action: "stok.transfer", objectType: "stok", objectId: reference, locationId: input.fromId, summary: `Transfer ${n.lines.reduce((s, l) => s + l.quantity, 0)} pcs`, after: { dari: input.fromId, ke: input.toId, baris: n.lines, catatan: note }, at });
    });
  } catch (e) {
    if (e instanceof StockError) return { ok: false, message: e.message, issues: (e as StockError & { issues?: { variantId: number; message: string }[] }).issues };
    throw e;
  }
  return { ok: true, reference, productIds: await productIdsOf(db, n.lines.map((l) => l.variantId)), lines: n.lines.length };
}

export { opnamePreview, type OpnamePreview, type OpnameRow } from "./opname";
import { opnamePreview, type OpnamePreview } from "./opname";
import { fiturAktif } from "@/config/fitur";

export async function submitOpname(db: AnyDb, staff: StaffPrincipal, input: { locationId: number; counts: { variantId: number; counted: number }[]; note?: string; now?: Date }): Promise<StockActionResult & { preview?: OpnamePreview }> {
  if (!can(staff, "stok.opname", { lokasiId: input.locationId })) return { ok: false, message: "Kamu tidak punya izin opname di lokasi ini." };
  if (!Array.isArray(input.counts) || input.counts.length === 0) return { ok: false, message: "Isi jumlah fisik minimal satu varian." };
  if (input.counts.length > 300) return { ok: false, message: "Maksimal 300 baris sekali opname." };
  for (const c of input.counts) if (!Number.isInteger(c.variantId) || !Number.isInteger(c.counted) || c.counted < 0 || c.counted > MAX_QTY) return { ok: false, message: "Jumlah fisik harus bilangan bulat 0 atau lebih." };
  const at = input.now ?? new Date();
  const reference = stockReference("OPN", at);
  const note = (input.note ?? "").trim().slice(0, 200) || "Opname";
  let preview: OpnamePreview | null = null;
  try {
    await db.transaction(async (tx) => {
      const locked = await lockInventory(tx, input.counts.map((c) => ({ variantId: c.variantId, locationId: input.locationId })));
      preview = opnamePreview(input.counts.map((c) => {
        const r = locked.get(`${c.variantId}:${input.locationId}`)!;
        return { variantId: c.variantId, onHand: r.onHand, reserved: r.reserved, counted: c.counted };
      }));
      if (preview.violations) {
        const bad = preview.rows.filter((r) => r.belowReserved);
        throw Object.assign(new StockError("Jumlah fisik lebih kecil dari stok yang sedang dipesan.", bad[0].variantId, 0), { issues: bad.map((r) => ({ variantId: r.variantId, message: `Dihitung ${r.counted}, padahal ${r.reserved} sedang dipesan pembeli.` })) });
      }
      for (const r of preview.rows) {
        if (r.diff === 0) continue;
        await adjustOnHand(tx, locked, { variantId: r.variantId, locationId: input.locationId, delta: r.diff, type: "opname", reference, actor: staff.name, note }, at);
      }
      await writeAudit(tx, {
        staff,
        action: "stok.opname",
        objectType: "stok",
        objectId: reference,
        locationId: input.locationId,
        summary: `Opname ${preview.rows.length} varian, ${preview.changed} berubah, selisih ${preview.totalDiff > 0 ? "+" : ""}${preview.totalDiff}`,
        before: Object.fromEntries(preview.rows.filter((r) => r.diff !== 0).map((r) => [r.variantId, r.onHand])),
        after: Object.fromEntries(preview.rows.filter((r) => r.diff !== 0).map((r) => [r.variantId, r.counted])),
        at,
      });
    });
  } catch (e) {
    if (e instanceof StockError) return { ok: false, message: e.message, issues: (e as StockError & { issues?: { variantId: number; message: string }[] }).issues };
    throw e;
  }
  const p = preview as OpnamePreview | null;
  return { ok: true, reference, productIds: await productIdsOf(db, input.counts.map((c) => c.variantId)), lines: p?.changed ?? 0, preview: p ?? undefined };
}

export const stockLocationScope = (staff: StaffPrincipal) => (allLocations(staff) ? null : staff.locationIds);
