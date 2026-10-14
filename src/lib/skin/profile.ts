// Profil kulit: jawaban kuis ke SkinProfile, penyimpanan cookie untuk tamu, dan aturan penggabungan saat masuk.
// Murni (tanpa Next dan database) supaya bisa diuji.
import type { SkinProfile } from "@/db/schema/customers";
import { sanitizeSkinProfile } from "@/lib/account/profile";
import { namaCookie } from "@/config/merek";

export const PROFILE_COOKIE = namaCookie("profil_kulit");
export const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 hari

export { BUDGET_OPTIONS, ROUTINE_OPTIONS } from "./options";

export type QuizAnswers = {
  skinType?: string;
  concerns?: string[];
  sensitivity?: string;
  budget?: number;
  undertone?: string;
  depth?: number;
  routine?: string;
};

export function quizToProfile(a: QuizAnswers, now: Date): SkinProfile {
  return sanitizeSkinProfile({ ...a, concerns: (a.concerns ?? []).slice(0, 3) }, "kuis", now);
}

// Profil lengkap untuk menyusun rutinitas: jenis kulit wajib ada.
export const isProfileUsable = (p: SkinProfile | null | undefined): p is SkinProfile => Boolean(p?.skinType);

export function encodeProfileCookie(p: SkinProfile) {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

export function decodeProfileCookie(value: string | undefined | null, now: Date): SkinProfile | null {
  if (!value || value.length > 2000) return null;
  try {
    const raw = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    const source = raw.source === "formulir" ? "formulir" : "kuis";
    const p = sanitizeSkinProfile(raw, source, now);
    if (typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))) p.updatedAt = raw.updatedAt;
    return p.skinType || p.undertone || p.depth ? p : null;
  } catch {
    return null;
  }
}

// Saat tamu masuk: profil dari cookie dipakai bila akun belum punya profil atau profil cookie lebih baru.
export function shouldAdoptGuestProfile(account: SkinProfile | null | undefined, guest: SkinProfile | null) {
  if (!guest) return false;
  if (!account || !isProfileUsable(account)) return true;
  return Date.parse(guest.updatedAt ?? "") > Date.parse(account.updatedAt ?? "");
}

// Gabungkan hasil Shade Finder (kedalaman dan undertone) ke profil yang ada tanpa menghapus jawaban lain.
export function withShade(p: SkinProfile | null, shade: { depth?: number; undertone?: string }, now: Date): SkinProfile {
  return sanitizeSkinProfile({ ...(p ?? {}), ...shade }, p?.source ?? "kuis", now);
}

// Hash pendek profil untuk kunci cache penjelasan AI (bukan data rahasia, hanya kunci).
export function profileKey(p: SkinProfile) {
  return [p.skinType ?? "", [...(p.concerns ?? [])].sort().join("+"), p.sensitivity ?? "", p.budget ?? "", p.undertone ?? "", p.depth ?? ""].join("|");
}
