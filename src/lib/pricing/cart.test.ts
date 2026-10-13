import { describe, expect, it } from "vitest";
import { wibDate } from "@/lib/format";
import { allowedFlashUnits, FREE_SHIPPING_THRESHOLD, priceCart, priceLine, type FlashInput, type PricingLineInput, type VoucherInput } from "./cart";

const NOW = wibDate(2026, 10, 14, 12, 30); // di tengah slot flash 12.00 sampai 14.00

const line = (over: Partial<PricingLineInput> = {}): PricingLineInput => ({
  variantId: 1,
  productId: 10,
  brandId: 100,
  categoryId: 1000,
  parentCategoryId: 900,
  quantity: 1,
  weightGram: 100,
  normalPrice: 100_000,
  salePrice: 100_000,
  ...over,
});

const flash = (over: Partial<FlashInput> = {}): FlashInput => ({
  flashSaleItemId: 77,
  flashPrice: 70_000,
  quota: 30,
  sold: 10,
  maxPerCustomer: 2,
  boughtByBuyer: 0,
  startsAt: wibDate(2026, 10, 14, 12, 0),
  endsAt: wibDate(2026, 10, 14, 14, 0),
  ...over,
});

const voucher = (over: Partial<VoucherInput> = {}): VoucherInput => ({
  code: "HEMAT",
  type: "nominal",
  value: 20_000,
  maxDiscount: null,
  minSpend: 0,
  startsAt: wibDate(2026, 10, 1),
  endsAt: wibDate(2026, 12, 31),
  quota: 100,
  used: 0,
  quotaPerCustomer: 1,
  usedByBuyer: 0,
  scope: {},
  stackWithFlash: true,
  isActive: true,
  ...over,
});

describe("harga per baris", () => {
  it("1. memakai harga jual bila tanpa promo dan flash", () => {
    const l = priceLine(line({ normalPrice: 120_000, salePrice: 100_000, quantity: 2 }), NOW);
    expect(l.segments).toEqual([{ quantity: 2, unitPrice: 100_000, source: "normal", flashSaleItemId: null }]);
    expect(l.lineTotal).toBe(200_000);
    expect(l.lineDiscount).toBe(40_000);
  });
  it("2. memakai harga promo di dalam periode", () => {
    const l = priceLine(line({ promoPrice: 88_000, promoStartsAt: wibDate(2026, 10, 1), promoEndsAt: wibDate(2026, 10, 30) }), NOW);
    expect(l.segments[0]).toMatchObject({ unitPrice: 88_000, source: "promo" });
  });
  it("3. mendahulukan flash sale di atas promo", () => {
    const l = priceLine(line({ promoPrice: 88_000, promoStartsAt: wibDate(2026, 10, 1), promoEndsAt: wibDate(2026, 10, 30), flash: flash() }), NOW);
    expect(l.segments[0]).toMatchObject({ unitPrice: 70_000, source: "flash", flashSaleItemId: 77 });
  });
  it("4. flash sale berakhir di tengah checkout: harga kembali normal", () => {
    const before = priceCart({ lines: [line({ flash: flash() })], now: NOW });
    const after = priceCart({ lines: [line({ flash: flash() })], now: wibDate(2026, 10, 14, 14, 0) });
    expect(before.total).toBe(70_000);
    expect(after.total).toBe(100_000);
    expect(after.lines[0].hasFlash).toBe(false);
  });
  it("5. batas beli flash per pembeli: unit berlebih memakai harga biasa", () => {
    const l = priceLine(line({ quantity: 3, flash: flash({ maxPerCustomer: 2 }) }), NOW);
    expect(l.segments).toEqual([
      { quantity: 2, unitPrice: 70_000, source: "flash", flashSaleItemId: 77 },
      { quantity: 1, unitPrice: 100_000, source: "normal", flashSaleItemId: null },
    ]);
    expect(l.flashLimited).toBe(true);
    expect(l.lineTotal).toBe(240_000);
  });
  it("6. batas per pembeli memperhitungkan pembelian sebelumnya di slot yang sama", () => {
    expect(allowedFlashUnits(flash({ maxPerCustomer: 2, boughtByBuyer: 2 }), 1)).toBe(0);
    expect(allowedFlashUnits(flash({ maxPerCustomer: 2, boughtByBuyer: 1 }), 5)).toBe(1);
  });
  it("7. kuota slot flash membatasi unit", () => {
    expect(allowedFlashUnits(flash({ quota: 30, sold: 29, maxPerCustomer: 5 }), 3)).toBe(1);
    const l = priceLine(line({ quantity: 1, flash: flash({ quota: 30, sold: 30 }) }), NOW);
    expect(l.segments[0].source).toBe("normal");
  });
});

