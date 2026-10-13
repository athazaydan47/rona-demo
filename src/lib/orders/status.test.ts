import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, nextStatuses, ORDER_STATUSES, TransitionError, TRANSITIONS, type OrderStatus } from "./status";

const kirim = { method: "kirim" as const };
const ambil = { method: "ambil" as const };

describe("state machine status pesanan", () => {
  it("semua transisi di tabel BRIEF sah untuk metode yang sesuai", () => {
    for (const r of TRANSITIONS) {
      const ctx = r.method === "ambil" ? ambil : kirim;
      expect(canTransition(r.from, r.to, ctx), `${r.from} -> ${r.to}`).toBe(true);
    }
    expect(TRANSITIONS).toHaveLength(10);
  });

  it("pesanan kirim lewat Dikirim, pesanan ambil lewat Siap Diambil", () => {
    expect(canTransition("diproses", "dikirim", kirim)).toBe(true);
    expect(canTransition("diproses", "dikirim", ambil)).toBe(false);
    expect(canTransition("diproses", "siap_diambil", ambil)).toBe(true);
    expect(canTransition("diproses", "siap_diambil", kirim)).toBe(false);
    expect(canTransition("dikirim", "selesai", kirim)).toBe(true);
    expect(canTransition("siap_diambil", "selesai", ambil)).toBe(true);
  });

  it("menolak transisi yang tidak ada di tabel", () => {
    const rejected: [OrderStatus, OrderStatus][] = [
      ["menunggu_pembayaran", "diproses"],
      ["menunggu_pembayaran", "selesai"],
      ["dibayar", "dikirim"],
      ["dikirim", "dibatalkan"],
      ["siap_diambil", "dibatalkan"],
      ["selesai", "dibatalkan"],
      ["dibatalkan", "dibayar"],
      ["diretur", "selesai"],
      ["dibayar", "dibayar"],
    ];
    for (const [from, to] of rejected) expect(canTransition(from, to, kirim), `${from} -> ${to}`).toBe(false);
    expect(() => assertTransition("dikirim", "dibatalkan", kirim)).toThrow(TransitionError);
    expect(() => assertTransition("dikirim", "dibatalkan", kirim)).toThrow("Status tidak bisa berubah dari Dikirim ke Dibatalkan.");
  });

  it("status akhir tidak punya langkah selanjutnya kecuali retur dari Selesai", () => {
    expect(nextStatuses("dibatalkan", kirim)).toEqual([]);
    expect(nextStatuses("diretur", kirim)).toEqual([]);
    expect(nextStatuses("selesai", kirim)).toEqual(["diretur"]);
  });

  it("pengecualian Bayar di Toko: Dibayar langsung Selesai hanya lewat aksi staf lunas dan diambil", () => {
    expect(canTransition("dibayar", "selesai", { method: "ambil", paymentMethod: "bayar_di_toko", payAtStoreHandover: true })).toBe(true);
    expect(canTransition("dibayar", "selesai", { method: "ambil", paymentMethod: "bayar_di_toko" })).toBe(false);
    expect(canTransition("dibayar", "selesai", { method: "ambil", paymentMethod: "qris", payAtStoreHandover: true })).toBe(false);
    expect(canTransition("dibayar", "selesai", { method: "kirim", paymentMethod: "bayar_di_toko", payAtStoreHandover: true })).toBe(false);
  });

  it("setiap status punya label dan daftar status lengkap", () => {
    expect(ORDER_STATUSES).toHaveLength(8);
  });
});
