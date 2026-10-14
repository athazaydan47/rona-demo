import { describe, expect, it } from "vitest";
import { availableActions, emptyColumnText, initialKanbanTab, parseKanbanTab, planMove } from "./kanban";

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

describe("tab kanban di HP", () => {
  const cols = (totals: Partial<Record<string, number>>) => ["menunggu_pembayaran", "dibayar", "diproses", "siap_diambil", "dikirim", "selesai", "dibatalkan", "diretur"].map((s) => ({ status: s as never, total: totals[s] ?? 0 }));
  it("membuka status aktif pertama yang berisi, sesuai prioritas", () => {
    expect(initialKanbanTab(cols({ dibayar: 2, diproses: 5 }), null)).toBe("dibayar");
    expect(initialKanbanTab(cols({ diproses: 1, menunggu_pembayaran: 3 }), null)).toBe("diproses");
    expect(initialKanbanTab(cols({ menunggu_pembayaran: 1, dikirim: 4 }), null)).toBe("menunggu_pembayaran");
    expect(initialKanbanTab(cols({ dikirim: 4, selesai: 9 }), null)).toBe("dikirim");
    expect(initialKanbanTab(cols({ selesai: 9 }), null)).toBe("dibayar");
  });
  it("pilihan terakhir staf yang sama diingat, staf lain tidak", () => {
    expect(initialKanbanTab(cols({ dibayar: 2 }), parseKanbanTab("7:dikirim", 7))).toBe("dikirim");
    expect(parseKanbanTab("7:dikirim", 8)).toBeNull();
    expect(parseKanbanTab("7:bukan", 7)).toBeNull();
    expect(parseKanbanTab(undefined, 7)).toBeNull();
  });
  it("teks kosong yang membantu", () => {
    expect(emptyColumnText("dibayar")).toBe("Belum ada pesanan Dibayar. Pesanan baru akan muncul di sini otomatis.");
  });
});
