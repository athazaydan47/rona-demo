// Satu sumber tarif AI dan kurs rupiah. Dipakai panel Kesehatan AI, npm run eval:ai, npm run eval:asisten, dan
// perhitungan RAB klien. Tarif per 1 juta token (USD) dari https://ai.google.dev/gemini-api/docs/pricing, dicek
// 14 Okt 2026. Token keluar sudah termasuk token berpikir. Ubah di sini bila tarif atau kurs berubah.

export type ModelPrice = { input: number; output: number; from: string; until?: string }; // tanggal WIB "YYYY-MM-DD", until eksklusif
export const AI_PRICES: Record<string, ModelPrice[]> = {
  "gemini-3.6-flash": [
    { input: 0.75, output: 3.75, from: "2026-01-01", until: "2027-01-01" },
    { input: 1.5, output: 7.5, from: "2027-01-01" },
  ],
  "gemini-3.8-flash": [
    { input: 0.75, output: 3.75, from: "2026-01-01", until: "2027-01-01" },
    { input: 1.5, output: 7.5, from: "2027-01-01" },
  ],
  "gemini-3.5-flash-lite": [{ input: 0.3, output: 2.5, from: "2026-01-01" }],
  "gemini-3.1-flash-lite": [{ input: 0.25, output: 1.5, from: "2026-01-01" }],
};

// Kurs untuk perkiraan biaya dalam rupiah (asumsi, bukan kurs harian).
export const IDR_PER_USD = 16_500;
export const IDR_RATE_NOTE = "kurs asumsi Rp 16.500 per US$1";

const wibDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

// Tarif yang berlaku untuk model pada waktu tertentu; null bila model tidak ada di halaman harga resmi.
export function priceFor(model: string, at: Date = new Date()): ModelPrice | null {
  const day = wibDay(at);
  return AI_PRICES[model]?.find((p) => p.from <= day && (!p.until || day < p.until)) ?? null;
}

export function costUsd(model: string, inputTokens: number, outputTokens: number, at: Date = new Date()): number | null {
  const p = priceFor(model, at);
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function costIdr(model: string, inputTokens: number, outputTokens: number, at: Date = new Date()): number | null {
  const usd = costUsd(model, inputTokens, outputTokens, at);
  return usd == null ? null : usd * IDR_PER_USD;
}

// Tarif berikutnya yang sudah dijadwalkan (untuk catatan "naik mulai ...").
export function nextPriceChange(model: string, at: Date = new Date()): ModelPrice | null {
  const day = wibDay(at);
  return AI_PRICES[model]?.find((p) => p.from > day) ?? null;
}
