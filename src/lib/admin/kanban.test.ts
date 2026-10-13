import { describe, expect, it } from "vitest";
import { availableActions, planMove } from "./kanban";

const kirim = (status: string) => ({ status: status as never, method: "kirim" as const, paymentMethod: "qris" });
const ambil = (status: string, paymentMethod = "qris") => ({ status: status as never, method: "ambil" as const, paymentMethod });

describe("kanban ke state machine", () => {
  it("transisi sah langsung, yang butuh isian ditandai", () => {
    expect(planMove(kirim("dibayar"), "diproses")).toMatchObject({ ok: true, steps: ["diproses"], needs: null });
    expect(planMove(kirim("diproses"), "dikirim")).toMatchObject({ ok: true, steps: ["dikirim"], needs: "resi" });
    expect(planMove(kirim("dibayar"), "dibatalkan")).toMatchObject({ ok: true, needs: "alasan", permission: "pesanan.batalkan" });
    expect(planMove(kirim("selesai"), "diretur")).toMatchObject({ ok: true, needs: "alasan" });
  });
  it("transisi tidak sah ditolak dengan alasan", () => {
    expect(planMove(kirim("dibayar"), "selesai")).toMatchObject({ ok: false });
    expect(planMove(kirim("diproses"), "siap_diambil")).toMatchObject({ ok: false, reason: expect.stringContaining("Siap Diambil") });
    expect(planMove(ambil("diproses"), "dikirim")).toMatchObject({ ok: false });
    expect(planMove(kirim("menunggu_pembayaran"), "dibayar")).toMatchObject({ ok: false, reason: expect.stringContaining("otomatis") });
    expect(planMove(kirim("selesai"), "dibatalkan")).toMatchObject({ ok: false });
    expect(planMove(kirim("dibayar"), "dibayar")).toMatchObject({ ok: false });
  });
  it("aksi gabungan Staf Cabang: siapkan pesanan dan Bayar di Toko", () => {
    expect(planMove(ambil("dibayar"), "siap_diambil")).toMatchObject({ ok: true, steps: ["diproses", "siap_diambil"], label: "Siapkan pesanan" });
    expect(planMove(ambil("menunggu_pembayaran", "bayar_di_toko"), "selesai")).toMatchObject({ ok: true, steps: ["dibayar", "selesai"], payAtStore: true });
    expect(planMove(ambil("menunggu_pembayaran"), "selesai")).toMatchObject({ ok: false });
    expect(planMove(ambil("siap_diambil"), "selesai")).toMatchObject({ ok: true, label: "Tandai sudah diambil" });
  });
  it("tombol aksi detail mengikuti status", () => {
    expect(availableActions(kirim("dibayar")).map((a) => a.to)).toEqual(["diproses", "dibatalkan"]);
    expect(availableActions(ambil("dibayar")).map((a) => a.to)).toEqual(["siap_diambil", "dibatalkan"]);
    expect(availableActions(ambil("menunggu_pembayaran", "bayar_di_toko")).map((a) => a.to)).toEqual(["dibayar", "selesai", "dibatalkan"]);
    expect(availableActions(kirim("dibatalkan"))).toEqual([]);
  });
});
