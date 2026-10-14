// Generator riwayat penjualan 90 hari: deterministik, pola harian realistis, dan buku stok serta poin konsisten.
import { describe, expect, it } from "vitest";
import { toWibParts, wibDate } from "@/lib/format";
import { generateHistory, HISTORY_DAYS, type HistoryInput } from "./history";
import { createRng } from "./random";

const HOURS = { open: "09.00", close: "21.00" };
const WEEK = { sen: HOURS, sel: HOURS, rab: HOURS, kam: HOURS, jum: HOURS, sab: HOURS, min: HOURS };

function fixture(now = wibDate(2026, 10, 13, 14, 30)): HistoryInput {
  const variants = Array.from({ length: 24 }, (_, i) => {
    const price = [49_000, 89_000, 129_000, 189_000, 249_000, 72_000][i % 6];
    return {
      id: 100 + i,
      productId: 10 + Math.floor(i / 3),
      brandId: 1 + (i % 4),
      categoryId: 20 + (i % 5),
      parentCategoryId: 2 + (i % 2),
      productName: `Produk ${Math.floor(i / 3)}`,
      shadeName: `Shade ${i}`,
      brandName: `Merek ${i % 4}`,
      weightGram: 80 + (i % 4) * 40,
      normalPrice: price,
      salePrice: i % 5 === 0 ? price - 10_000 : price,
      promoPrice: null,
      promoStartsAt: null,
      promoEndsAt: null,
      popularity: 24 - i,
    };
  });
  const locations = [
    { id: 1, slug: "gudang-online", type: "gudang" as const, name: "Gudang Online", openingHours: null },
    { id: 2, slug: "dinoyo", type: "toko" as const, name: "Rona Dinoyo", openingHours: WEEK },
    { id: 3, slug: "soekarno-hatta", type: "toko" as const, name: "Rona Soekarno-Hatta", openingHours: WEEK },
    { id: 4, slug: "sawojajar", type: "toko" as const, name: "Rona Sawojajar", openingHours: WEEK },
  ];
  const finalStock = new Map<string, number>();
  for (const v of variants) for (const l of locations) finalStock.set(`${v.id}:${l.id}`, l.type === "gudang" ? 60 : 12);
  return {
    now,
    variants,
    locations,
    vouchers: [
      { id: 1, code: "RONAHEMAT", type: "nominal", value: 15_000, maxDiscount: null, minSpend: 100_000, startsAt: new Date(now.getTime() - 120 * 86_400_000), endsAt: new Date(now.getTime() + 30 * 86_400_000), quota: null, quotaPerCustomer: 50, scope: {}, stackWithFlash: true, isActive: true },
      { id: 2, code: "ONGKIRYUK", type: "ongkir", value: 10_000, maxDiscount: null, minSpend: 50_000, startsAt: new Date(now.getTime() - 120 * 86_400_000), endsAt: new Date(now.getTime() + 30 * 86_400_000), quota: null, quotaPerCustomer: 50, scope: {}, stackWithFlash: true, isActive: true },
    ],
    flashPool: variants.slice(0, 12).map((v) => v.id),
    finalStock,
    flashSlotsToday: 0,
  };
}

const out = generateHistory(fixture(), createRng(4242));
const dayKey = (d: Date) => {
  const p = toWibParts(d);
  return `${p.year}-${p.month}-${p.day}`;
};

describe("generateHistory: deterministik", () => {
  it("input dan seed sama menghasilkan riwayat yang identik", () => {
    const again = generateHistory(fixture(), createRng(4242));
    expect(JSON.stringify(again.orders)).toBe(JSON.stringify(out.orders));
    expect(JSON.stringify(again.movements)).toBe(JSON.stringify(out.movements));
    expect(JSON.stringify(again.ledger)).toBe(JSON.stringify(out.ledger));
    expect(JSON.stringify(again.customers)).toBe(JSON.stringify(out.customers));
  });
  it("seed berbeda menghasilkan riwayat berbeda", () => {
    const other = generateHistory(fixture(), createRng(7));
    expect(JSON.stringify(other.orders)).not.toBe(JSON.stringify(out.orders));
  });
  it("waktu relatif terhadap waktu reset: tidak ada kejadian setelah now", () => {
    const now = fixture().now.getTime();
    for (const o of out.orders) expect(o.createdAt.getTime()).toBeLessThanOrEqual(now);
    for (const m of out.movements) expect(m.createdAt.getTime()).toBeLessThanOrEqual(now);
    expect(Math.min(...out.orders.map((o) => o.createdAt.getTime()))).toBeGreaterThan(now - HISTORY_DAYS * 86_400_000 - 86_400_000);
  });
});

