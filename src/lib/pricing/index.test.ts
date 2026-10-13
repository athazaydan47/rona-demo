import { describe, expect, it } from "vitest";
import { discountPercent, effectivePrice, maxPurchasable, roundToPromo } from "./index";

describe("discountPercent", () => {
  it("membulatkan ke bawah", () => {
    expect(discountPercent(100000, 85000)).toBe(15);
    expect(discountPercent(129000, 99000)).toBe(23); // 23,25 dibulatkan ke bawah
    expect(discountPercent(100000, 100000)).toBe(0);
    expect(discountPercent(0, 10)).toBe(0);
  });
});

describe("roundToPromo", () => {
  it("membulatkan ke Rp 500", () => {
    expect(roundToPromo(99249)).toBe(99000);
    expect(roundToPromo(99250)).toBe(99500);
    expect(roundToPromo(99750)).toBe(100000);
  });
});

describe("effectivePrice", () => {
  const base = { normalPrice: 150000, salePrice: 129000 };
  const now = new Date("2026-10-13T07:00:00.000Z");
  it("memakai harga jual bila tidak ada promo", () => {
    expect(effectivePrice(base, now)).toEqual({
      price: 129000,
      normalPrice: 150000,
      source: "normal",
      percent: 14,
    });
  });
  it("mendahulukan flash sale", () => {
    const r = effectivePrice({ ...base, promoPrice: 110000, flashPrice: 99000 }, now);
    expect(r.source).toBe("flash");
    expect(r.price).toBe(99000);
    expect(r.percent).toBe(34);
  });
  it("memakai promo hanya di dalam periode", () => {
    const inside = effectivePrice(
      {
        ...base,
        promoPrice: 110000,
        promoStartsAt: new Date("2026-10-01T00:00:00Z"),
        promoEndsAt: new Date("2026-10-31T00:00:00Z"),
      },
      now,
    );
    expect(inside.source).toBe("promo");
    const expired = effectivePrice(
      {
        ...base,
        promoPrice: 110000,
        promoStartsAt: new Date("2026-09-01T00:00:00Z"),
        promoEndsAt: new Date("2026-09-30T00:00:00Z"),
      },
      now,
    );
    expect(expired.source).toBe("normal");
  });
  it("mengabaikan flash atau promo yang tidak lebih murah", () => {
    expect(effectivePrice({ ...base, flashPrice: 135000 }, now).source).toBe("normal");
  });
});

describe("maxPurchasable", () => {
  it("dibatasi stok tersedia dan batas 10 per transaksi", () => {
    expect(maxPurchasable({ available: 3 })).toBe(3);
    expect(maxPurchasable({ available: 40 })).toBe(10);
    expect(maxPurchasable({ available: 0 })).toBe(0);
  });
  it("saat flash sale dibatasi per pembeli dan sisa kuota", () => {
    expect(maxPurchasable({ available: 9, isFlash: true, maxPerCustomer: 2, quotaLeft: 12 })).toBe(2);
    expect(maxPurchasable({ available: 9, isFlash: true, maxPerCustomer: 5, quotaLeft: 1 })).toBe(1);
    expect(maxPurchasable({ available: 9, isFlash: false, maxPerCustomer: 2, quotaLeft: 0 })).toBe(9);
  });
});
