// Menjamin selalu ada slot flash sale untuk hari ini sampai 3 hari ke depan saat DEMO_MODE=true.
// Idempoten: dilindungi advisory lock Postgres supaya aman dipanggil bersamaan, dan hanya dijalankan
// sekali per hari WIB per proses.
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { toWibParts, wibDate } from "@/lib/format";
import { roundToPromo } from "@/lib/pricing";
import { now as clockNow } from "@/lib/clock";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<any, any, any>;

export const SLOT_PATTERN = [
  { name: "Flash Sale Siang", start: 12, end: 14 },
  { name: "Flash Sale Malam", start: 20, end: 22 },
] as const;
export const DAYS_AHEAD = 3;
const LOCK_KEY = 72510204; // kunci advisory tetap untuk modul ini

export type PlannedSlot = { name: string; startsAt: Date; endsAt: Date };

// Semua slot yang seharusnya ada dari hari ini (WIB) sampai DAYS_AHEAD hari ke depan.
export function planFlashSlots(now: Date, daysAhead = DAYS_AHEAD): PlannedSlot[] {
  const out: PlannedSlot[] = [];
  for (let d = 0; d <= daysAhead; d++) {
    const p = toWibParts(new Date(now.getTime() + d * 86400000));
    for (const s of SLOT_PATTERN) {
      out.push({ name: s.name, startsAt: wibDate(p.year, p.month, p.day, s.start), endsAt: wibDate(p.year, p.month, p.day, s.end) });
    }
  }
  return out;
}

export type ExistingSlot = { name: string; startsAt: Date; endsAt?: Date; source?: string; isActive?: boolean };

const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) => a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();

// Slot otomatis yang belum ada (dibandingkan lewat waktu mulai dan nama). Slot admin selalu menang: slot otomatis
// tidak dibuat bila jendelanya bertabrakan dengan slot buatan admin yang aktif.
export function missingFlashSlots(planned: PlannedSlot[], existing: ExistingSlot[]): PlannedSlot[] {
  const keys = new Set(existing.map((e) => `${e.name}|${e.startsAt.getTime()}`));
  const admin = existing.filter((e): e is ExistingSlot & { endsAt: Date } => e.source === "admin" && e.isActive !== false && e.endsAt != null);
  return planned.filter((p) => !keys.has(`${p.name}|${p.startsAt.getTime()}`) && !admin.some((a) => overlaps(p, a)));
}

export type EnsureResult = { created: number; skipped: boolean };

let ensuredForDay: string | null = null;

export function resetEnsureMemo() {
  ensuredForDay = null;
}

export async function ensureFlashSaleSlots(db: AnyDb, opts: { now?: Date; demoMode?: boolean; force?: boolean } = {}): Promise<EnsureResult> {
  const demoMode = opts.demoMode ?? process.env.DEMO_MODE === "true";
  if (!demoMode) return { created: 0, skipped: true };
  const now = opts.now ?? clockNow();
  const p = toWibParts(now);
  const dayKey = `${p.year}-${p.month}-${p.day}`;
  if (!opts.force && ensuredForDay === dayKey) return { created: 0, skipped: true };

  const created = await db.transaction(async (tx) => {
    // Serialisasi antar request bersamaan tanpa constraint baru di skema.
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
    const planned = planFlashSlots(now);
    const horizonStart = planned[0].startsAt;
    const existing = await tx
      .select({ id: schema.flashSales.id, name: schema.flashSales.name, startsAt: schema.flashSales.startsAt, endsAt: schema.flashSales.endsAt, source: schema.flashSales.source, isActive: schema.flashSales.isActive })
      .from(schema.flashSales)
      .where(gte(schema.flashSales.endsAt, horizonStart));
    const missing = missingFlashSlots(planned, existing);
    if (missing.length === 0) return 0;

    for (const slot of missing) {
      const [sale] = await tx
        .insert(schema.flashSales)
        .values({ name: slot.name, startsAt: slot.startsAt, endsAt: slot.endsAt, isActive: true, source: "otomatis" })
        .returning({ id: schema.flashSales.id });
      const items = await patternItems(tx, slot.name);
      if (items.length) await tx.insert(schema.flashSaleItems).values(items.map((it) => ({ ...it, flashSaleId: sale.id, sold: 0 })));
    }
    return missing.length;
  });

  ensuredForDay = dayKey;
  return { created, skipped: false };
}

type ItemPattern = { variantId: number; flashPrice: number; quota: number; maxPerCustomer: number };

// Pola produk: salin dari slot terakhir bernama sama (slot seed), atau bila tidak ada, dari produk terlaris.
async function patternItems(tx: AnyDb, slotName: string): Promise<ItemPattern[]> {
  const candidates = await tx
    .select({ id: schema.flashSales.id })
    .from(schema.flashSales)
    .where(and(eq(schema.flashSales.name, slotName), eq(schema.flashSales.source, "otomatis")))
    .orderBy(desc(schema.flashSales.startsAt))
    .limit(10);
  for (const c of candidates) {
    const items = await tx
      .select({
        variantId: schema.flashSaleItems.variantId,
        flashPrice: schema.flashSaleItems.flashPrice,
        quota: schema.flashSaleItems.quota,
        maxPerCustomer: schema.flashSaleItems.maxPerCustomer,
      })
      .from(schema.flashSaleItems)
      .where(eq(schema.flashSaleItems.flashSaleId, c.id));
    if (items.length) return items;
  }
  // Tidak ada slot sumber sama sekali: pakai varian pertama dari produk terlaris.
  const top = await tx
    .select({ productId: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.status, "aktif"))
    .orderBy(desc(schema.products.soldCount), asc(schema.products.name))
    .limit(6);
  if (top.length === 0) return [];
  const variants = await tx
    .select({ id: schema.variants.id, productId: schema.variants.productId, salePrice: schema.variants.salePrice, sortOrder: schema.variants.sortOrder })
    .from(schema.variants)
    .where(and(inArray(schema.variants.productId, top.map((t) => t.productId)), eq(schema.variants.isActive, true)))
    .orderBy(asc(schema.variants.sortOrder));
  const firstPerProduct = new Map<number, (typeof variants)[number]>();
  for (const v of variants) if (!firstPerProduct.has(v.productId)) firstPerProduct.set(v.productId, v);
  return [...firstPerProduct.values()].map((v) => ({ variantId: v.id, flashPrice: roundToPromo(v.salePrice * 0.78), quota: 30, maxPerCustomer: 2 }));
}
