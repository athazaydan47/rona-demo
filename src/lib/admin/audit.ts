// Log aktivitas admin: siapa, kapan, aksi, objek, serta data sebelum dan sesudah.
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";

export type AuditInput = {
  staff: { id: number; name: string } | null;
  action: string; // misal "pesanan.status", "stok.transfer", "staf.ubah", "staf.masuk_gagal"
  objectType: string; // "pesanan", "stok", "staf", "demo"
  objectId?: string | number;
  summary?: string;
  locationId?: number | null;
  before?: unknown;
  after?: unknown;
  at?: Date;
};

export async function writeAudit(db: AnyDb, a: AuditInput) {
  await db.insert(schema.auditLogs).values({
    staffId: a.staff?.id ?? null,
    actorName: a.staff?.name ?? "sistem",
    action: a.action,
    objectType: a.objectType,
    objectId: a.objectId != null ? String(a.objectId) : "",
    summary: a.summary ?? "",
    locationId: a.locationId ?? null,
    before: (a.before ?? null) as object | null,
    after: (a.after ?? null) as object | null,
    ...(a.at ? { createdAt: a.at } : {}),
  });
}

export const AUDIT_ACTIONS: Record<string, string> = {
  "pesanan.status": "Ubah status pesanan",
  "pesanan.batal": "Batalkan pesanan",
  "pesanan.massal": "Aksi massal pesanan",
  "stok.masuk": "Stok masuk",
  "stok.transfer": "Transfer stok",
  "stok.opname": "Opname",
  "staf.tambah": "Tambah akun staf",
  "staf.ubah": "Ubah akun staf",
  "staf.nonaktif": "Nonaktifkan akun staf",
  "staf.aktif": "Aktifkan akun staf",
  "staf.sandi": "Atur ulang kata sandi",
  "staf.masuk": "Staf masuk",
  "staf.masuk_gagal": "Staf gagal masuk",
  "staf.keluar": "Staf keluar",
  "demo.reset": "Reset data demo",
  "produk.tambah": "Tambah produk",
  "produk.ubah": "Ubah produk",
  "produk.status": "Ubah status produk",
  "produk.hapus": "Hapus produk",
  "kategori.tambah": "Tambah kategori",
  "kategori.ubah": "Ubah kategori",
  "kategori.urut": "Ubah susunan kategori",
  "kategori.pindah": "Pindahkan produk kategori",
  "kategori.hapus": "Hapus kategori",
  "merek.tambah": "Tambah merek",
  "merek.ubah": "Ubah merek",
  "merek.hapus": "Hapus merek",
  "promo.flash_slot": "Slot flash sale",
  "promo.flash_item": "Item flash sale",
  "promo.harga": "Harga promo varian",
  "promo.voucher": "Voucher",
  "promo.banner": "Banner",
  "promo.promobar": "PromoBar",
  "pengaturan.ubah": "Ubah pengaturan",
  "pengaturan.cabang": "Ubah cabang",
  "ulasan.sembunyi": "Sembunyikan ulasan",
  "ulasan.tampil": "Tampilkan ulasan",
  "ulasan.balas": "Balas ulasan",
  "ulasan.hapus_balasan": "Hapus balasan ulasan",
  "pelanggan.poin": "Sesuaikan poin pelanggan",
  "notifikasi.kirim_ulang": "Kirim ulang notifikasi",
  "laporan.unduh": "Unduh laporan Excel",
};
