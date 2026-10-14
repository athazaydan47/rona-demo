// Penerjemah periode Asisten Admin (deterministik, bukan AI). Kosakata sehari-hari diterjemahkan dengan jam server
// dan batas hari WIB menjadi rentang setengah terbuka [from, to). Maksimal 366 hari. Periode yang memuat hari ini
// ditandai sementara karena harinya belum selesai.
import { MAX_CUSTOM_DAYS, previousRange, wibDayKey, wibDayStart } from "@/lib/reports";
import { formatDateWib, toWibParts, wibDate } from "@/lib/format";

const DAY = 86_400_000;

export type Periode = {
  from: Date;
  to: Date;
  firstDay: string; // "2026-10-12"
  lastDay: string;
  days: number;
  label: string; // "minggu ini (12 sampai 14 Okt 2026)"
  sementara: boolean; // memuat hari ini, angka bisa masih bertambah
};
export type PeriodeResult = { ok: true; periode: Periode } | { ok: false; message: string };

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, ags: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

function make(name: string, from: Date, to: Date, now: Date): PeriodeResult {
  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  if (days <= 0) return { ok: false, message: "Tanggal selesai harus sama atau setelah tanggal mulai." };
  if (days > MAX_CUSTOM_DAYS) return { ok: false, message: `Periode maksimal ${MAX_CUSTOM_DAYS} hari. Persempit periodenya, ya.` };
  if (from.getTime() > now.getTime()) return { ok: false, message: "Periode itu belum terjadi." };
  const last = new Date(to.getTime() - 1);
  const span = days === 1 ? formatDateWib(from) : `${formatDateWib(from)} sampai ${formatDateWib(last)}`;
  const sementara = to.getTime() > now.getTime();
  return { ok: true, periode: { from, to, firstDay: wibDayKey(from), lastDay: wibDayKey(last), days, label: name ? `${name} (${span})` : span, sementara } };
}

function parseDate(s: string, now: Date): Date | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return wibDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = new RegExp(`^(\\d{1,2})\\s*(${MONTH_RE})\\.?\\s*(\\d{4})?$`).exec(t);
  if (m) return wibDate(m[3] ? Number(m[3]) : toWibParts(now).year, MONTHS[m[2]], Number(m[1]));
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(t);
  if (m) return wibDate(m[3] ? Number(m[3]) : toWibParts(now).year, Number(m[2]), Number(m[1]));
  return null;
}

// Senin 00.00 WIB dari minggu yang memuat `d`.
export function mondayOf(d: Date) {
  const p = toWibParts(d);
  return wibDate(p.year, p.month, p.day - ((p.weekday + 6) % 7));
}

export function parsePeriode(input: string | null | undefined, now: Date, fallback = "30 hari terakhir"): PeriodeResult {
  const raw = (input ?? "").toLowerCase().replace(/\s+/g, " ").trim() || fallback;
  const q = raw.replace(/^(selama|untuk|pada|di|periode)\s+/, "");
  const today = wibDayStart(now);
  const tomorrow = wibDayStart(now, -1);
  const p = toWibParts(now);

  if (/^(hari ini|today)$/.test(q)) return make("hari ini", today, tomorrow, now);
  if (/^(kemarin|kmrn|yesterday)$/.test(q)) return make("kemarin", wibDayStart(now, 1), today, now);
  if (/^(kemarin lusa|2 hari (yang )?lalu)$/.test(q)) return make("kemarin lusa", wibDayStart(now, 2), wibDayStart(now, 1), now);
  if (/^(minggu ini|pekan ini)$/.test(q)) return make("minggu ini", mondayOf(now), tomorrow, now);
  if (/^(minggu lalu|pekan lalu|minggu kemarin)$/.test(q)) {
    const mon = mondayOf(now);
    return make("minggu lalu", new Date(mon.getTime() - 7 * DAY), mon, now);
  }
  if (/^bulan ini$/.test(q)) return make("bulan ini", wibDate(p.year, p.month, 1), tomorrow, now);
  if (/^(bulan lalu|bulan kemarin)$/.test(q)) return make("bulan lalu", wibDate(p.year, p.month - 1, 1), wibDate(p.year, p.month, 1), now);
  if (/^tahun ini$/.test(q)) return make("tahun ini", wibDate(p.year, 1, 1), tomorrow, now);
  if (/^(seminggu|sepekan)( terakhir)?$/.test(q)) return make("7 hari terakhir", wibDayStart(now, 6), tomorrow, now);
  if (/^sebulan( terakhir)?$/.test(q)) return make("30 hari terakhir", wibDayStart(now, 29), tomorrow, now);
  let m = /^(\d{1,3}) hari( terakhir)?$/.exec(q);
  if (m) {
    const n = Number(m[1]);
    if (n < 1 || n > MAX_CUSTOM_DAYS) return { ok: false, message: `Periode maksimal ${MAX_CUSTOM_DAYS} hari. Persempit periodenya, ya.` };
    return make(`${n} hari terakhir`, wibDayStart(now, n - 1), tomorrow, now);
  }
  // "oktober 2026", "okt", "september"
  m = new RegExp(`^(?:bulan )?(${MONTH_RE})\\.?(?:\\s+(\\d{4}))?$`).exec(q);
  if (m) {
    const month = MONTHS[m[1]];
    const year = m[2] ? Number(m[2]) : month > p.month ? p.year - 1 : p.year;
    const from = wibDate(year, month, 1);
    const end = wibDate(year, month + 1, 1);
    return make(`${["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][month]} ${year}`, from, end.getTime() > tomorrow.getTime() ? tomorrow : end, now);
  }
  // Rentang tanggal: "2026-10-01 sampai 2026-10-07", "1 sampai 7 okt 2026", "1-7 okt", "1 okt sampai 5 okt"
  m = new RegExp(`^(\\d{1,2})\\s*(?:-|sampai|sd|s\\.d\\.|hingga)\\s*(\\d{1,2})\\s+(${MONTH_RE})\\.?(?:\\s+(\\d{4}))?$`).exec(q);
  if (m) {
    const y = m[4] ? Number(m[4]) : p.year;
    return make("", wibDate(y, MONTHS[m[3]], Number(m[1])), wibDate(y, MONTHS[m[3]], Number(m[2]) + 1), now);
  }
  const parts = q.split(/\s+(?:sampai|hingga|sd|s\.d\.|-)\s+|\s*\.\.\s*/);
  if (parts.length === 2) {
    const a = parseDate(parts[0], now);
    const b = parseDate(parts[1], now);
    if (a && b) return make("", a, new Date(b.getTime() + DAY), now);
  }
  const single = parseDate(q, now);
  if (single) return make("", single, new Date(single.getTime() + DAY), now);
  return { ok: false, message: `Periode "${input}" belum kami kenali. Contoh: hari ini, kemarin, minggu ini, bulan lalu, 30 hari terakhir, atau 1 sampai 7 Okt 2026.` };
}

// Pembanding: periode yang disebut, atau panjang yang sama tepat sebelumnya.
export function parsePembanding(input: string | null | undefined, utama: Periode, now: Date): PeriodeResult {
  if (input && input.trim()) return parsePeriode(input, now);
  const r = previousRange(utama);
  return make("periode sebelumnya", r.from, r.to, now);
}

export const PERIODE_CONTOH = "hari ini, kemarin, minggu ini, minggu lalu, bulan ini, bulan lalu, 7 hari terakhir, 30 hari terakhir, tahun ini, nama bulan (Oktober 2026), atau tanggal (2026-10-01 sampai 2026-10-07)";
