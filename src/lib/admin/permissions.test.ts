import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, can, canAll, effectivePermissions, ROLE_TEMPLATES, type PermissionKey, type RoleSlug, type StaffPrincipal } from "./permissions";

const staff = (roleSlug: RoleSlug, over: Partial<StaffPrincipal> = {}): StaffPrincipal => ({ id: 1, name: "Uji", email: "uji@rona.test", roleSlug, isActive: true, grants: [], revokes: [], locationIds: [], ...over });
const DINOYO = 2;
const SAWOJAJAR = 3;

// Matriks harapan per peran (sesuai tabel peran di BRIEF).
const EXPECTED: Record<RoleSlug, PermissionKey[]> = {
  owner: ALL_PERMISSIONS,
  admin_online: ["pesanan.lihat", "pesanan.ubah_status", "pesanan.batalkan", "pesanan.cetak", "stok.lihat", "produk.kelola", "kategori.kelola", "promo.kelola", "ulasan.kelola", "pelanggan.lihat", "laporan.lihat"],
  staf_cabang: ["pesanan.lihat", "pesanan.ubah_status", "pesanan.cetak", "stok.lihat", "stok.opname"],
  gudang: ["stok.lihat", "stok.masuk", "stok.transfer", "stok.opname", "pesanan.lihat", "pesanan.cetak"],
};

describe("can(): matriks izin empat peran", () => {
  for (const role of Object.keys(EXPECTED) as RoleSlug[]) {
    it(`${ROLE_TEMPLATES[role].name}`, () => {
      const s = staff(role);
      for (const key of ALL_PERMISSIONS) expect(can(s, key), `${role} ${key}`).toBe(EXPECTED[role].includes(key));
    });
  }
  it("hanya Owner yang bisa kelola staf, lihat keuangan, log, dan reset demo", () => {
    for (const key of ["staf.kelola", "laporan.keuangan", "log.lihat", "demo.reset"] as PermissionKey[]) {
      expect(can(staff("owner"), key)).toBe(true);
      expect(can(staff("admin_online"), key)).toBe(false);
      expect(can(staff("staf_cabang"), key)).toBe(false);
      expect(can(staff("gudang"), key)).toBe(false);
    }
  });
});

describe("can(): izin tambahan dan pencabutan per akun", () => {
  it("Owner bisa menambah izin di luar templat dan mencabut izin templat", () => {
    const s = staff("staf_cabang", { grants: ["stok.masuk", "bukan.izin"], revokes: ["stok.opname"] });
    expect(can(s, "stok.masuk")).toBe(true);
    expect(can(s, "stok.opname")).toBe(false);
    expect(effectivePermissions(s).has("bukan.izin" as PermissionKey)).toBe(false);
  });
  it("akun nonaktif atau tanpa sesi tidak punya izin apa pun", () => {
    expect(can(staff("owner", { isActive: false }), "pesanan.lihat")).toBe(false);
    expect(can(null, "pesanan.lihat")).toBe(false);
  });
});

describe("can(): pembatasan lokasi", () => {
  const dinoyo = staff("staf_cabang", { locationIds: [DINOYO] });
  it("Staf Cabang hanya untuk lokasinya", () => {
    expect(can(dinoyo, "pesanan.ubah_status", { lokasiId: DINOYO })).toBe(true);
    expect(can(dinoyo, "pesanan.ubah_status", { lokasiId: SAWOJAJAR })).toBe(false);
    expect(can(dinoyo, "stok.lihat", { lokasiId: SAWOJAJAR })).toBe(false);
  });
  it("tanpa daftar lokasi berarti semua lokasi, Owner selalu semua", () => {
    expect(can(staff("gudang"), "stok.transfer", { lokasiId: SAWOJAJAR })).toBe(true);
    expect(canAll(staff("gudang"), "stok.transfer", [1, SAWOJAJAR])).toBe(true);
    expect(canAll(staff("gudang", { locationIds: [1] }), "stok.transfer", [1, SAWOJAJAR])).toBe(false);
  });
  it("izin tetap wajib walau lokasinya cocok", () => {
    expect(can(dinoyo, "pesanan.batalkan", { lokasiId: DINOYO })).toBe(false);
  });
});

describe("izin halaman Fase 6B", () => {
  const PAGES = { "/admin/produk": "produk.kelola", "/admin/kategori": "kategori.kelola", "/admin/promo": "promo.kelola", "/admin/pengaturan": "pengaturan.kelola" } as const;
  const ALLOWED: Record<RoleSlug, string[]> = {
    owner: Object.keys(PAGES),
    admin_online: ["/admin/produk", "/admin/kategori", "/admin/promo"],
    staf_cabang: [],
    gudang: [],
  };
  for (const role of Object.keys(ALLOWED) as RoleSlug[]) {
    it(`${ROLE_TEMPLATES[role].name}: ${ALLOWED[role].join(", ") || "tidak ada"}`, () => {
      for (const [page, key] of Object.entries(PAGES)) expect(can(staff(role), key), `${role} ${page}`).toBe(ALLOWED[role].includes(page));
    });
  }
  it("menu admin memakai izin yang sama dan tidak lagi bertanda segera hadir", async () => {
    const { ADMIN_NAV } = await import("./nav");
    for (const [page, key] of Object.entries(PAGES)) {
      const item = ADMIN_NAV.find((n) => n.href === page)!;
      expect(item.permission).toBe(key);
      expect(item.soon).toBeUndefined();
    }
  });
  it("izin tambahan per akun membuka halaman pengaturan untuk Admin Online", () => {
    expect(can(staff("admin_online", { grants: ["pengaturan.kelola"] }), "pengaturan.kelola")).toBe(true);
  });
});
