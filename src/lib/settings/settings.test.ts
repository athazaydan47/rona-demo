// Pengaturan toko mengubah hasil logika: cut-off, gratis ongkir, tarif, jam kurir instan, hari libur cabang.
import { describe, expect, it } from "vitest";
import { validateSettings } from "@/lib/admin/settings";
import { wibDate } from "@/lib/format";
import { priceCart, type PricingLineInput } from "@/lib/pricing/cart";
import { locationFlags } from "@/lib/product/availability";
import { instantAvailability, quoteShipping } from "@/lib/shipping";
import { DEFAULT_SETTINGS, normalizeSettings, pricingRules, settingsRows, type StoreSettings } from "./index";

const line: PricingLineInput = { variantId: 1, productId: 1, brandId: 1, categoryId: 1, parentCategoryId: null, quantity: 1, weightGram: 100, normalPrice: 120_000, salePrice: 120_000 };
const ship = { method: "kirim" as const, courierCode: "jne_reg" as const, zone: "jatim" as const };
const NOW = wibDate(2026, 10, 14, 10, 0); // Rabu
const HOURS = { open: "09.00", close: "21.00" };
const WEEK = { sen: HOURS, sel: HOURS, rab: HOURS, kam: HOURS, jum: HOURS, sab: HOURS, min: HOURS };
const withS = (patch: (s: StoreSettings) => void) => {
  const s = structuredClone(DEFAULT_SETTINGS);
  patch(s);
  return s;
};

describe("nilai bawaan tidak berubah", () => {
  it("normalisasi dari tabel kosong sama dengan nilai bawaan, dan bolak-balik settingsRows stabil", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(settingsRows(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
  });
  it("kunci lama Fase 1 tetap terbaca", () => {
    const s = normalizeSettings({ "toko.cutoff": { kirim: "14.00", ambil: "17.00", liburMinggu: false }, "toko.profil": { nama: "Rona Lama" } });
    expect(s.cutoff).toEqual({ ship: "14.00", pickup: "17.00", sundayOff: false });
    expect(s.profile.name).toBe("Rona Lama");
  });
  it("nilai bawaan lolos validasi, nilai salah ditolak", () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toBeNull();
    expect(validateSettings(withS((s) => (s.cutoff.ship = "25.00")))).toMatch(/Cut-off/);
    expect(validateSettings(withS((s) => (s.payments = [])))).toMatch(/metode bayar/);
    expect(validateSettings(withS((s) => (s.instant = { open: 18, close: 9 })))).toMatch(/instan/);
    expect(validateSettings(withS((s) => (s.profile.whatsapp = "081234")))).toMatch(/WA/);
  });
});

describe("gratis ongkir mengikuti pengaturan", () => {
  it("batas Rp 150.000 bawaan: belanja Rp 120.000 belum gratis ongkir", () => {
    const r = priceCart({ lines: [line], now: NOW, shipping: ship, rules: pricingRules(DEFAULT_SETTINGS) });
    expect(r.freeShipping).toMatchObject({ threshold: 150_000, qualifies: false, remaining: 30_000 });
  });
  it("batas diturunkan ke Rp 100.000: belanja yang sama langsung gratis ongkir", () => {
    const r = priceCart({ lines: [line], now: NOW, shipping: ship, rules: pricingRules(withS((s) => (s.freeShipping.threshold = 100_000))) });
    expect(r.freeShipping).toMatchObject({ threshold: 100_000, qualifies: true, remaining: 0 });
    expect(r.shipping?.payable).toBe(0);
  });
  it("nilai gratis ongkir (cap) dan tarif per zona dibaca dari pengaturan", () => {
    const s = withS((x) => {
      x.freeShipping = { threshold: 100_000, cap: 5_000 };
      x.couriers.rates.jne_reg.jatim = 11_000;
    });
    const r = priceCart({ lines: [line], now: NOW, shipping: ship, rules: pricingRules(s) });
    expect(r.shipping).toMatchObject({ cost: 11_000, autoFreeDiscount: 5_000, payable: 6_000 });
  });
  it("kurir nonaktif tidak muncul di pilihan ongkir", () => {
    const all = quoteShipping({ totalGram: 200, citySlug: "surabaya", rates: DEFAULT_SETTINGS.couriers.rates, active: DEFAULT_SETTINGS.couriers.active });
    const fewer = quoteShipping({ totalGram: 200, citySlug: "surabaya", rates: DEFAULT_SETTINGS.couriers.rates, active: ["jne_reg"] });
    expect(all.length).toBeGreaterThan(1);
    expect(fewer.map((q) => q.code)).toEqual(["jne_reg"]);
  });
});

describe("cut-off dan jam mengikuti pengaturan", () => {
  const gudang = { type: "gudang" as const, openingHours: null };
  const toko = { type: "toko" as const, openingHours: WEEK };
  it("cut-off kirim 15.00: pesanan 14.30 dikirim hari ini; cut-off dimajukan ke 14.00: tidak lagi", () => {
    const at = wibDate(2026, 10, 14, 14, 30);
    expect(locationFlags(gudang, at, DEFAULT_SETTINGS.cutoff).shipsToday).toBe(true);
    expect(locationFlags(gudang, at, { ...DEFAULT_SETTINGS.cutoff, ship: "14.00" }).shipsToday).toBe(false);
  });
  it("cut-off ambil bisa dimundurkan", () => {
    const at = wibDate(2026, 10, 14, 16, 30);
    expect(locationFlags(toko, at, DEFAULT_SETTINGS.cutoff).pickupToday).toBe(false);
    expect(locationFlags(toko, at, { ...DEFAULT_SETTINGS.cutoff, pickup: "18.00" }).pickupToday).toBe(true);
  });
  it("Minggu libur gudang bisa dimatikan", () => {
    const sunday = wibDate(2026, 10, 18, 10);
    expect(locationFlags(gudang, sunday, DEFAULT_SETTINGS.cutoff).shipsToday).toBe(false);
    expect(locationFlags(gudang, sunday, { ...DEFAULT_SETTINGS.cutoff, sundayOff: false }).shipsToday).toBe(true);
  });
  it("hari libur cabang membuat cabang tutup", () => {
    expect(locationFlags(toko, NOW).openNow).toBe(true);
    expect(locationFlags({ ...toko, closedDates: ["2026-10-14"] }, NOW).openNow).toBe(false);
  });
  it("jam kurir instan mengikuti pengaturan", () => {
    const at = wibDate(2026, 10, 14, 18, 0);
    expect(instantAvailability(at, DEFAULT_SETTINGS.instant).available).toBe(false);
    expect(instantAvailability(at, { open: 8, close: 20 }).available).toBe(true);
  });
});
