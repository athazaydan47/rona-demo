// Menu panel admin untuk semua modul (6A dan 6B). Menu tampil sesuai izin; pengamannya tetap can() di server.
import type { PermissionKey, RoleSlug } from "./permissions";

export type NavKey = "dashboard" | "pesanan" | "stok" | "produk" | "kategori" | "promo" | "ulasan" | "pelanggan" | "laporan" | "pengaturan" | "staf" | "log";

export const ADMIN_NAV: { key: NavKey; href: string; label: string; permission: PermissionKey | null; soon?: boolean }[] = [
  { key: "dashboard", href: "/admin", label: "Dashboard", permission: null },
  { key: "pesanan", href: "/admin/pesanan", label: "Pesanan", permission: "pesanan.lihat" },
  { key: "stok", href: "/admin/stok", label: "Stok", permission: "stok.lihat" },
  { key: "produk", href: "/admin/produk", label: "Produk", permission: "produk.kelola", soon: true },
  { key: "kategori", href: "/admin/kategori", label: "Kategori dan Merek", permission: "kategori.kelola", soon: true },
  { key: "promo", href: "/admin/promo", label: "Promo", permission: "promo.kelola", soon: true },
  { key: "ulasan", href: "/admin/ulasan", label: "Ulasan", permission: "ulasan.kelola", soon: true },
  { key: "pelanggan", href: "/admin/pelanggan", label: "Pelanggan", permission: "pelanggan.lihat", soon: true },
  { key: "laporan", href: "/admin/laporan", label: "Laporan", permission: "laporan.lihat", soon: true },
  { key: "pengaturan", href: "/admin/pengaturan", label: "Pengaturan", permission: "pengaturan.kelola", soon: true },
  { key: "staf", href: "/admin/staf", label: "Staf dan izin", permission: "staf.kelola" },
  { key: "log", href: "/admin/log", label: "Log aktivitas", permission: "log.lihat" },
];

// Urutan menu bawah HP per peran: 4 menu terpenting + "Lainnya".
export const MOBILE_PRIORITY: Record<RoleSlug, NavKey[]> = {
  owner: ["dashboard", "pesanan", "stok", "log"],
  admin_online: ["dashboard", "pesanan", "stok", "produk"],
  staf_cabang: ["dashboard", "pesanan", "stok"],
  gudang: ["dashboard", "stok", "pesanan"],
};
