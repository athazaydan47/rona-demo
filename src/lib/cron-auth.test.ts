import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

describe("otorisasi route cron", () => {
  it("menerima header Authorization: Bearer <CRON_SECRET> seperti yang dikirim Vercel Cron", () => {
    expect(isAuthorizedCron("Bearer rahasia-panjang", "rahasia-panjang")).toBe(true);
  });
  it("menolak tanpa header, rahasia salah, atau skema lain", () => {
    expect(isAuthorizedCron(null, "rahasia-panjang")).toBe(false);
    expect(isAuthorizedCron("Bearer salah", "rahasia-panjang")).toBe(false);
    expect(isAuthorizedCron("Basic rahasia-panjang", "rahasia-panjang")).toBe(false);
  });
  it("menolak semua bila CRON_SECRET belum diisi", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer x", "")).toBe(false);
  });
});
