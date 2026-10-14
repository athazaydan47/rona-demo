import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Uji E2E memakai database terpisah <database kerja>_e2e (Fase 8B): disiapkan bersih (migrasi + seed) oleh perintah server
// pertama, dan helper uji (e2e/helpers.ts) membaca DATABASE_URL yang sama. Database kerja rona_demo tidak tersentuh.
config({ path: ".env.local", quiet: true });
const KERJA = process.env.DATABASE_URL_KERJA || process.env.DATABASE_URL || "";
const E2E_DB = KERJA ? (() => {
  const u = new URL(KERJA);
  u.pathname = `${u.pathname}_e2e`;
  return u.toString();
})() : "";
const E2E_NAME = E2E_DB ? new URL(E2E_DB).pathname.slice(1) : "";
if (E2E_DB) {
  process.env.DATABASE_URL_KERJA = KERJA;
  process.env.DATABASE_URL = E2E_DB;
  process.env.DATABASE_URL_UNPOOLED = E2E_DB;
}

// Uji alur pembelian terhadap build produksi lokal (jalankan npm run build lebih dulu).
// Satu worker karena uji kedaluwarsa memajukan jam server untuk seluruh proses.
const PORT = 3210;
const NO_AI_PORT = 3212; // juga dipakai e2e/ai-pembeli.spec.ts

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  // Chrome untuk semua uji; WebKit (mesin Safari) untuk alur beli dan alur admin utama (Fase 8A).
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } }, testMatch: /\/(alur-beli|admin|tanya-rona)\.spec\.ts$/ },
  ],
  // Server utama memakai AI mock (deterministik). Server kedua tanpa env AI untuk menguji toko tetap jalan tanpa AI.
  webServer: [
    {
      command: `npx tsx scripts/siapkan-db-uji.ts ${E2E_NAME} && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ALLOW_CLOCK_OVERRIDE: "true", AI_PROVIDER: "mock", DATABASE_URL: E2E_DB, DATABASE_URL_UNPOOLED: E2E_DB },
    },
    {
      command: `npx next start -p ${NO_AI_PORT}`,
      url: `http://localhost:${NO_AI_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { AI_PROVIDER: "", AI_GATEWAY_URL: "", GEMINI_API_KEY: "", DATABASE_URL: E2E_DB, DATABASE_URL_UNPOOLED: E2E_DB },
    },
  ],
});
