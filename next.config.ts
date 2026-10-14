import type { NextConfig } from "next";

// Header keamanan dasar untuk semua rute. X-Robots-Tag karena seluruh data toko ini fiktif.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Mikrofon hanya untuk asal yang sama: masukan suara Asisten Admin (Fase 7B). Toko tidak pernah memintanya.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /* config options here */
  cacheComponents: true,
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
