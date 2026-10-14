import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import { cspHeaders } from "./src/lib/security/csp";
import pkg from "./package.json" with { type: "json" };

// Versi aplikasi untuk /api/sehat (Fase 8B): commit dari Vercel, atau dari git lokal saat build.
const commit = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "tidak-diketahui";
  }
})();

// Header keamanan dasar untuk semua rute. X-Robots-Tag karena seluruh data toko ini fiktif.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // CSP lengkap (Fase 8B): src/lib/security/csp.ts. CSP_MODE=report-only saat build untuk mode laporan saja.
  ...cspHeaders(),
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.VERCEL === "1" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  // Mikrofon hanya untuk asal yang sama: masukan suara Asisten Admin (Fase 7B). Toko tidak pernah memintanya.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  env: { APP_VERSI: pkg.version, APP_COMMIT: commit },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Jangan umumkan kerangka yang dipakai (Fase 8B).
  poweredByHeader: false,
  cacheComponents: true,
  // Foto banner dan produk dari Vercel Blob lewat next/image (Fase 8A); gambar lifestyle lokal tidak butuh pola.
  images: { remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }], formats: ["image/avif", "image/webp"] },
  // Addon native (rasterisasi gambar OG) tidak dibundel, dimuat langsung oleh Node.
  serverExternalPackages: ["@resvg/resvg-js"],
  partialPrefetching: true,
  // Panduan admin dibaca dari berkas saat jalan oleh tool panduan_admin (Asisten Admin dan Kabar Harian).
  outputFileTracingIncludes: { "/api/admin/asisten": ["./docs/panduan-admin/**"], "/api/cron/kedaluwarsa": ["./docs/panduan-admin/**"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
