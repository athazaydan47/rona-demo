// Spasi tak putus (U+00A0) supaya "Rp" dan angkanya tidak pernah patah di baris berbeda.
export const NBSP = "\u00A0";

// Uang: bilangan bulat rupiah, ditampilkan "Rp 129.000" dengan spasi tak putus setelah "Rp".
export function formatRupiah(amount: number) {
  const abs = Math.abs(Math.round(amount));
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "-" : ""}Rp${NBSP}${grouped}`;
}

// Angka biasa dengan titik ribuan: 1.250
export function formatNumber(n: number) {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

type WibParts = {
  year: number;
  month: number; // 1 sampai 12
  day: number;
  weekday: number; // 0 Minggu sampai 6 Sabtu
  hour: number;
  minute: number;
};

// Pecah tanggal UTC menjadi bagian-bagian dalam zona Asia/Jakarta (UTC+7, tanpa DST).
export function toWibParts(date: Date): WibParts {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// "13 Okt 2026"
export function formatDateWib(date: Date) {
  const p = toWibParts(date);
  return `${p.day} ${MONTHS_ID[p.month - 1]} ${p.year}`;
}

// "14.30 WIB"
export function formatTimeWib(date: Date) {
  const p = toWibParts(date);
  return `${pad2(p.hour)}.${pad2(p.minute)} WIB`;
}

// "13 Okt 2026, 14.30 WIB"
export function formatDateTimeWib(date: Date) {
  return `${formatDateWib(date)}, ${formatTimeWib(date)}`;
}

export function weekdayNameId(weekday: number) {
  return DAYS_ID[weekday] ?? "";
}

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

// Bangun Date UTC dari jam WIB, berguna untuk seed dan slot flash sale.
export function wibDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

// Angka ringkas ala Indonesia: 850, 1,2 rb, 12 rb, 1,5 jt.
export function formatCompactNumber(n: number) {
  const one = (v: number, unit: string) => {
    const s = v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(".0", "").replace(".", ",");
    return `${s} ${unit}`;
  };
  if (n >= 1_000_000) return one(n / 1_000_000, "jt");
  if (n >= 1000) return one(n / 1000, "rb");
  return n.toString();
}
