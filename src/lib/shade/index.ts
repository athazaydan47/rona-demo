import { kunciLokal } from "@/config/merek";
// Shade Finder berbasis aturan: cocokkan kedalaman kulit (1 sampai 6) dan undertone dengan data varian.
export type Undertone = "warm" | "neutral" | "cool";

export type SkinProfile = { depth: number; undertone: Undertone };

export const depthLabels: { depth: number; label: string; hex: string; hint: string }[] = [
  { depth: 1, label: "Sangat terang", hex: "#F6E3D3", hint: "Mudah merah bila kena matahari" },
  { depth: 2, label: "Terang", hex: "#F0D2B8", hint: "Kuning langsat terang" },
  { depth: 3, label: "Sedang terang", hex: "#E2BB97", hint: "Kuning langsat" },
  { depth: 4, label: "Sedang", hex: "#CFA077", hint: "Sawo matang muda" },
  { depth: 5, label: "Sawo matang", hex: "#B07F57", hint: "Sawo matang" },
  { depth: 6, label: "Gelap", hex: "#8A5B3A", hint: "Cokelat tua" },
];

export const undertoneGuide: { value: Undertone; label: string; hint: string; hex: string }[] = [
  { value: "warm", label: "Warm", hint: "Urat nadi tampak kehijauan, perhiasan emas lebih menyatu.", hex: "#E4B089" },
  { value: "neutral", label: "Neutral", hint: "Urat nadi campuran hijau dan biru, emas dan perak sama cocok.", hex: "#D9AC8E" },
  { value: "cool", label: "Cool", hint: "Urat nadi tampak kebiruan, perhiasan perak lebih menyatu.", hex: "#D8A99A" },
];

export type ShadeCandidate = { id: number; shadeName: string; hex: string; undertone: Undertone | null; depth: number | null };

export type ShadeSuggestion<T extends ShadeCandidate> = { variant: T; score: number; reason: string };

export function undertoneDistance(a: Undertone, b: Undertone | null) {
  if (!b) return 1.5;
  if (a === b) return 0;
  if (a === "neutral" || b === "neutral") return 1;
  return 2;
}

// Skor lebih kecil lebih cocok: selisih kedalaman diberi bobot 2, selisih undertone bobot 1.
export function scoreShade(profile: SkinProfile, v: ShadeCandidate) {
  const depthDiff = v.depth == null ? 2.5 : Math.abs(v.depth - profile.depth);
  return depthDiff * 2 + undertoneDistance(profile.undertone, v.undertone);
}

export function suggestShades<T extends ShadeCandidate>(variants: T[], profile: SkinProfile, count = 3): ShadeSuggestion<T>[] {
  const scored = variants
    .filter((v) => v.depth != null || v.undertone != null)
    .map((v) => ({ variant: v, score: scoreShade(profile, v), reason: "" }))
    // Seri: utamakan shade yang sedikit lebih gelap, karena lebih menyatu dengan leher daripada yang lebih terang.
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number((a.variant.depth ?? 0) < profile.depth) - Number((b.variant.depth ?? 0) < profile.depth) ||
        a.variant.shadeName.localeCompare(b.variant.shadeName, "id"),
    );
  return scored.slice(0, count).map((s, i) => ({ ...s, reason: explain(profile, s.variant, i === 0) }));
}

function explain(profile: SkinProfile, v: ShadeCandidate, best: boolean) {
  const parts: string[] = [];
  if (v.depth == null) parts.push("kedalaman tidak dicatat");
  else if (v.depth === profile.depth) parts.push("kedalaman pas");
  else if (v.depth < profile.depth) parts.push(`${profile.depth - v.depth} tingkat lebih terang`);
  else parts.push(`${v.depth - profile.depth} tingkat lebih gelap`);
  if (!v.undertone) parts.push("undertone netral");
  else if (v.undertone === profile.undertone) parts.push("undertone sama");
  else if (v.undertone === "neutral" || profile.undertone === "neutral") parts.push(`undertone ${v.undertone} masih menyatu`);
  else parts.push(`undertone ${v.undertone}, berlawanan`);
  const lead = best ? "Paling cocok: " : "Alternatif: ";
  return lead + parts.join(", ") + ".";
}

// Apakah sebuah shade layak diberi tanda "Cocok untukmu": kedalaman tepat atau selisih 1 dengan undertone cocok.
export function isGoodMatch(profile: SkinProfile, v: ShadeCandidate) {
  return scoreShade(profile, v) <= 2;
}

export const SHADE_PROFILE_KEY = kunciLokal("shade-profile");

export function parseProfile(raw: string | null): SkinProfile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SkinProfile>;
    if (typeof p.depth !== "number" || p.depth < 1 || p.depth > 6) return null;
    if (p.undertone !== "warm" && p.undertone !== "neutral" && p.undertone !== "cool") return null;
    return { depth: p.depth, undertone: p.undertone };
  } catch {
    return null;
  }
}
