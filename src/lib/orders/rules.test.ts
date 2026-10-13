import { describe, expect, it } from "vitest";
import type { OpeningHours } from "@/db/schema";
import { wibDate } from "@/lib/format";
import { formatOrderNumber, isExpired, mergeCartItems, normalizePhone, orderPeriod, parseOrderNumber, payAtStoreDeadline, paymentDeadline } from "./rules";

describe("nomor pesanan", () => {
  it("format RONA-YYMM-000001 dengan bulan WIB", () => {
    expect(formatOrderNumber(orderPeriod(wibDate(2026, 10, 14, 9)), 1)).toBe("RONA-2610-000001");
    expect(formatOrderNumber("2610", 123)).toBe("RONA-2610-000123");
    // 31 Okt 23.30 WIB masih Oktober walau UTC sudah... tetap 31 Okt; 1 Nov 00.30 WIB = 31 Okt 17.30 UTC sudah November
    expect(orderPeriod(new Date("2026-10-31T17:30:00.000Z"))).toBe("2611");
  });
  it("urutan berurutan dan bisa diurai kembali", () => {
    const numbers = [1, 2, 3].map((n) => formatOrderNumber("2610", n));
    expect(numbers).toEqual(["RONA-2610-000001", "RONA-2610-000002", "RONA-2610-000003"]);
    expect(parseOrderNumber("rona-2610-000042")).toEqual({ period: "2610", seq: 42 });
    expect(parseOrderNumber("ABC")).toBeNull();
    expect(() => formatOrderNumber("2610", 0)).toThrow();
  });
});

describe("batas waktu bayar dan kedaluwarsa", () => {
  const hours: OpeningHours = {
    sen: { open: "09.00", close: "21.00" },
    sel: { open: "09.00", close: "21.00" },
    rab: { open: "09.00", close: "21.00" },
    kam: { open: "09.00", close: "21.00" },
    jum: { open: "09.00", close: "21.00" },
    sab: { open: "10.00", close: "20.00" },
    min: { open: "10.00", close: "20.00" },
  };
  it("QRIS dan VA berlaku 15 menit", () => {
    const now = wibDate(2026, 10, 14, 12, 0);
    expect(paymentDeadline({ paymentMethod: "qris", now })).toEqual(wibDate(2026, 10, 14, 12, 15));
  });
  it("Bayar di Toko sampai jam tutup cabang pada hari kerja berikutnya", () => {
    // Rabu 14 Okt -> Kamis 15 Okt 21.00
    expect(payAtStoreDeadline(hours, wibDate(2026, 10, 14, 12, 0))).toEqual(wibDate(2026, 10, 15, 21, 0));
    // Jumat 16 Okt -> Sabtu 17 Okt 20.00 (jam tutup Sabtu)
    expect(payAtStoreDeadline(hours, wibDate(2026, 10, 16, 18, 0))).toEqual(wibDate(2026, 10, 17, 20, 0));
    // Sabtu 17 Okt -> Minggu dilewati -> Senin 19 Okt 21.00
    expect(payAtStoreDeadline(hours, wibDate(2026, 10, 17, 11, 0))).toEqual(wibDate(2026, 10, 19, 21, 0));
  });
  it("hari cabang tutup juga dilewati", () => {
    const tutupKamis = { ...hours, kam: null };
    expect(payAtStoreDeadline(tutupKamis, wibDate(2026, 10, 14, 12, 0))).toEqual(wibDate(2026, 10, 16, 21, 0));
  });
  it("kedaluwarsa tepat saat batas waktu tercapai, dengan jam palsu", () => {
    const deadline = wibDate(2026, 10, 14, 12, 15);
    expect(isExpired(deadline, wibDate(2026, 10, 14, 12, 14))).toBe(false);
    expect(isExpired(deadline, wibDate(2026, 10, 14, 12, 15))).toBe(true);
    expect(isExpired(null, wibDate(2030, 1, 1))).toBe(false);
  });
});

describe("gabung keranjang tamu", () => {
  it("menjumlahkan varian yang sama, maksimal 10", () => {
    const r = mergeCartItems(
      [{ variantId: 1, quantity: 2, savedForLater: false }],
      [
        { variantId: 1, quantity: 9, savedForLater: false },
        { variantId: 2, quantity: 1, savedForLater: false },
      ],
    );
    expect(r).toEqual([
      { variantId: 1, quantity: 10, savedForLater: false },
      { variantId: 2, quantity: 1, savedForLater: false },
    ]);
  });
  it("item aktif menang atas simpan untuk nanti, tanpa menjumlahkan", () => {
    const r = mergeCartItems([{ variantId: 5, quantity: 2, savedForLater: true }], [{ variantId: 5, quantity: 1, savedForLater: false }]);
    expect(r).toEqual([{ variantId: 5, quantity: 2, savedForLater: false }]);
  });
  it("keranjang tamu kosong tidak mengubah keranjang akun", () => {
    const acc = [{ variantId: 3, quantity: 4, savedForLater: false }];
    expect(mergeCartItems(acc, [])).toEqual(acc);
  });
});

describe("nomor WhatsApp", () => {
  it("menerima format Indonesia dan menormalisasi ke 08xx", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("081234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("081234567890");
    expect(normalizePhone("6281234567890")).toBe("081234567890");
    expect(normalizePhone("021555000")).toBeNull();
    expect(normalizePhone("0812")).toBeNull();
  });
});
