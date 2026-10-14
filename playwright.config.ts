import { defineConfig } from "@playwright/test";

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
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  // Server utama memakai AI mock (deterministik). Server kedua tanpa env AI untuk menguji toko tetap jalan tanpa AI.
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ALLOW_CLOCK_OVERRIDE: "true", AI_PROVIDER: "mock" },
    },
    {
      command: `npx next start -p ${NO_AI_PORT}`,
      url: `http://localhost:${NO_AI_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { AI_PROVIDER: "", AI_GATEWAY_URL: "", GEMINI_API_KEY: "" },
    },
  ],
});
