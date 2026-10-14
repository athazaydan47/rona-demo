// Rahasia untuk HMAC kode OTP dan IP. Wajib diisi di produksi (SESSION_SECRET); di lokal ada nilai cadangan.
const DEV_FALLBACK = "dev-secret-jangan-dipakai-di-produksi";

export function authSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = env.SESSION_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (env.NODE_ENV === "production" && env.VERCEL) return null;
  return DEV_FALLBACK;
}
