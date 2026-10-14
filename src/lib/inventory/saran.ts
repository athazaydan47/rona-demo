// Saran transfer stok (deterministik, bukan AI). Untuk tiap varian dihitung laju jual 14 hari per lokasi (dari
// pesanan omzet di src/lib/reports) dan hari-cukup-stok. Bila sebuah cabang akan habis dalam kurangHari sementara
// lokasi lain punya kelebihan di atas lebihHari, diusulkan jumlah transfer yang wajar: cukup untuk 2 x kurangHari di
// tujuan, dibulatkan, dan tidak membuat lokasi asal kekurangan (asal tetap menyimpan stok untuk lebihHari dan
// minimal ambang stok menipis). Hanya membaca; transfernya tetap dibuat staf lewat formulir transfer yang ada.
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { revenueOrders, wibDayStart } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";

export const SALES_WINDOW_DAYS = 14;
export const MIN_SOLD = 2;

export type StockCell = { variantId: number; locationId: number; available: number; sold: number };
export type SaranLocation = { id: number; name: string; type: string };
export type VariantInfo = { variantId: number; productName: string; shadeName: string; sku: string };
export type TransferSuggestion = {
  variantId: number;
  productName: string;
  shadeName: string;
  sku: string;
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  quantity: number;
  toAvailable: number;
  toPerDay: number;
  toDaysLeft: number;
  fromAvailable: number;
  fromPerDay: number;
  fromDaysLeft: number | null; // null = tidak ada penjualan (tak terbatas)
  alasan: string;
};

export type TransferOptions = { kurangHari: number; lebihHari: number; keepMin: number; windowDays?: number };

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(round1(n)).replace(".", ",");

// Jumlah transfer yang wajar: kelipatan 5 bila 10 atau lebih, selalu dalam batas kelebihan asal.
export function niceQuantity(need: number, surplus: number) {
  const q = Math.min(need, surplus);
  if (q < 1) return 0;
  return q >= 10 ? Math.max(5, Math.floor(q / 5) * 5) : q;
}

export function suggestTransfers(cells: StockCell[], locations: SaranLocation[], variants: Map<number, VariantInfo>, o: TransferOptions): TransferSuggestion[] {
  const window = o.windowDays ?? SALES_WINDOW_DAYS;
  const byVariant = new Map<number, StockCell[]>();
  for (const c of cells) byVariant.set(c.variantId, [...(byVariant.get(c.variantId) ?? []), c]);
  const loc = new Map(locations.map((l) => [l.id, l]));
  const out: TransferSuggestion[] = [];
  for (const [variantId, list] of byVariant) {
    const v = variants.get(variantId);
    if (!v) continue;
    const stats = list.map((c) => {
      const perDay = c.sold / window;
      return { ...c, perDay, daysLeft: perDay > 0 ? c.available / perDay : Infinity };
    });
    for (const dest of stats) {
      const destLoc = loc.get(dest.locationId);
      // Minimal 2 unit terjual dalam jendela supaya satu penjualan kebetulan tidak memicu transfer.
      if (!destLoc || destLoc.type !== "toko" || dest.sold < MIN_SOLD || dest.daysLeft >= o.kurangHari) continue;
      const need = Math.ceil(dest.perDay * o.kurangHari * 2) - dest.available;
      if (need < 1) continue;
      const donors = stats
        .filter((s) => s.locationId !== dest.locationId && loc.has(s.locationId) && s.daysLeft > o.lebihHari)
        .map((s) => ({ ...s, surplus: s.available - Math.max(Math.ceil(s.perDay * o.lebihHari), o.keepMin) }))
        .filter((s) => s.surplus >= 1)
        .sort((a, b) => Number(loc.get(b.locationId)!.type === "gudang") - Number(loc.get(a.locationId)!.type === "gudang") || b.surplus - a.surplus || a.locationId - b.locationId);
      const donor = donors[0];
      if (!donor) continue;
      const quantity = niceQuantity(need, donor.surplus);
      if (quantity < 1) continue;
      const fromName = loc.get(donor.locationId)!.name;
      const fromDaysLeft = Number.isFinite(donor.daysLeft) ? Math.floor(donor.daysLeft) : null;
      out.push({
        ...v,
        fromId: donor.locationId,
        fromName,
        toId: dest.locationId,
        toName: destLoc.name,
        quantity,
        toAvailable: dest.available,
        toPerDay: round1(dest.perDay),
        toDaysLeft: Math.floor(dest.daysLeft),
        fromAvailable: donor.available,
        fromPerDay: round1(donor.perDay),
        fromDaysLeft,
        alasan: `${destLoc.name} ${dest.available ? `tersisa ${dest.available} pcs dan laku ${fmt(dest.perDay)} per hari, habis dalam sekitar ${Math.floor(dest.daysLeft)} hari` : `sudah habis, padahal laku ${fmt(dest.perDay)} per hari`}. ${fromName} punya ${donor.available} pcs (${fromDaysLeft == null ? "tanpa penjualan 14 hari terakhir" : `cukup ${fromDaysLeft} hari`}).`,
      });
    }
  }
  return out.sort((a, b) => a.toDaysLeft - b.toDaysLeft || b.toPerDay - a.toPerDay || a.variantId - b.variantId);
}

