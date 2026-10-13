import { describe, expect, it } from "vitest";
import type { OpeningHours } from "@/db/schema";
import { wibDate } from "@/lib/format";
import { fulfillmentHint, locationFlags, stockLabel } from "./availability";

const storeHours: OpeningHours = {
  sen: { open: "09.00", close: "21.00" },
  sel: { open: "09.00", close: "21.00" },
  rab: { open: "09.00", close: "21.00" },
  kam: { open: "09.00", close: "21.00" },
  jum: { open: "09.00", close: "21.00" },
  sab: { open: "09.00", close: "21.00" },
  min: { open: "09.00", close: "21.00" },
};
const warehouseHours: OpeningHours = { ...storeHours, sab: { open: "08.00", close: "15.00" }, min: null };
const gudang = { type: "gudang" as const, openingHours: warehouseHours };
const toko = { type: "toko" as const, openingHours: storeHours };

// 13 Okt 2026 adalah Selasa, 18 Okt 2026 adalah Minggu.
describe("locationFlags gudang", () => {
  it("dikirim hari ini sebelum 15.00 WIB di hari kerja", () => {
    expect(locationFlags(gudang, wibDate(2026, 10, 13, 10, 0)).shipsToday).toBe(true);
    expect(locationFlags(gudang, wibDate(2026, 10, 13, 14, 59)).shipsToday).toBe(true);
    expect(locationFlags(gudang, wibDate(2026, 10, 13, 15, 0)).shipsToday).toBe(false);
  });
  it("tidak dikirim hari Minggu walau masih pagi", () => {
    expect(locationFlags(gudang, wibDate(2026, 10, 18, 9, 0)).shipsToday).toBe(false);
  });
  it("Sabtu masih dikirim sebelum 15.00", () => {
    expect(locationFlags(gudang, wibDate(2026, 10, 17, 11, 0)).shipsToday).toBe(true);
  });
  it("batas jam dihitung dalam WIB, bukan UTC", () => {
    // 07.30 UTC = 14.30 WIB
    expect(locationFlags(gudang, new Date("2026-10-13T07:30:00.000Z")).shipsToday).toBe(true);
    // 08.30 UTC = 15.30 WIB
    expect(locationFlags(gudang, new Date("2026-10-13T08:30:00.000Z")).shipsToday).toBe(false);
  });
});

describe("locationFlags toko", () => {
  it("bisa diambil hari ini bila sebelum 16.00 dan toko buka", () => {
    const f = locationFlags(toko, wibDate(2026, 10, 13, 13, 0));
    expect(f).toEqual({ openNow: true, shipsToday: false, pickupToday: true });
  });
  it("setelah 16.00 toko masih buka tapi tidak bisa diambil hari ini", () => {
    const f = locationFlags(toko, wibDate(2026, 10, 13, 18, 0));
    expect(f.openNow).toBe(true);
    expect(f.pickupToday).toBe(false);
  });
  it("sebelum jam buka toko tutup", () => {
    const f = locationFlags(toko, wibDate(2026, 10, 13, 8, 30));
    expect(f.openNow).toBe(false);
    expect(f.pickupToday).toBe(false);
  });
  it("hari libur (jam null) berarti tutup", () => {
    const tutupMinggu = { type: "toko" as const, openingHours: { ...storeHours, min: null } };
    expect(locationFlags(tutupMinggu, wibDate(2026, 10, 18, 12, 0)).openNow).toBe(false);
  });
});

describe("stockLabel dan fulfillmentHint", () => {
  it("memberi label Habis, Stok terbatas, Tersedia", () => {
    expect(stockLabel(0)).toEqual({ text: "Habis", tone: "habis" });
    expect(stockLabel(1).tone).toBe("terbatas");
    expect(stockLabel(5).text).toBe("Stok terbatas, sisa 5");
    expect(stockLabel(6)).toEqual({ text: "Tersedia 6", tone: "tersedia" });
  });
  it("keterangan kirim dan ambil", () => {
    expect(fulfillmentHint({ type: "gudang", openNow: true, shipsToday: true, pickupToday: false }, 3)?.text).toBe("Dikirim hari ini");
    expect(fulfillmentHint({ type: "gudang", openNow: false, shipsToday: false, pickupToday: false }, 3)?.text).toBe("Dikirim hari kerja berikutnya");
    expect(fulfillmentHint({ type: "toko", openNow: true, shipsToday: false, pickupToday: true }, 2)?.text).toBe("Bisa diambil hari ini");
    expect(fulfillmentHint({ type: "toko", openNow: true, shipsToday: false, pickupToday: false }, 2)?.text).toBe("Ambil setelah pesan, sebelum tutup");
    expect(fulfillmentHint({ type: "toko", openNow: false, shipsToday: false, pickupToday: false }, 2)?.text).toBe("Toko sedang tutup, ambil besok");
    expect(fulfillmentHint({ type: "toko", openNow: true, shipsToday: false, pickupToday: true }, 0)).toBeNull();
  });
});
