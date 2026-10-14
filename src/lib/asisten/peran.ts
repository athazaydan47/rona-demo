// Pembatasan peran untuk hasil tool Asisten Admin, ditegakkan di struktur data (bukan di UI):
// - Kolom rupiah memakai akhiran "Rp" (misal omzetRp). Tanpa izin laporan.keuangan, semua kolom itu dihapus dari
//   hasil tool sebelum dikirim ke model.
// - Kolom kontak (nomorWa, email) disamarkan tanpa izin pelanggan.kontak.
// - Staf yang mengampu lokasi tertentu otomatis terkunci ke lokasinya.
import { allLocations, can, type StaffPrincipal } from "@/lib/admin/permissions";

export const MONEY_SUFFIX = "Rp";
export const CONTACT_KEYS = new Set(["nomorWa", "email"]);
export const HIDDEN_MONEY_NOTE = "Angka rupiah disembunyikan karena kamu tidak punya izin melihat angka keuangan.";

export function maskPhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length <= 6 ? "****" : `${d.slice(0, 4)}****${d.slice(-3)}`;
}
export function maskEmail(e: string) {
  const [user, domain] = e.split("@");
  return domain ? `${user.slice(0, 1)}***@${domain}` : "***";
}

export function stripMoney(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripMoney);
  if (v && typeof v === "object" && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).filter(([k]) => !k.endsWith(MONEY_SUFFIX)).map(([k, x]) => [k, stripMoney(x)]));
  return v;
}

export function maskContacts(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(maskContacts);
  if (v && typeof v === "object" && !(v instanceof Date))
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, CONTACT_KEYS.has(k) && typeof x === "string" ? (k === "email" ? maskEmail(x) : maskPhone(x)) : maskContacts(x)]));
  return v;
}

// Terapkan izin ke hasil tool. Mengembalikan hasil baru (tidak mengubah aslinya).
export function applyRole(staff: StaffPrincipal, result: Record<string, unknown>): Record<string, unknown> {
  let out: unknown = result;
  const notes: string[] = [];
  if (!can(staff, "laporan.keuangan")) {
    const before = JSON.stringify(out);
    out = stripMoney(out);
    if (JSON.stringify(out) !== before) notes.push(HIDDEN_MONEY_NOTE);
  }
  if (!can(staff, "pelanggan.kontak")) out = maskContacts(out);
  const o = out as Record<string, unknown>;
  return notes.length ? { ...o, catatanIzin: notes.join(" ") } : o;
}

// Lokasi yang boleh dipakai tool: staf terkunci ke lokasinya; lokasi yang diminta di luar cakupan diabaikan.
export function lockedLocations(staff: StaffPrincipal, requested: number | null): { ids: number[] | null; locked: boolean; ignored: boolean } {
  if (allLocations(staff)) return { ids: requested ? [requested] : null, locked: false, ignored: false };
  if (requested && staff.locationIds.includes(requested)) return { ids: [requested], locked: true, ignored: false };
  return { ids: staff.locationIds, locked: true, ignored: requested != null };
}
