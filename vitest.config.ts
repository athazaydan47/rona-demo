import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

// Uji integrasi memakai database terpisah <database kerja>_uji (Fase 8B), disiapkan bersih oleh src/test/global-setup.ts.
// Database kerja dari .env.local hanya dibaca untuk alamat server Postgres-nya.
config({ path: ".env.local", quiet: true });
const kerja = process.env.DATABASE_URL ?? "";
const uji = kerja ? (() => {
  const u = new URL(kerja);
  u.pathname = `${u.pathname}_uji`;
  return u.toString();
})() : "";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Uji integrasi berbagi satu database uji (penghitung nomor pesanan, stok, flash sale),
    // jadi berkas uji dijalankan berurutan supaya hasilnya deterministik.
    fileParallelism: false,
    globalSetup: ["src/test/global-setup.ts"],
    env: uji ? { DATABASE_URL: uji, DATABASE_URL_UNPOOLED: uji, DATABASE_URL_KERJA: kerja } : {},
    // Laporan cakupan (Fase 8B): npm run test:cakupan. Logika uang dan stok wajib di atas 85%.
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text-summary", "text", "html", "json-summary", "json"],
      include: ["src/lib/pricing/**", "src/lib/inventory/**", "src/lib/orders/**", "src/lib/reports/**", "src/lib/ai/**", "src/lib/shipping/**", "src/lib/points/**", "src/lib/flash/**"],
      exclude: ["**/*.test.ts", "**/*.integration.test.ts"],
      thresholds: {
        "src/lib/pricing/**": { lines: 85, statements: 85, functions: 85, branches: 80 },
        "src/lib/inventory/**": { lines: 85, statements: 85, functions: 85, branches: 80 },
        "src/lib/points/**": { lines: 85, statements: 85 },
        "src/lib/shipping/**": { lines: 85, statements: 85 },
        // Uang dan stok di modul pesanan: hitung total, aturan status, harga flash, dan layanan pesanan.
        "src/lib/orders/{service,rules,pricing-loader,status}.ts": { lines: 85 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
