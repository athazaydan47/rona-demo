import { describe, expect, it } from "vitest";
import { clientIp, hashKey, limitByKey } from "./rate-limit";

describe("pembatas laju di memori", () => {
  it("menolak setelah batas dan pulih di jendela berikutnya", () => {
    const k = `uji-${Math.random()}`;
    expect([1, 2, 3].map(() => limitByKey(k, 2, 1000, 0))).toEqual([true, true, false]);
    expect(limitByKey(k, 2, 1000, 1000)).toBe(true);
  });
  it("kunci di-hash, IP diambil dari x-forwarded-for", () => {
    expect(hashKey("081234567890", "rahasia")).toMatch(/^[0-9a-f]{24}$/);
    expect(hashKey("081234567890", "rahasia")).not.toContain("0812");
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers())).toBe("lokal");
  });
});
