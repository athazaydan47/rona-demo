import { describe, expect, it } from "vitest";
import { earnedPoints, netSpend } from "./index";

describe("rumus pemberian poin", () => {
  it("1 poin per Rp 1.000 belanja bersih, dibulatkan ke bawah, tanpa ongkir", () => {
    expect(earnedPoints({ subtotal: 248_000, voucherDiscount: 20_000, pointsUsed: 1_250 })).toBe(226); // 226.750
    expect(earnedPoints({ subtotal: 999, voucherDiscount: 0, pointsUsed: 0 })).toBe(0);
    expect(earnedPoints({ subtotal: 1_000, voucherDiscount: 0, pointsUsed: 0 })).toBe(1);
    expect(earnedPoints({ subtotal: 150_999, voucherDiscount: 0, pointsUsed: 0 })).toBe(150);
  });
  it("nilai bersih tidak pernah negatif", () => {
    expect(netSpend({ subtotal: 10_000, voucherDiscount: 20_000, pointsUsed: 0 })).toBe(0);
    expect(earnedPoints({ subtotal: 10_000, voucherDiscount: 20_000, pointsUsed: 5_000 })).toBe(0);
  });
});
