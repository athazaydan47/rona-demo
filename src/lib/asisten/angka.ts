// Penjaga angka Asisten Admin: setiap angka di teks jawaban (dan tabel) harus ada di hasil tool, setelah normalisasi
// format rupiah ("Rp 12.345.678", "Rp 12,3 juta", "12 rb"), persen ("12,5%"), desimal Indonesia, dan pembulatan.
// Angka bulat kecil (0 sampai 10) tanpa satuan boleh (bilangan hitung seperti "3 produk"). Murni dan teruji.

export type TextNumber = { raw: string; value: number; kind: "rupiah" | "persen" | "skala" | "biasa"; scale: number };

const parseId = (s: string) => {
  // "12.345.678" (ribuan) atau "12,5" (desimal) atau "1.234,5".
  const t = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d+,\d+$/.test(t)) return Number(t.replace(",", "."));
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return Number.NaN;
};

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?`;
const RE = new RegExp(String.raw`(Rp\.?\s?)?(${NUM})\s*(juta|jt|ribu|rb|miliar|m\b)?\s*(%|persen)?`, "gi");
const SCALE: Record<string, number> = { juta: 1e6, jt: 1e6, ribu: 1e3, rb: 1e3, miliar: 1e9, m: 1e9 };

export function numbersInText(text: string): TextNumber[] {
  const out: TextNumber[] = [];
  for (const m of text.matchAll(RE)) {
    const value = parseId(m[2]);
    if (!Number.isFinite(value)) continue;
    const scaleWord = m[3]?.toLowerCase();
    const scale = scaleWord ? SCALE[scaleWord] : 1;
    const kind = m[4] ? "persen" : m[1] ? "rupiah" : scaleWord ? "skala" : "biasa";
    out.push({ raw: m[0].trim(), value: value * scale, kind, scale });
  }
  return out;
}

// Semua angka di hasil tool: nilai angka, panjang daftar, dan angka di dalam teks (misal tanggal di label periode).
export function collectToolNumbers(results: unknown[]): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    // Tanda minus tidak ikut terbaca di teks ("turun 3,2%"), jadi nilai mutlaknya juga dipakai.
    if (typeof v === "number" && Number.isFinite(v)) out.push(v, Math.abs(v));
    else if (typeof v === "string") for (const n of numbersInText(v)) out.push(n.value);
    else if (Array.isArray(v)) {
      out.push(v.length);
      v.forEach(walk);
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  results.forEach(walk);
  return out;
}

const round = (n: number, step: number) => Math.round(n / step) * step;

// Angka teks cocok dengan angka tool: sama persis, sama setelah dibulatkan 1 desimal (persen dan desimal), atau sama
// pada skala yang ditulis (12,3 juta cocok dengan 12.345.678; 12 juta juga cocok bila dibulatkan ke juta).
export function matchesSource(n: TextNumber, pool: number[]): boolean {
  if (n.kind === "biasa" && Number.isInteger(n.value) && n.value >= 0 && n.value <= 10) return true;
  return pool.some((p) => {
    if (p === n.value) return true;
    if (Math.abs(round(p, 0.1) - n.value) < 1e-9) return true;
    if (Math.abs(Math.round(p) - n.value) < 1e-9 && n.kind !== "rupiah") return true;
    if (n.scale > 1) {
      for (const dec of [1, 0.1, 0.01]) if (Math.abs(round(p / n.scale, dec) * n.scale - n.value) < n.scale * 1e-6) return true;
    }
    return false;
  });
}

export function unsourcedNumbers(texts: string[], toolResults: unknown[], extraAllowed: string[] = []): string[] {
  const pool = [...collectToolNumbers(toolResults), ...extraAllowed.flatMap((t) => numbersInText(t).map((n) => n.value))];
  return texts.flatMap((t) => numbersInText(t).filter((n) => !matchesSource(n, pool)).map((n) => n.raw));
}
