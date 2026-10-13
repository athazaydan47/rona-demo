import { describe, expect, it } from "vitest";
import { wibDate } from "@/lib/format";
import { dailyRevenue, wibDayKey, wibDayStart } from "./dashboard";
import { opnamePreview } from "./opname";

describe("agregasi omzet dashboard (hari WIB)", () => {
  const now = wibDate(2026, 10, 14, 10, 0);
  it("batas hari mengikuti WIB, bukan UTC", () => {
    expect(wibDayKey(wibDate(2026, 10, 14, 0, 5))).toBe("2026-10-14"); // 13 Okt 17.05 UTC
    expect(wibDayKey(wibDate(2026, 10, 13, 23, 59))).toBe("2026-10-13");
    expect(wibDayStart(now).toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });
  it("omzet = pesanan yang sudah dibayar, minus batal dan retur, per tanggal bayar", () => {
    const orders = [
      { total: 100_000, paidAt: wibDate(2026, 10, 14, 0, 30), status: "dibayar" }, // hari ini WIB, walau UTC masih 13 Okt
      { total: 50_000, paidAt: wibDate(2026, 10, 13, 23, 30), status: "selesai" }, // kemarin
      { total: 70_000, paidAt: wibDate(2026, 10, 14, 9, 0), status: "dibatalkan" }, // batal setelah dibayar: tidak dihitung
      { total: 30_000, paidAt: wibDate(2026, 10, 10, 9, 0), status: "diretur" },
      { total: 40_000, paidAt: null, status: "menunggu_pembayaran" },
      { total: 999_000, paidAt: wibDate(2026, 9, 1, 9, 0), status: "selesai" }, // di luar 30 hari
    ];
    const r = dailyRevenue(orders, now, 30);
    expect(r.series).toHaveLength(30);
    expect(r.series[29]).toEqual({ day: "2026-10-14", revenue: 100_000, orders: 1 });
    expect(r.series[28]).toEqual({ day: "2026-10-13", revenue: 50_000, orders: 1 });
    expect(r.series[0].day).toBe("2026-09-15");
    expect(r.today).toBe(100_000);
    expect(r.total).toBe(150_000);
    expect(r.averageOrder).toBe(75_000);
  });
});

describe("opname", () => {
  it("menghitung selisih per baris, total, dan pelanggaran batas dipesan", () => {
    const p = opnamePreview([
      { variantId: 1, onHand: 10, reserved: 2, counted: 12 },
      { variantId: 2, onHand: 10, reserved: 2, counted: 7 },
      { variantId: 3, onHand: 5, reserved: 4, counted: 3 },
      { variantId: 4, onHand: 5, reserved: 0, counted: 5 },
    ]);
    expect(p.rows.map((r) => r.diff)).toEqual([2, -3, -2, 0]);
    expect(p).toMatchObject({ totalDiff: -3, plus: 2, minus: -5, changed: 3, violations: 1 });
    expect(p.rows[2].belowReserved).toBe(true);
  });
});
