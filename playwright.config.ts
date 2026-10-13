import { defineConfig } from "@playwright/test";

// Uji alur pembelian terhadap build produksi lokal (jalankan npm run build lebih dulu).
// Satu worker karena uji kedaluwarsa memajukan jam server untuk seluruh proses.
const PORT = 3210;

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
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ALLOW_CLOCK_OVERRIDE: "true" },
  },
});
