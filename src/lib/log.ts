// Log terstruktur di server (Fase 8B): satu baris JSON per peristiwa, mudah dicari di log Vercel (misal cari
// "pesanan.dibuat"). Nomor WA, email, token, dan kata sandi disamarkan sebelum ditulis. Jangan pernah mencatat isi
// percakapan AI, OTP, atau alamat lengkap.

export type Level = "info" | "warn" | "error";

const KUNCI_RAHASIA = /token|secret|password|sandi|otp|kode|authorization|cookie/i;

// Samarkan nomor telepon (sisakan 3 digit terakhir) dan email (sisakan huruf pertama dan domain).
export function samarkan(value: string): string {
  return value
    .replace(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, domain: string) => `${m[0]}***@${domain}`)
    .replace(/(?:\+?62|0)8\d{7,12}/g, (m) => `${m.slice(0, 2)}***${m.slice(-3)}`);
}

export function bersihkan(fields: Record<string, unknown>, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (KUNCI_RAHASIA.test(k)) out[k] = "[disembunyikan]";
    else if (typeof v === "string") out[k] = samarkan(v).slice(0, 500);
    else if (v instanceof Error) out[k] = samarkan(v.message).slice(0, 500);
    else if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) out[k] = bersihkan(v as Record<string, unknown>, depth + 1);
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => (typeof x === "string" ? samarkan(x) : x));
    else out[k] = v;
  }
  return out;
}

export function logEvent(event: string, fields: Record<string, unknown> = {}, level: Level = "info") {
  if (process.env.VITEST && !process.env.LOG_SAAT_UJI) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...bersihkan(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
