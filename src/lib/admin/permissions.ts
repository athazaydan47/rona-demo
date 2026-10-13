// Izin staf berbasis kunci. can() adalah satu-satunya sumber keputusan izin; menyembunyikan menu di UI hanya pelengkap.
export const PERMISSIONS = [
  { key: "pesanan.lihat", label: "Lihat pesanan", group: "Pesanan" },
  { key: "pesanan.ubah_status", label: "Ubah status pesanan", group: "Pesanan" },
  { key: "pesanan.batalkan", label: "Batalkan pesanan", group: "Pesanan" },
  { key: "pesanan.cetak", label: "Cetak label dan daftar ambil", group: "Pesanan" },
  { key: "stok.lihat", label: "Lihat stok", group: "Stok" },
  { key: "stok.masuk", label: "Stok masuk", group: "Stok" },
  { key: "stok.transfer", label: "Transfer antar lokasi", group: "Stok" },
  { key: "stok.opname", label: "Opname", group: "Stok" },
  { key: "produk.kelola", label: "Kelola produk", group: "Katalog" },
  { key: "kategori.kelola", label: "Kelola kategori dan merek", group: "Katalog" },
  { key: "promo.kelola", label: "Kelola promo dan voucher", group: "Katalog" },
  { key: "ulasan.kelola", label: "Moderasi ulasan", group: "Katalog" },
  { key: "pelanggan.lihat", label: "Lihat pelanggan", group: "Pelanggan dan laporan" },
  { key: "laporan.lihat", label: "Lihat laporan", group: "Pelanggan dan laporan" },
  { key: "laporan.keuangan", label: "Lihat angka keuangan", group: "Pelanggan dan laporan" },
  { key: "pengaturan.kelola", label: "Kelola pengaturan toko", group: "Sistem" },
  { key: "staf.kelola", label: "Kelola akun staf dan izin", group: "Sistem" },
  { key: "log.lihat", label: "Lihat log aktivitas", group: "Sistem" },
  { key: "demo.reset", label: "Reset data demo", group: "Sistem" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) => p.key);
export const isPermissionKey = (k: string): k is PermissionKey => (ALL_PERMISSIONS as string[]).includes(k);

export type RoleSlug = "owner" | "admin_online" | "staf_cabang" | "gudang";

// Templat izin per peran bawaan (sesuai tabel peran di BRIEF). Owner menambah atau mencabut izin per akun di luar templat.
export const ROLE_TEMPLATES: Record<RoleSlug, { name: string; description: string; permissions: PermissionKey[]; needsLocation: boolean }> = {
  owner: { name: "Owner", description: "Semua akses, termasuk laporan keuangan, pengaturan, dan kelola akun.", permissions: ALL_PERMISSIONS, needsLocation: false },
  admin_online: {
    name: "Admin Online",
    description: "Pesanan online, produk, promo, voucher, ulasan.",
    permissions: ["pesanan.lihat", "pesanan.ubah_status", "pesanan.batalkan", "pesanan.cetak", "stok.lihat", "produk.kelola", "kategori.kelola", "promo.kelola", "ulasan.kelola", "pelanggan.lihat", "laporan.lihat"],
    needsLocation: false,
  },
  staf_cabang: {
    name: "Staf Cabang",
    description: "Pesanan ambil di toko dan stok cabangnya sendiri.",
    permissions: ["pesanan.lihat", "pesanan.ubah_status", "pesanan.cetak", "stok.lihat", "stok.opname"],
    needsLocation: true,
  },
  gudang: {
    name: "Gudang",
    description: "Stok masuk, transfer, opname.",
    permissions: ["stok.lihat", "stok.masuk", "stok.transfer", "stok.opname", "pesanan.lihat", "pesanan.cetak"],
    needsLocation: false,
  },
};
export const ROLE_SLUGS = Object.keys(ROLE_TEMPLATES) as RoleSlug[];
export const isRoleSlug = (s: string): s is RoleSlug => s in ROLE_TEMPLATES;

export type StaffPrincipal = {
  id: number;
  name: string;
  email: string;
  roleSlug: RoleSlug;
  isActive: boolean;
  grants: string[]; // izin tambahan di luar templat
  revokes: string[]; // izin templat yang dicabut
  locationIds: number[]; // kosong = semua lokasi
};

export function effectivePermissions(p: Pick<StaffPrincipal, "roleSlug" | "grants" | "revokes">): Set<PermissionKey> {
  const out = new Set<PermissionKey>(ROLE_TEMPLATES[p.roleSlug]?.permissions ?? []);
  for (const g of p.grants) if (isPermissionKey(g)) out.add(g);
  for (const r of p.revokes) if (isPermissionKey(r)) out.delete(r);
  return out;
}

export const allLocations = (p: Pick<StaffPrincipal, "locationIds">) => p.locationIds.length === 0;

export function canAccessLocation(p: Pick<StaffPrincipal, "locationIds">, locationId: number | null | undefined) {
  if (locationId == null || allLocations(p)) return true;
  return p.locationIds.includes(locationId);
}

// Satu-satunya sumber keputusan izin. lokasiId diisi bila aksinya menyangkut data satu lokasi.
export function can(p: StaffPrincipal | null | undefined, key: PermissionKey, opts: { lokasiId?: number | null } = {}) {
  if (!p || !p.isActive) return false;
  if (!effectivePermissions(p).has(key)) return false;
  if ("lokasiId" in opts && opts.lokasiId !== undefined) return canAccessLocation(p, opts.lokasiId);
  return true;
}

// Untuk aksi lintas lokasi (misal transfer): semua lokasi yang disentuh harus boleh.
export function canAll(p: StaffPrincipal | null | undefined, key: PermissionKey, lokasiIds: number[]) {
  return lokasiIds.every((id) => can(p, key, { lokasiId: id }));
}
