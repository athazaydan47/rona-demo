import { describe, expect, it } from "vitest";
import { bersihkan, samarkan } from "./log";

describe("log terstruktur", () => {
  it("menyamarkan nomor WA dan email, menyembunyikan kunci rahasia", () => {
    expect(samarkan("pembeli 081234567890 dan zahra@contoh.com")).toBe("pembeli 08***890 dan z***@contoh.com");
    expect(samarkan("+6281234567890")).toMatch(/\*\*\*890$/);
    expect(bersihkan({ token: "abc", phone: "081299998888", nested: { email: "a@b.co", otp: "123456" }, n: 3 })).toEqual({ token: "[disembunyikan]", phone: "08***888", nested: { email: "a***@b.co", otp: "[disembunyikan]" }, n: 3 });
  });
});
