// Padanan shade berbasis aturan (tanpa AI). Murni dan teruji.
// Skor jarak gabungan, makin kecil makin mirip:
//   skor = 0,6 x (deltaE / 20) + 0,25 x (selisih kedalaman / 5) + 0,15 x (undertone beda ? 1 : 0)
// deltaE memakai CIE76 di ruang CIELAB (D65) dari kode hex sRGB. deltaE 20 dianggap "jauh sekali" (dipotong di 1),
// kedalaman 1 sampai 6 sehingga selisih maksimal 5. Undertone neutral dianggap setengah cocok dengan warm atau cool.

export const SHADE_WEIGHTS = { color: 0.6, depth: 0.25, undertone: 0.15 } as const;
export const DELTA_E_FAR = 20;

export type Lab = { L: number; a: number; b: number };

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function hexToLab(hex: string): Lab {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Kode warna tidak valid: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(srgbToLinear);
  // sRGB ke XYZ (D65), lalu ke Lab dengan titik putih D65.
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE(a: Lab, b: Lab) {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export type ShadeInput = { id: number; hex: string; depth: number | null; undertone: string | null };

function undertonePenalty(a: string | null, b: string | null) {
  if (!a || !b || a === b) return 0;
  if (a === "neutral" || b === "neutral") return 0.5;
  return 1;
}

export function shadeDistance(from: ShadeInput, to: ShadeInput) {
  const labA = hexToLab(from.hex);
  const labB = hexToLab(to.hex);
  const dE = deltaE(labA, labB);
  const depthDiff = from.depth != null && to.depth != null ? Math.abs(from.depth - to.depth) : 1;
  const under = undertonePenalty(from.undertone, to.undertone);
  const score = SHADE_WEIGHTS.color * Math.min(1, dE / DELTA_E_FAR) + SHADE_WEIGHTS.depth * Math.min(1, depthDiff / 5) + SHADE_WEIGHTS.undertone * under;
  return { score: Math.round(score * 1000) / 1000, deltaE: Math.round(dE * 10) / 10, depthDiff, lightnessDiff: labB.L - labA.L, undertonePenalty: under };
}

const UNDERTONE_LABEL: Record<string, string> = { warm: "warm", neutral: "neutral", cool: "cool" };

// Alasan singkat dalam bahasa sehari-hari, misal "sedikit lebih terang, undertone sama".
export function shadeReason(from: ShadeInput, to: ShadeInput, d: ReturnType<typeof shadeDistance>) {
  const parts: string[] = [];
  const dl = d.lightnessDiff;
  if (d.deltaE < 3) parts.push("warnanya hampir sama");
  else if (Math.abs(dl) < 2) parts.push("kecerahan setara");
  else parts.push(`${Math.abs(dl) < 6 ? "sedikit" : "jauh"} lebih ${dl > 0 ? "terang" : "gelap"}`);
  if (!from.undertone || !to.undertone) parts.push("undertone tidak tercatat");
  else if (from.undertone === to.undertone) parts.push("undertone sama");
  else parts.push(`undertone ${UNDERTONE_LABEL[to.undertone] ?? to.undertone}, bukan ${UNDERTONE_LABEL[from.undertone] ?? from.undertone}`);
  return parts.join(", ");
}

export type ShadeCandidate<T extends ShadeInput> = T & { score: number; deltaE: number; reason: string };

// 3 shade terdekat (urutan skor naik, lalu deltaE, lalu id supaya deterministik).
export function rankShades<T extends ShadeInput>(from: ShadeInput, candidates: T[], limit = 3): ShadeCandidate<T>[] {
  return candidates
    .filter((c) => c.id !== from.id)
    .map((c) => {
      const d = shadeDistance(from, c);
      return { ...c, score: d.score, deltaE: d.deltaE, reason: shadeReason(from, c, d) };
    })
    .sort((a, b) => a.score - b.score || a.deltaE - b.deltaE || a.id - b.id)
    .slice(0, limit);
}

// Kelompok kategori shade: dipakai bila produk lain di kategori yang sama terlalu sedikit.
export const SHADE_GROUPS: Record<string, string> = {
  cushion: "wajah",
  foundation: "wajah",
  concealer: "wajah",
  bedak: "wajah",
  "tinted-sunscreen": "wajah",
  lipstick: "bibir",
  "lip-tint": "bibir",
  "lip-cream": "bibir",
  "lip-gloss": "bibir",
  "lip-balm-dan-lip-care": "bibir",
  blush: "pipi",
  "highlighter-dan-contour": "pipi",
};
export const isShadeCategory = (slug: string) => slug in SHADE_GROUPS;
