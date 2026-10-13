import { describe, expect, it } from "vitest";
import {
  formatDateTimeWib,
  formatDateWib,
  formatRupiah,
  formatTimeWib,
  wibDate,
  formatCompactNumber,
} from "./format";

describe("formatRupiah", () => {
  it("memisahkan ribuan dengan titik", () => {
    expect(formatRupiah(129000)).toBe("Rp 129.000");
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
    expect(formatRupiah(500)).toBe("Rp 500");
    expect(formatRupiah(0)).toBe("Rp 0");
  });
  it("menangani nilai negatif", () => {
    expect(formatRupiah(-15000)).toBe("-Rp 15.000");
  });
});

describe("format WIB", () => {
  const d = wibDate(2026, 10, 13, 14, 30);
  it("menyimpan UTC dan menampilkan WIB", () => {
    expect(d.toISOString()).toBe("2026-10-13T07:30:00.000Z");
    expect(formatDateWib(d)).toBe("13 Okt 2026");
    expect(formatTimeWib(d)).toBe("14.30 WIB");
    expect(formatDateTimeWib(d)).toBe("13 Okt 2026, 14.30 WIB");
  });
  it("melewati batas hari dengan benar", () => {
    const late = new Date("2026-10-13T20:05:00.000Z");
    expect(formatDateTimeWib(late)).toBe("14 Okt 2026, 03.05 WIB");
  });
});

describe("formatCompactNumber", () => {
  it("meringkas ribuan", () => {
    expect(formatCompactNumber(850)).toBe("850");
    expect(formatCompactNumber(1200)).toBe("1,2 rb");
    expect(formatCompactNumber(2000)).toBe("2 rb");
    expect(formatCompactNumber(12000)).toBe("12 rb");
    expect(formatCompactNumber(1500000)).toBe("1,5 jt");
  });
});
