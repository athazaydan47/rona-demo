import { describe, expect, it } from "vitest";
import { polaDataUji } from "./data-uji";

describe("pola data uji", () => {
  it("menangkap nama uji tanpa salah tangkap kata biasa", () => {
    for (const s of ["Flash Uji E2E", "Lip Tint Uji 8BBW6I", "UJI-8BBW6I-01", "SJ-UJI-1700000000", "Pembeli Uji", "test", "Voucher uji E2E", "Playwright"]) expect(polaDataUji.test(s), s).toBe(true);
    for (const s of ["Teruji klinis", "Lumi Velvet Matte Lipstick", "Tester gratis", "Pengujian", "Rona Dinoyo"]) expect(polaDataUji.test(s), s).toBe(false);
  });
});
