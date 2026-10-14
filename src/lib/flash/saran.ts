// Saran kandidat flash sale (deterministik, bukan AI). Skor: laju jual 30 hari rendah, stok online tinggi, rating
// baik, dan belum ikut flash sale 30 hari terakhir. Usulan harga flash = diskon dalam batas Pengaturan (lebih besar
// untuk yang paling lambat laku), selalu di bawah harga efektif sekarang; kuota seperempat stok online (5 sampai 20).
import { and, eq, gte } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { loadCatalogItems } from "@/lib/catalog/load-items";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import { revenueOrders, wibDayStart } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";

export const FLASH_WINDOW_DAYS = 30;
export const FLASH_MIN_STOCK = 10;

export type FlashCandidateInput = { variantId: number; productId: number; productName: string; shadeName: string; normalPrice: number; effectivePrice: number; onlineStock: number; sold30: number; rating: number; reviewCount: number; recentlyFlashed: boolean };
export type FlashSuggestion = FlashCandidateInput & { score: number; discountPercent: number; flashPrice: number; quota: number; alasan: string };

// Harga flash rapi: dibulatkan ke ribuan lalu dikurangi 100 (misal 89.900), selalu di bawah harga efektif.
export function niceFlashPrice(normal: number, effective: number, discountPercent: number) {
  let p = Math.round((normal * (1 - discountPercent / 100)) / 1000) * 1000 - 100;
  if (p >= effective) p = Math.floor((effective - 1) / 1000) * 1000 - 100;
  return Math.max(1000, p);
}

export function scoreFlash(c: FlashCandidateInput) {
  const stock = Math.min(1, c.onlineStock / 50);
  const slow = 1 - Math.min(1, c.sold30 / 20);
  const rating = c.reviewCount >= 2 ? (c.rating >= 4.5 ? 1 : c.rating >= 4 ? 0.6 : 0) : 0.3;
  return Math.round((0.4 * stock + 0.4 * slow + 0.2 * rating) * 100) / 100;
}

export function suggestFlash(list: FlashCandidateInput[], o: { minDiscount: number; maxDiscount: number; limit?: number }): FlashSuggestion[] {
  const step = (n: number) => Math.round(n / 5) * 5;
  return list
    .filter((c) => !c.recentlyFlashed && c.onlineStock >= FLASH_MIN_STOCK && !(c.reviewCount >= 2 && c.rating < 4))
    .map((c) => {
      const slow = 1 - Math.min(1, c.sold30 / 20);
      const discountPercent = Math.min(o.maxDiscount, Math.max(o.minDiscount, step(o.minDiscount + (o.maxDiscount - o.minDiscount) * slow)));
      const flashPrice = niceFlashPrice(c.normalPrice, c.effectivePrice, discountPercent);
      const quota = Math.max(5, Math.min(20, Math.floor(c.onlineStock / 4)));
      const ratingText = c.reviewCount >= 2 ? `rating ${String(c.rating).replace(".", ",")}` : "belum banyak ulasan";
      return { ...c, score: scoreFlash(c), discountPercent, flashPrice, quota, alasan: `Terjual ${c.sold30} pcs dalam 30 hari, stok online ${c.onlineStock}, ${ratingText}, belum ikut flash sale 30 hari terakhir.` };
    })
    .sort((a, b) => b.score - a.score || a.sold30 - b.sold30 || a.variantId - b.variantId)
    .slice(0, o.limit ?? 10);
}

export async function flashSuggestions(db: AnyDb, opts: { now: Date; minDiscount: number; maxDiscount: number; limit?: number }) {
  const range = { from: wibDayStart(opts.now, FLASH_WINDOW_DAYS - 1), to: wibDayStart(opts.now, -1) };
  const [items, data, recent] = await Promise.all([
    loadCatalogItems(db, { kind: "all" }, opts.now),
    loadReportData(db, range),
    db
      .select({ variantId: schema.flashSaleItems.variantId })
      .from(schema.flashSaleItems)
      .innerJoin(schema.flashSales, eq(schema.flashSaleItems.flashSaleId, schema.flashSales.id))
      .where(and(gte(schema.flashSales.startsAt, new Date(opts.now.getTime() - FLASH_WINDOW_DAYS * 86_400_000)), eq(schema.flashSales.isActive, true))),
  ]);
  const flashed = new Set(recent.map((r) => r.variantId));
  const revIds = new Set(revenueOrders(data).map((o) => o.id));
  const sold = new Map<number, number>();
  for (const i of data.items) if (revIds.has(i.orderId)) sold.set(i.variantId, (sold.get(i.variantId) ?? 0) + i.quantity);
  const list: FlashCandidateInput[] = items.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      shadeName: v.shadeName,
      normalPrice: v.normalPrice,
      effectivePrice: v.price,
      onlineStock: v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0,
      sold30: sold.get(v.id) ?? 0,
      rating: p.ratingAvg,
      reviewCount: p.reviewCount,
      recentlyFlashed: flashed.has(v.id) || v.source === "flash",
    })),
  );
  return { suggestions: suggestFlash(list, { minDiscount: opts.minDiscount, maxDiscount: opts.maxDiscount, limit: opts.limit }), windowDays: FLASH_WINDOW_DAYS };
}

// Tautan "Tambahkan ke slot": tab flash sale dengan isian item terisi (staf memilih slot lalu menyimpan sendiri).
export const flashDraftHref = (s: Pick<FlashSuggestion, "variantId" | "flashPrice" | "quota">) => `/admin/promo?tab=flash&draf=${s.variantId}:${s.flashPrice}:${s.quota}`;
