// Aturan promo (murni): item flash sale, slot admin menang atas slot otomatis, voucher, dan banner.
import { describe, expect, it } from "vitest";
import { liveBanners } from "@/lib/catalog/banners";
import { missingFlashSlots, planFlashSlots } from "@/lib/flash/ensure";
import { wibDate } from "@/lib/format";
import { autoSlotsToDisable, checkFlashItem, validateBanner, validateVoucher, type VoucherForm } from "./promo-rules";

const item = (over: Partial<Parameters<typeof checkFlashItem>[0]> = {}) => checkFlashItem({ flashPrice: 79_000, quota: 20, maxPerCustomer: 2, effective: 109_000, normalPrice: 129_000, onlineAvailable: 40, ...over });

describe("checkFlashItem", () => {
  it("harga flash di bawah harga efektif lolos, persen dihitung dari harga normal", () => {
    expect(item()).toEqual({ errors: [], warnings: [], percent: 38 });
  });
  it("harga flash sama dengan atau di atas harga efektif ditolak", () => {
    expect(item({ flashPrice: 109_000 }).errors[0]).toMatch(/di bawah harga efektif/);
    expect(item({ flashPrice: 0 }).errors[0]).toMatch(/Isi harga flash/);
  });
  it("kuota di atas stok online hanya peringatan, kuota di bawah terjual ditolak", () => {
    const r = item({ quota: 50, onlineAvailable: 12 });
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/melebihi stok online tersedia \(12\)/);
    expect(item({ quota: 3, sold: 5 }).errors[0]).toMatch(/sudah terjual/);
  });
  it("batas per pembeli 1 sampai 10", () => {
    expect(item({ maxPerCustomer: 0 }).errors.length).toBe(1);
    expect(item({ maxPerCustomer: 11 }).errors.length).toBe(1);
  });
});

describe("slot admin selalu menang", () => {
  const admin = { startsAt: wibDate(2026, 10, 15, 11, 0), endsAt: wibDate(2026, 10, 15, 13, 0) };
  const existing = [
    { id: 1, source: "otomatis", isActive: true, startsAt: wibDate(2026, 10, 15, 12), endsAt: wibDate(2026, 10, 15, 14) },
    { id: 2, source: "otomatis", isActive: true, startsAt: wibDate(2026, 10, 15, 20), endsAt: wibDate(2026, 10, 15, 22) },
    { id: 3, source: "admin", isActive: true, startsAt: wibDate(2026, 10, 15, 12), endsAt: wibDate(2026, 10, 15, 14) },
    { id: 4, source: "otomatis", isActive: false, startsAt: wibDate(2026, 10, 15, 12), endsAt: wibDate(2026, 10, 15, 14) },
  ];
  it("slot otomatis yang bertabrakan dinonaktifkan, slot admin lain dan slot yang tidak bertabrakan dibiarkan", () => {
    expect(autoSlotsToDisable(admin, existing)).toEqual([1]);
  });
  it("pembuat slot otomatis tidak membuat ulang slot yang bertabrakan dengan slot admin aktif", () => {
    const planned = planFlashSlots(wibDate(2026, 10, 15, 8));
    const missing = missingFlashSlots(planned, [{ name: "Admin", startsAt: admin.startsAt, endsAt: admin.endsAt, source: "admin", isActive: true }]);
    expect(missing.some((p) => p.startsAt.getTime() === wibDate(2026, 10, 15, 12).getTime())).toBe(false);
    expect(missing.some((p) => p.startsAt.getTime() === wibDate(2026, 10, 15, 20).getTime())).toBe(true);
    // Slot admin yang dinonaktifkan tidak lagi menghalangi.
    const again = missingFlashSlots(planned, [{ name: "Admin", startsAt: admin.startsAt, endsAt: admin.endsAt, source: "admin", isActive: false }]);
    expect(again.some((p) => p.startsAt.getTime() === wibDate(2026, 10, 15, 12).getTime())).toBe(true);
  });
});

const voucher = (over: Partial<VoucherForm> = {}): VoucherForm => ({ code: "HEMAT20", title: "Hemat 20 ribu", type: "nominal", value: 20_000, minSpend: 100_000, startsAt: wibDate(2026, 10, 1), endsAt: wibDate(2026, 11, 1), quota: 100, quotaPerCustomer: 1, stackWithFlash: false, isActive: true, ...over });

describe("validateVoucher", () => {
  it("voucher lengkap lolos", () => {
    expect(validateVoucher(voucher())).toBeNull();
  });
  it("kode harus huruf besar atau angka tanpa spasi", () => {
    expect(validateVoucher(voucher({ code: "HE MAT" }))).toMatch(/Kode/);
    expect(validateVoucher(voucher({ code: "AB" }))).toMatch(/Kode/);
  });
  it("persen wajib punya batas maksimal dan tidak lebih dari 90%", () => {
    expect(validateVoucher(voucher({ type: "persen", value: 10, maxDiscount: null }))).toMatch(/batas maksimal/);
    expect(validateVoucher(voucher({ type: "persen", value: 95, maxDiscount: 50_000 }))).toMatch(/90%/);
    expect(validateVoucher(voucher({ type: "persen", value: 10, maxDiscount: 30_000 }))).toBeNull();
  });
  it("periode terbalik, kuota 0, dan kuota per pembeli 0 ditolak", () => {
    expect(validateVoucher(voucher({ endsAt: wibDate(2026, 9, 1) }))).toMatch(/setelah tanggal mulai/);
    expect(validateVoucher(voucher({ quota: 0 }))).toMatch(/Kuota/);
    expect(validateVoucher(voucher({ quotaPerCustomer: 0 }))).toMatch(/per pembeli/);
  });
});

describe("banner", () => {
  const art = { items: [{ packaging: "lipstick", shade: "#B8475D", brandColor: "#C2416B", brandName: "Lumi" }], background: "#F4DCDF" };
  it("butuh gambar atau komposisi ProductArt dan tautan internal", () => {
    expect(validateBanner({ title: "Promo gajian", href: "/c/skincare", art, isActive: true })).toBeNull();
    expect(validateBanner({ title: "Promo gajian", href: "/c/skincare", isActive: true })).toMatch(/gambar atau komposisi/);
    expect(validateBanner({ title: "Promo gajian", href: "https://contoh.com", art, isActive: true })).toMatch(/Tautan/);
    expect(validateBanner({ title: "Promo", href: "/", art: { items: [{ ...art.items[0], packaging: "botol_aneh" }] }, isActive: true })).toMatch(/kemasan/);
  });
  it("hanya banner aktif dalam jadwal yang tayang, urut sesuai urutan", () => {
    const now = wibDate(2026, 10, 14, 10);
    const rows = [
      { id: 1, isActive: true, startsAt: null, endsAt: null, sortOrder: 2 },
      { id: 2, isActive: true, startsAt: wibDate(2026, 10, 15), endsAt: null, sortOrder: 0 },
      { id: 3, isActive: false, startsAt: null, endsAt: null, sortOrder: 0 },
      { id: 4, isActive: true, startsAt: wibDate(2026, 10, 1), endsAt: wibDate(2026, 10, 14, 9), sortOrder: 0 },
      { id: 5, isActive: true, startsAt: wibDate(2026, 10, 1), endsAt: wibDate(2026, 10, 20), sortOrder: 1 },
    ];
    expect(liveBanners(rows, now).map((b) => b.id)).toEqual([5, 1]);
  });
});
