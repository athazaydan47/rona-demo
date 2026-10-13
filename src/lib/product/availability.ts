// Label ketersediaan per lokasi: murni, tanpa database, diuji di availability.test.ts.
import type { OpeningHours } from "@/db/schema";
import { toWibParts } from "@/lib/format";

const DAY_KEYS: (keyof OpeningHours)[] = ["min", "sen", "sel", "rab", "kam", "jum", "sab"];

function parseClock(s: string) {
  const [h, m] = s.split(".").map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export type LocationFlags = { openNow: boolean; shipsToday: boolean; pickupToday: boolean };

// Gudang: "Dikirim hari ini" bila sebelum 15.00 WIB, Senin sampai Sabtu. Toko: "Bisa diambil hari ini" bila sebelum 16.00 WIB dan sedang buka.
export function locationFlags(loc: { type: "gudang" | "toko"; openingHours: OpeningHours | null }, now: Date): LocationFlags {
  const p = toWibParts(now);
  const minutes = p.hour * 60 + p.minute;
  const today = loc.openingHours?.[DAY_KEYS[p.weekday]] ?? null;
  const openNow = today ? minutes >= parseClock(today.open) && minutes < parseClock(today.close) : false;
  const shipsToday = loc.type === "gudang" && p.weekday >= 1 && p.weekday <= 6 && p.hour < 15;
  const pickupToday = loc.type === "toko" && openNow && p.hour < 16;
  return { openNow, shipsToday, pickupToday };
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
