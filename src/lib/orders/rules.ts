// Aturan murni pesanan: nomor pesanan, batas waktu bayar, gabung keranjang.
import type { OpeningHours } from "@/db/schema";
import { toWibParts, wibDate } from "@/lib/format";

export const PAYMENT_WINDOW_MINUTES = 15;

// "RONA-2610-000123": tahun dan bulan WIB, urutan 6 digit per bulan.
export function orderPeriod(date: Date) {
  const p = toWibParts(date);
  return `${String(p.year).slice(-2)}${String(p.month).padStart(2, "0")}`;
}

export function formatOrderNumber(period: string, seq: number) {
  if (!/^\d{4}$/.test(period)) throw new Error("Periode harus YYMM");
  if (!Number.isInteger(seq) || seq < 1) throw new Error("Urutan harus bilangan bulat positif");
  return `RONA-${period}-${String(seq).padStart(6, "0")}`;
}

export function parseOrderNumber(number: string) {
  const m = /^RONA-(\d{4})-(\d{6,})$/.exec(number.trim().toUpperCase());
  return m ? { period: m[1], seq: Number(m[2]) } : null;
}

const DAY_KEYS: (keyof OpeningHours)[] = ["min", "sen", "sel", "rab", "kam", "jum", "sab"];

// Bayar di Toko: berlaku sampai jam tutup cabang pada hari kerja berikutnya (Minggu dilewati, juga hari cabang tutup).
export function payAtStoreDeadline(openingHours: OpeningHours | null, now: Date): Date {
  const p = toWibParts(now);
  for (let add = 1; add <= 8; add++) {
    const day = new Date(wibDate(p.year, p.month, p.day, 12).getTime() + add * 86_400_000);
    const d = toWibParts(day);
    if (d.weekday === 0) continue; // Minggu bukan hari kerja
    const hours = openingHours?.[DAY_KEYS[d.weekday]];
    if (!hours) continue;
    const [h, m] = hours.close.split(".").map((x) => Number.parseInt(x, 10));
    return wibDate(d.year, d.month, d.day, h || 21, m || 0);
  }
  return new Date(now.getTime() + 2 * 86_400_000);
}

export function paymentDeadline(input: { paymentMethod: string; now: Date; openingHours?: OpeningHours | null }) {
  if (input.paymentMethod === "bayar_di_toko") return payAtStoreDeadline(input.openingHours ?? null, input.now);
  return new Date(input.now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);
}

export function isExpired(expiresAt: Date | null, now: Date) {
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

export type MergeItem = { variantId: number; quantity: number; savedForLater: boolean };

export const MAX_QTY_PER_ITEM = 10;

// Gabung keranjang tamu ke keranjang akun: jumlah dijumlahkan (maks 10), item aktif menang atas simpan untuk nanti.
export function mergeCartItems(account: MergeItem[], guest: MergeItem[]): MergeItem[] {
  const map = new Map<number, MergeItem>();
  for (const item of account) map.set(item.variantId, { ...item });
  for (const g of guest) {
    const cur = map.get(g.variantId);
    if (!cur) {
      map.set(g.variantId, { ...g, quantity: Math.min(MAX_QTY_PER_ITEM, g.quantity) });
      continue;
    }
    const bothActive = !cur.savedForLater && !g.savedForLater;
    cur.quantity = Math.min(MAX_QTY_PER_ITEM, bothActive ? cur.quantity + g.quantity : Math.max(cur.quantity, g.quantity));
    cur.savedForLater = cur.savedForLater && g.savedForLater;
  }
  return [...map.values()].filter((i) => i.quantity > 0);
}

// Validasi nomor WhatsApp Indonesia dan normalisasi ke format 08xx.
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[\s.()-]/g, "");
  if (digits.startsWith("+62")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("62")) digits = "0" + digits.slice(2);
  return /^08\d{8,12}$/.test(digits) ? digits : null;
}
