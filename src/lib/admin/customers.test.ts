// Segmen pelanggan di setiap batasnya, penyamaran kontak, dan validasi penyesuaian poin (murni).
import { describe, expect, it } from "vitest";
import { wibDate } from "@/lib/format";
import { reportLocationScope } from "@/lib/reports/request";
import { contactView, customerSegment, maskEmail, maskPhone, validatePointAdjust, waNumber } from "./customers";
import type { StaffPrincipal } from "./permissions";

const NOW = wibDate(2026, 10, 14, 10, 0);
const DAY = 86_400_000;
const ago = (days: number, extraMs = 0) => new Date(NOW.getTime() - days * DAY + extraMs);
const o = (days: number, status = "selesai", extraMs = 0) => ({ createdAt: ago(days, extraMs), status });

describe("segmen pelanggan", () => {
  it("Baru: satu-satunya pesanan Selesai dalam 30 hari (batas 30 hari tepat masih Baru)", () => {
    expect(customerSegment({ orders: [o(30)] }, NOW)).toBe("baru");
    expect(customerSegment({ orders: [o(30, "selesai", -1)] }, NOW)).toBe("lainnya"); // 1 ms lewat batas
    expect(customerSegment({ orders: [o(3), o(5, "dibatalkan")] }, NOW)).toBe("baru");
    expect(customerSegment({ orders: [o(3), o(40)] }, NOW)).toBe("lainnya"); // sudah 2 pesanan Selesai
    expect(customerSegment({ orders: [o(2, "dikirim")] }, NOW)).toBe("lainnya"); // belum Selesai
  });
  it("Setia: minimal 3 pesanan Selesai dalam 180 hari", () => {
    expect(customerSegment({ orders: [o(10), o(100), o(180)] }, NOW)).toBe("setia");
    expect(customerSegment({ orders: [o(10), o(100), o(180, "selesai", -1)] }, NOW)).toBe("lainnya");
    expect(customerSegment({ orders: [o(10), o(20), o(30, "diretur")] }, NOW)).toBe("lainnya");
  });
  it("Tidak aktif: tanpa pesanan apa pun dalam 90 hari, menang atas Setia", () => {
    expect(customerSegment({ orders: [] }, NOW)).toBe("tidak_aktif");
    expect(customerSegment({ orders: [o(90)] }, NOW)).toBe("lainnya"); // tepat 90 hari: masih aktif
    expect(customerSegment({ orders: [o(90, "selesai", -1)] }, NOW)).toBe("tidak_aktif");
    expect(customerSegment({ orders: [o(95), o(120), o(150)] }, NOW)).toBe("tidak_aktif");
    expect(customerSegment({ orders: [o(1, "dibatalkan")] }, NOW)).toBe("lainnya");
  });
});

describe("privasi kontak", () => {
  const staff = (grants: string[] = [], revokes: string[] = [], roleSlug: StaffPrincipal["roleSlug"] = "admin_online"): StaffPrincipal => ({ id: 1, name: "Uji", email: "u@r.t", roleSlug, isActive: true, grants, revokes, locationIds: [] });
  it("nomor dan email disamarkan sebagian", () => {
    expect(maskPhone("081234567890")).toBe("0812••••890");
    expect(maskEmail("ayu.lestari@contoh.demo")).toBe("ay•••@contoh.demo");
    expect(maskEmail(null)).toBeNull();
    expect(waNumber("0812-3456-7890")).toBe("6281234567890");
  });
  it("tanpa pelanggan.kontak kontak disamarkan, dengan izin tampil utuh", () => {
    const c = { phone: "080012345678", email: "rina@contoh.demo" };
    expect(contactView(staff(), c)).toEqual({ phone: c.phone, email: c.email, masked: false });
    expect(contactView(staff([], ["pelanggan.kontak"]), c)).toMatchObject({ phone: "0800••••678", masked: true });
    expect(contactView(staff([], [], "gudang"), c).masked).toBe(true);
    expect(contactView(staff(["pelanggan.kontak"], [], "gudang"), c).masked).toBe(false);
  });
});

describe("penyesuaian poin (validasi)", () => {
  it("alasan wajib, jumlah bukan nol, saldo tidak boleh negatif", () => {
    expect(validatePointAdjust(500, "Kompensasi paket telat")).toBeNull();
    expect(validatePointAdjust(0, "Kompensasi")).toMatch(/jumlah/);
    expect(validatePointAdjust(100, "ok")).toMatch(/alasan/);
    expect(validatePointAdjust(-300, "Koreksi salah input", 200)).toMatch(/negatif/);
    expect(validatePointAdjust(-200, "Koreksi salah input", 200)).toBeNull();
    expect(validatePointAdjust(200_000, "Terlalu besar")).toMatch(/Maksimal/);
  });
});

describe("cakupan lokasi laporan", () => {
  it("staf semua lokasi bebas memilih; staf cabang terkunci ke lokasinya", () => {
    expect(reportLocationScope({ locationIds: [] }, null)).toBeNull();
    expect(reportLocationScope({ locationIds: [] }, 3)).toEqual([3]);
    expect(reportLocationScope({ locationIds: [2] }, null)).toEqual([2]);
    expect(reportLocationScope({ locationIds: [2] }, 3)).toEqual([2]);
    expect(reportLocationScope({ locationIds: [2, 3] }, 3)).toEqual([3]);
  });
});
