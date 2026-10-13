import { describe, expect, it } from "vitest";
import { countdownTo, pickFlashSlot, quotaLeft, quotaUsedPercent } from "./index";
import { wibDate } from "@/lib/format";

const slot = (id: number, day: number, startH: number, endH: number) => ({
  id,
  name: `Slot ${id}`,
  startsAt: wibDate(2026, 10, day, startH),
  endsAt: wibDate(2026, 10, day, endH),
});
const slots = [slot(1, 13, 12, 14), slot(2, 13, 20, 22), slot(3, 14, 12, 14), slot(4, 14, 20, 22)];

describe("pickFlashSlot", () => {
  it("memilih slot yang sedang berjalan dan slot berikutnya", () => {
    const r = pickFlashSlot(slots, wibDate(2026, 10, 13, 13, 0));
    expect(r.active?.id).toBe(1);
    expect(r.next?.id).toBe(2);
  });
  it("tanpa slot aktif: hanya slot berikutnya", () => {
    const r = pickFlashSlot(slots, wibDate(2026, 10, 13, 15, 0));
    expect(r.active).toBeNull();
    expect(r.next?.id).toBe(2);
  });
  it("tepat di batas: mulai inklusif, selesai eksklusif", () => {
    expect(pickFlashSlot(slots, wibDate(2026, 10, 13, 12, 0)).active?.id).toBe(1);
    expect(pickFlashSlot(slots, wibDate(2026, 10, 13, 14, 0)).active).toBeNull();
  });
  it("semua slot sudah lewat", () => {
    const r = pickFlashSlot(slots, wibDate(2026, 10, 15, 9, 0));
    expect(r.active).toBeNull();
    expect(r.next).toBeNull();
  });
  it("urutan masukan tidak memengaruhi hasil", () => {
    const r = pickFlashSlot([...slots].reverse(), wibDate(2026, 10, 13, 21, 0));
    expect(r.active?.id).toBe(2);
    expect(r.next?.id).toBe(3);
  });
});

describe("kuota dan hitung mundur", () => {
  it("menghitung sisa dan persen kuota", () => {
    expect(quotaLeft({ quota: 30, sold: 18 })).toBe(12);
    expect(quotaLeft({ quota: 10, sold: 14 })).toBe(0);
    expect(quotaUsedPercent({ quota: 30, sold: 18 })).toBe(60);
    expect(quotaUsedPercent({ quota: 0, sold: 0 })).toBe(100);
  });
  it("hitung mundur tidak pernah negatif", () => {
    const c = countdownTo(wibDate(2026, 10, 13, 14, 0), new Date(wibDate(2026, 10, 13, 12, 30).getTime() + 15000));
    expect(c).toEqual({ total: 5385000, hours: 1, minutes: 29, seconds: 45 });
    expect(countdownTo(wibDate(2026, 10, 13, 14, 0), wibDate(2026, 10, 13, 15, 0)).total).toBe(0);
  });
});
