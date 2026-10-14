// Content Security Policy (Fase 8B). Next.js dengan cacheComponents memprarender kerangka halaman (PPR), dan nonce per
// permintaan tidak cocok dengan PPR (kerangka statis tidak bisa membawa nonce). Karena itu skrip inline Next
// (payload RSC self.__next_f) diizinkan dengan 'unsafe-inline', sementara sumber skrip eksternal dibatasi ke situs
// sendiri. Gambar, koneksi, dan bingkai dibatasi ke daftar host yang memang dipakai. Lihat docs/KEAMANAN.md.
//
// Mode: CSP_MODE=report-only mengirim Content-Security-Policy-Report-Only (pelanggaran hanya dilaporkan ke
// /api/csp-laporan), selain itu (bawaan) enforce. Dibaca saat build karena header ditulis ke manifest rute.

export type CspOptions = { dev?: boolean; https?: boolean };

// Host gambar luar: foto unggahan (Vercel Blob), ubin peta OpenStreetMap, dan sampul video TikTok atau YouTube untuk
// fitur cari dari video (hanya host yang diloloskan src/lib/ai/oembed.ts).
export const CSP_IMG_HOSTS = [
  "https://*.public.blob.vercel-storage.com",
  "https://tile.openstreetmap.org",
  "https://*.tile.openstreetmap.org",
  "https://*.tiktokcdn.com",
  "https://*.tiktokcdn-us.com",
  "https://*.tiktokcdn-eu.com",
  "https://*.ytimg.com",
];

export const CSP_REPORT_PATH = "/api/csp-laporan";

export function cspDirectives(opts: CspOptions = {}): Record<string, string[]> {
  return {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(opts.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...CSP_IMG_HOSTS],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(opts.dev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(opts.https ? { "upgrade-insecure-requests": [] } : {}),
    "report-uri": [CSP_REPORT_PATH],
    "report-to": ["csp"],
  };
}

export function cspHeaderValue(opts: CspOptions = {}) {
  return Object.entries(cspDirectives(opts))
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export function cspHeaders(env: Record<string, string | undefined> = process.env) {
  const value = cspHeaderValue({ dev: env.NODE_ENV === "development", https: env.VERCEL === "1" });
  const reportOnly = env.CSP_MODE === "report-only";
  return [
    { key: reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value },
    { key: "Reporting-Endpoints", value: `csp="${CSP_REPORT_PATH}"` },
  ];
}

// Laporan pelanggaran dari browser (format report-uri lama atau Reporting API) menjadi data ringkas tanpa query.
export type LaporanCsp = { directive: string; blocked: string; page: string };

const tanpaQuery = (u: unknown) => {
  if (typeof u !== "string") return "";
  try {
    const x = new URL(u);
    return `${x.origin}${x.pathname}`.slice(0, 200);
  } catch {
    return u.slice(0, 40);
  }
};

export function normalisasiLaporan(body: unknown): LaporanCsp[] {
  const list = Array.isArray(body) ? body : [body];
  return list.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const src = (r["csp-report"] ?? r.body) as Record<string, unknown> | undefined; // report-uri lama, atau Reporting API
    if (!src || typeof src !== "object") return [];
    return [
      {
        directive: String(src["effective-directive"] ?? src["violated-directive"] ?? src.effectiveDirective ?? "").slice(0, 60),
        blocked: tanpaQuery(src["blocked-uri"] ?? src.blockedURL),
        page: tanpaQuery(src["document-uri"] ?? src.documentURL),
      },
    ];
  });
}