// Data dari database: stok tersedia per lokasi dan unit terjual 14 hari (pesanan omzet, per lokasi pesanan).
export async function transferSuggestions(db: AnyDb, opts: { now: Date; kurangHari: number; lebihHari: number; keepMin: number; locationIds?: number[] | null; limit?: number }) {
  const locations = await db.select({ id: schema.locations.id, name: schema.locations.name, type: schema.locations.type }).from(schema.locations).where(eq(schema.locations.isActive, true));
  const range = { from: wibDayStart(opts.now, SALES_WINDOW_DAYS - 1), to: wibDayStart(opts.now, -1) };
  const data = await loadReportData(db, range);
  const orderLoc = new Map(revenueOrders(data).map((o) => [o.id, o.locationId]));
  const sold = new Map<string, number>();
  for (const i of data.items) {
    const l = orderLoc.get(i.orderId);
    if (l == null) continue;
    sold.set(`${i.variantId}:${l}`, (sold.get(`${i.variantId}:${l}`) ?? 0) + i.quantity);
  }
  const inv = await db
    .select({ variantId: schema.inventory.variantId, locationId: schema.inventory.locationId, onHand: schema.inventory.onHand, reserved: schema.inventory.reserved, productName: schema.products.name, shadeName: schema.variants.shadeName, sku: schema.variants.sku })
    .from(schema.inventory)
    .innerJoin(schema.variants, eq(schema.inventory.variantId, schema.variants.id))
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(and(eq(schema.variants.isActive, true), eq(schema.products.status, "aktif"), inArray(schema.inventory.locationId, locations.map((l) => l.id))));
  const variants = new Map(inv.map((r) => [r.variantId, { variantId: r.variantId, productName: r.productName, shadeName: r.shadeName, sku: r.sku }]));
  const cells = inv.map((r) => ({ variantId: r.variantId, locationId: r.locationId, available: Math.max(0, r.onHand - r.reserved), sold: sold.get(`${r.variantId}:${r.locationId}`) ?? 0 }));
  let list = suggestTransfers(cells, locations, variants, opts);
  if (opts.locationIds) list = list.filter((s) => opts.locationIds!.includes(s.toId) || opts.locationIds!.includes(s.fromId));
  return { suggestions: list.slice(0, opts.limit ?? 20), total: list.length, windowDays: SALES_WINDOW_DAYS, kurangHari: opts.kurangHari, lebihHari: opts.lebihHari };
}

// Tautan draf transfer: formulir transfer yang sudah terisi (staf memeriksa lalu menyimpan sendiri).
export function transferDraftHref(s: Pick<TransferSuggestion, "fromId" | "toId" | "variantId" | "quantity">[]) {
  if (!s.length) return "/admin/stok/transfer";
  const first = s[0];
  const same = s.filter((x) => x.fromId === first.fromId && x.toId === first.toId);
  return `/admin/stok/transfer?dari=${first.fromId}&ke=${first.toId}&draf=${same.map((x) => `${x.variantId}:${x.quantity}`).join(",")}`;
}