describe("voucher", () => {
  const two = [line({ variantId: 1, quantity: 1 }), line({ variantId: 2, quantity: 1, brandId: 200, categoryId: 2000, parentCategoryId: 901 })];

  it("8. voucher nominal memotong subtotal", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "hemat", voucher: voucher() });
    expect(r.voucher?.applied).toBe(true);
    expect(r.voucherDiscount).toBe(20_000);
    expect(r.total).toBe(180_000);
  });
  it("9. voucher persen dengan batas maksimal", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "P", voucher: voucher({ type: "persen", value: 15, maxDiscount: 25_000 }) });
    expect(r.voucherDiscount).toBe(25_000); // 15% dari 200.000 = 30.000, dibatasi 25.000
  });
  it("10. voucher persen dibulatkan ke bawah", () => {
    const r = priceCart({ lines: [line({ salePrice: 99_999, normalPrice: 99_999 })], now: NOW, voucherCode: "P", voucher: voucher({ type: "persen", value: 15, maxDiscount: null }) });
    expect(r.voucherDiscount).toBe(14_999);
  });
  it("11. kode tidak ditemukan", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "NGAWUR", voucher: null });
    expect(r.voucher).toMatchObject({ applied: false, reason: "tidak_ditemukan" });
    expect(r.voucherDiscount).toBe(0);
  });
  it("12. voucher kedaluwarsa dan belum mulai", () => {
    expect(priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ endsAt: wibDate(2026, 10, 1) }) }).voucher?.reason).toBe("kedaluwarsa");
    expect(priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ startsAt: wibDate(2026, 11, 1) }) }).voucher?.reason).toBe("belum_mulai");
    expect(priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ isActive: false }) }).voucher?.reason).toBe("nonaktif");
  });
  it("13. kuota voucher habis", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ quota: 10, used: 10 }) });
    expect(r.voucher).toMatchObject({ applied: false, reason: "kuota_habis", message: "Kuota voucher ini sudah habis." });
  });
  it("14. kuota voucher per pembeli", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ quotaPerCustomer: 2, usedByBuyer: 2 }) });
    expect(r.voucher?.reason).toBe("kuota_pembeli_habis");
    expect(priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ quotaPerCustomer: 2, usedByBuyer: 1 }) }).voucher?.applied).toBe(true);
  });
  it("15. minimal belanja dengan pesan kekurangan", () => {
    const r = priceCart({ lines: [line()], now: NOW, voucherCode: "X", voucher: voucher({ minSpend: 150_000 }) });
    expect(r.voucher?.reason).toBe("minimal_belanja");
    expect(r.voucher?.message).toContain("Rp 50.000");
  });
  it("16. voucher yang tidak boleh digabung flash sale", () => {
    const r = priceCart({ lines: [line({ flash: flash() })], now: NOW, voucherCode: "X", voucher: voucher({ stackWithFlash: false }) });
    expect(r.voucher).toMatchObject({ applied: false, reason: "tidak_bisa_flash" });
    expect(priceCart({ lines: [line({ flash: flash() })], now: NOW, voucherCode: "X", voucher: voucher({ stackWithFlash: true }) }).voucher?.applied).toBe(true);
  });
  it("17. voucher cakupan merek hanya menghitung baris merek itu", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "LUMI10", voucher: voucher({ type: "persen", value: 10, maxDiscount: 15_000, scope: { brandIds: [200] } }) });
    expect(r.voucher?.eligibleSubtotal).toBe(100_000);
    expect(r.voucherDiscount).toBe(10_000);
  });
  it("18. voucher cakupan kategori induk berlaku untuk sub kategorinya", () => {
    const r = priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ scope: { categoryIds: [900] } }) });
    expect(r.voucher?.eligibleSubtotal).toBe(100_000);
    const none = priceCart({ lines: two, now: NOW, voucherCode: "X", voucher: voucher({ scope: { brandIds: [999] } }) });
    expect(none.voucher?.reason).toBe("tidak_berlaku_produk");
  });
  it("19. voucher nominal tidak melebihi subtotal yang memenuhi syarat", () => {
    const r = priceCart({ lines: [line({ salePrice: 15_000, normalPrice: 15_000 })], now: NOW, voucherCode: "X", voucher: voucher({ value: 20_000 }) });
    expect(r.voucherDiscount).toBe(15_000);
    expect(r.total).toBe(0);
  });
});

