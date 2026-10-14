// Label ketersediaan per lokasi: murni, tanpa database, diuji di availability.test.ts.
import type { OpeningHours } from "@/db/schema";
import { toWibParts } from "@/lib/format";

const DAY_KEYS: (keyof OpeningHours)[] = ["min", "sen", "sel", "rab", "kam", "jum", "sab"];

function parseClock(s: string) {
  const [h, m] = s.split(".").map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export type LocationFlags = { openNow: boolean; shipsToday: boolean; pickupToday: boolean };

export type Cutoff = { ship: string; pickup: string; sundayOff: boolean };
export const DEFAULT_CUTOFF: Cutoff = { ship: "15.00", pickup: "16.00", sundayOff: true };

// Tanggal WIB "2026-10-14" untuk dicocokkan dengan hari libur cabang.
const wibDateKey = (p: ReturnType<typeof toWibParts>) => `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;

// Gudang: "Dikirim hari ini" bila sebelum cut-off kirim (bawaan 15.00 WIB), Senin sampai Sabtu (Minggu libur bila diatur).
// Toko: "Bisa diambil hari ini" bila sebelum cut-off ambil (bawaan 16.00 WIB) dan sedang buka. Hari libur cabang dianggap tutup.
export function locationFlags(loc: { type: "gudang" | "toko"; openingHours: OpeningHours | null; closedDates?: string[] | null }, now: Date, cutoff: Cutoff = DEFAULT_CUTOFF): LocationFlags {
  const p = toWibParts(now);
  const minutes = p.hour * 60 + p.minute;
  const holiday = Boolean(loc.closedDates?.includes(wibDateKey(p)));
  const today = holiday ? null : (loc.openingHours?.[DAY_KEYS[p.weekday]] ?? null);
  const openNow = today ? minutes >= parseClock(today.open) && minutes < parseClock(today.close) : false;
  const workday = p.weekday !== 0 || !cutoff.sundayOff;
  const shipsToday = loc.type === "gudang" && workday && !holiday && minutes < parseClock(cutoff.ship);
  const pickupToday = loc.type === "toko" && openNow && minutes < parseClock(cutoff.pickup);
  return { openNow, shipsToday, pickupToday };
}

// Jam buka hari ini untuk kartu cabang (Toko kami dan chat asisten): "Buka 09.00 sampai 21.00" atau "Tutup hari ini".
export function jamHariIni(loc: { openingHours: OpeningHours | null; closedDates?: string[] | null }, now: Date): string {
  const p = toWibParts(now);
  if (loc.closedDates?.includes(wibDateKey(p))) return "Tutup hari ini (libur)";
  const today = loc.openingHours?.[DAY_KEYS[p.weekday]] ?? null;
  return today ? `Buka ${today.open} sampai ${today.close}` : "Tutup hari ini";
}

export type StockTone = "habis" | "terbatas" | "tersedia";

export function stockLabel(qty: number): { text: string; tone: StockTone } {
  if (qty <= 0) return { text: "Habis", tone: "habis" };
  if (qty <= 5) return { text: `Stok terbatas, sisa ${qty}`, tone: "terbatas" };
  return { text: `Tersedia ${qty}`, tone: "tersedia" };
}

// Keterangan kirim atau ambil untuk lokasi dengan stok; null bila habis.
export function fulfillmentHint(loc: { type: "gudang" | "toko" } & LocationFlags, qty: number): { text: string; good: boolean } | null {
  if (qty <= 0) return null;
  if (loc.type === "gudang") return loc.shipsToday ? { text: "Dikirim hari ini", good: true } : { text: "Dikirim hari kerja berikutnya", good: false };
  if (loc.pickupToday) return { text: "Bisa diambil hari ini", good: true };
  if (loc.openNow) return { text: "Ambil setelah pesan, sebelum tutup", good: false };
  return { text: "Toko sedang tutup, ambil besok", good: false };
}
