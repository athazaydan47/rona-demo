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
};