describe("ongkir dan gratis ongkir otomatis", () => {
  const ship = { method: "kirim" as const, courierCode: "jne_reg" as const, zone: "jatim" as const };

  it("20. gratis ongkir otomatis tepat di batas Rp 150.000", () => {
    const r = priceCart({ lines: [line({ salePrice: 150_000, normalPrice: 150_000 })], now: NOW, shipping: ship });
    expect(r.freeShipping.qualifies).toBe(true);
    expect(r.shipping).toMatchObject({ cost: 13_000, autoFreeDiscount: 13_000, payable: 0 });
    expect(r.total).toBe(150_000);
  });
  it("21. satu rupiah di bawah batas tidak mendapat gratis ongkir, dan sisa kekurangan dilaporkan", () => {
    const r = priceCart({ lines: [line({ salePrice: 149_999, normalPrice: 149_999 })], now: NOW, shipping: ship });
    expect(r.freeShipping).toMatchObject({ qualifies: false, remaining: 1 });
    expect(r.shipping?.autoFreeDiscount).toBe(0);
  });
  it("22. batas gratis ongkir dihitung setelah voucher", () => {
    const r = priceCart({ lines: [line({ salePrice: 160_000, normalPrice: 160_000 })], now: NOW, voucherCode: "X", voucher: voucher({ value: 20_000 }), shipping: ship });
    expect(r.afterVoucher).toBe(140_000);
    expect(r.shipping?.autoFreeDiscount).toBe(0);
    expect(r.freeShipping.remaining).toBe(FREE_SHIPPING_THRESHOLD - 140_000);
  });
  it("23. potongan gratis ongkir maksimal Rp 20.000", () => {
    const r = priceCart({ lines: [line({ salePrice: 200_000, normalPrice: 200_000, weightGram: 1500 })], now: NOW, shipping: { method: "kirim", courierCode: "jne_reg", zone: "luar_jawa" } });
    expect(r.shipping).toMatchObject({ billableKg: 2, cost: 68_000, autoFreeDiscount: 20_000, payable: 48_000 });
  });
  it("24. gratis ongkir tidak berlaku untuk kurir instan", () => {
    const r = priceCart({ lines: [line({ salePrice: 200_000, normalPrice: 200_000 })], now: NOW, shipping: { method: "kirim", courierCode: "instan", zone: "dalam_kota" } });
    expect(r.shipping).toMatchObject({ cost: 15_000, autoFreeDiscount: 0, payable: 15_000 });
  });
  it("25. ambil di toko tanpa ongkir dan voucher ongkir ditolak", () => {
    const r = priceCart({ lines: [line()], now: NOW, shipping: { method: "ambil" }, voucherCode: "ONGKIR", voucher: voucher({ type: "ongkir", value: 20_000, maxDiscount: 20_000 }) });
    expect(r.shipping).toMatchObject({ method: "ambil", cost: 0, payable: 0 });
    expect(r.voucher?.reason).toBe("hanya_kirim");
  });
  it("26. voucher ongkir menutup sisa ongkir setelah gratis ongkir otomatis", () => {
    const r = priceCart({
      lines: [line({ salePrice: 200_000, normalPrice: 200_000, weightGram: 1500 })],
      now: NOW,
      shipping: { method: "kirim", courierCode: "jne_reg", zone: "luar_jawa" },
      voucherCode: "ONGKIR",
      voucher: voucher({ type: "ongkir", value: 20_000, maxDiscount: 20_000 }),
    });
    expect(r.shipping).toMatchObject({ cost: 68_000, autoFreeDiscount: 20_000, voucherDiscount: 20_000, payable: 28_000 });
    expect(r.voucher?.shippingDiscount).toBe(20_000);
  });
});

describe("poin dan total", () => {
  it("27. poin dibatasi 50% subtotal setelah voucher dan saldo", () => {
    const r = priceCart({ lines: [line()], now: NOW, voucherCode: "X", voucher: voucher({ value: 20_000 }), points: { requested: 100_000, balance: 1_000_000 } });
    expect(r.points).toEqual({ requested: 100_000, used: 40_000, cap: 40_000 });
    expect(r.total).toBe(40_000);
    expect(priceCart({ lines: [line()], now: NOW, points: { requested: 30_000, balance: 5_000 } }).points.used).toBe(5_000);
  });
  it("28. total tidak pernah negatif dan semua angka bilangan bulat", () => {
    const r = priceCart({ lines: [line({ salePrice: 10_001, normalPrice: 10_001 })], now: NOW, voucherCode: "X", voucher: voucher({ type: "persen", value: 33, maxDiscount: null }), points: { requested: 99_999, balance: 99_999 } });
    expect(r.total).toBeGreaterThanOrEqual(0);
    for (const n of [r.subtotal, r.voucherDiscount, r.points.used, r.total]) expect(Number.isInteger(n)).toBe(true);
    expect(r.voucherDiscount).toBe(3_300);
  });
  it("29. keranjang kosong menghasilkan nol", () => {
    const r = priceCart({ lines: [], now: NOW, shipping: { method: "ambil" } });
    expect(r).toMatchObject({ subtotal: 0, total: 0, itemCount: 0 });
  });
});
