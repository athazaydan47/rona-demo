import { defineConfig, devices } from "@playwright/test";

// Uji asap produksi (Fase 8B): hanya-baca terhadap situs yang sudah tayang, tanpa server lokal dan tanpa database.
// Jalankan lewat: npm run uji:produksi -- --url=https://alamat-situs
const url = process.env.UJI_PRODUKSI_URL;
if (!url) throw new Error("Isi alamat situs: npm run uji:produksi -- --url=https://alamat-situs");

export default defineConfig({
  testDir: "e2e-produksi",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 2,
  retries: 1,
  reporter: [["list"]],
  use: { baseURL: url, headless: true, trace: "retain-on-failure" },
  projects: [
    { name: "hp", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, channel: "chrome" } },
  ],
});