describe("generateHistory: pola penjualan", () => {
  const byDay = new Map<string, number>();
  for (const o of out.orders) byDay.set(dayKey(o.createdAt), (byDay.get(dayKey(o.createdAt)) ?? 0) + 1);
  const today = dayKey(fixture().now);
  const full = [...byDay.entries()].filter(([k]) => k !== today);

  it("8 sampai 25 pesanan per hari penuh (pesanan kirim tanpa ongkir bisa dilewati, jadi batas bawah sedikit longgar)", () => {
    expect(full.length).toBeGreaterThanOrEqual(HISTORY_DAYS - 1);
    for (const [, n] of full) {
      expect(n).toBeLessThanOrEqual(25);
      expect(n).toBeGreaterThanOrEqual(6);
    }
    const avg = full.reduce((s, [, n]) => s + n, 0) / full.length;
    expect(avg).toBeGreaterThan(10);
  });
  it("akhir pekan dan sekitar gajian (tanggal 25 sampai 5) lebih ramai", () => {
    const avg = (pred: (p: ReturnType<typeof toWibParts>) => boolean) => {
      const days = full.filter(([k]) => {
        const [y, m, d] = k.split("-").map(Number);
        return pred(toWibParts(wibDate(y, m, d, 12)));
      });
      return days.reduce((s, [, n]) => s + n, 0) / days.length;
    };
    expect(avg((p) => p.weekday === 0 || p.weekday === 6)).toBeGreaterThan(avg((p) => p.weekday > 0 && p.weekday < 6));
    expect(avg((p) => p.day >= 25 || p.day <= 5)).toBeGreaterThan(avg((p) => p.day > 5 && p.day < 25));
  });
  it("puncak di jam slot flash (12 sampai 14 dan 20 sampai 22), sepi dini hari", () => {
    const hours = out.orders.map((o) => toWibParts(o.createdAt).hour);
    const share = (pred: (h: number) => boolean) => hours.filter(pred).length / hours.length;
    expect(share((h) => h >= 0 && h < 6)).toBeLessThan(0.05);
    expect(share((h) => h === 12 || h === 13 || h === 20 || h === 21)).toBeGreaterThan(0.25);
  });
  it("campuran kirim dan ambil di 3 cabang, semua metode bayar, voucher, dan poin", () => {
    const ambilLocs = new Set(out.orders.filter((o) => o.method === "ambil").map((o) => o.locationId));
    expect(out.orders.some((o) => o.method === "kirim")).toBe(true);
    expect([...ambilLocs].sort()).toEqual([2, 3, 4]);
    expect(new Set(out.payments.map((p) => p.method))).toEqual(new Set(["qris", "va_bca", "va_bni", "va_bri", "va_mandiri", "bayar_di_toko"]));
    expect(out.orders.filter((o) => o.voucherCode).length).toBeGreaterThan(10);
    expect(out.orders.filter((o) => o.pointsUsed > 0).length).toBeGreaterThan(0);
    expect(out.items.some((i) => i.priceSource === "flash")).toBe(true);
  });
  it("sebagian besar selesai, ada yang batal dan diretur, dan ada pesanan aktif terbaru", () => {
    const count = (s: string) => out.orders.filter((o) => o.status === s).length;
    expect(count("selesai") / out.orders.length).toBeGreaterThan(0.75);
    expect(count("dibatalkan")).toBeGreaterThan(0);
    expect(count("diretur")).toBeGreaterThan(0);
    const active = out.orders.filter((o) => ["menunggu_pembayaran", "dibayar", "diproses", "dikirim", "siap_diambil"].includes(o.status));
    expect(active.length).toBeGreaterThan(0);
  });
  it("sekitar 150 pelanggan fiktif bernomor 0800, sebagian membeli berulang", () => {
    expect(out.customers).toHaveLength(150);
    for (const c of out.customers) expect(c.phone).toMatch(/^08001\d{7}$/);
    for (const o of out.orders.filter((x) => x.customer == null)) expect(o.guestPhone).toMatch(/^08002\d{7}$/);
    const perCustomer = new Map<number, number>();
    for (const o of out.orders) if (o.customer != null) perCustomer.set(o.customer, (perCustomer.get(o.customer) ?? 0) + 1);
    expect([...perCustomer.values()].filter((n) => n >= 3).length).toBeGreaterThan(20);
  });
});

describe("generateHistory: konsistensi", () => {
  it("total pesanan sama dengan rumus harga (subtotal dari baris, snapshot harga sama)", () => {
    for (const [idx, o] of out.orders.entries()) {
      const lines = out.items.filter((i) => i.order === idx);
      expect(lines.reduce((s, i) => s + i.unitPrice * i.quantity, 0)).toBe(o.subtotal);
      expect(o.pricing.total).toBe(o.total);
      expect(o.total).toBe(o.subtotal - o.voucherDiscount + o.shippingCost - o.shippingDiscount - o.pointsUsed);
    }
  });
  it("buku stok (masuk dan keluar) sama dengan stok fisik akhir", () => {
    const input = fixture();
    const ledger = new Map<string, number>();
    for (const m of out.movements) if (m.type === "masuk" || m.type === "keluar") ledger.set(`${m.variantId}:${m.locationId}`, (ledger.get(`${m.variantId}:${m.locationId}`) ?? 0) + m.quantity);
    for (const [key, onHand] of input.finalStock) expect(ledger.get(key) ?? 0, key).toBe(onHand);
  });
  it("saldo poin pelanggan sama dengan buku poin dan tidak pernah negatif", () => {
    for (const [i, c] of out.customers.entries()) {
      const sum = out.ledger.filter((l) => l.customer === i).reduce((s, l) => s + l.amount, 0);
      expect(c.points).toBe(sum);
      expect(c.points).toBeGreaterThanOrEqual(0);
    }
  });
  it("terjual per produk sama dengan unit dari pesanan yang pernah dibayar", () => {
    const sold = new Map<number, number>();
    const productOf = new Map(fixture().variants.map((v) => [v.id, v.productId]));
    for (const it of out.items) {
      const o = out.orders[it.order];
      if (!o.paidAt) continue;
      const p = productOf.get(it.variantId)!;
      sold.set(p, (sold.get(p) ?? 0) + it.quantity);
    }
    expect(Object.fromEntries(out.soldByProduct)).toEqual(Object.fromEntries(sold));
  });
});
