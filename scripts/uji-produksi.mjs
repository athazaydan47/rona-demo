// npm run uji:produksi -- --url=https://alamat-situs   (Fase 8B)
// Menjalankan e2e-produksi/ (hanya-baca: beranda, produk, pencarian, 404, sehat, robots, header) terhadap situs tayang.
import { spawnSync } from "node:child_process";

const url = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? process.env.UJI_PRODUKSI_URL;
if (!url || !/^https?:\/\//.test(url)) {
  console.error("Pakai: npm run uji:produksi -- --url=https://alamat-situs");
  process.exit(2);
}
const rest = process.argv.slice(2).filter((a) => !a.startsWith("--url="));
const r = spawnSync("npx", ["playwright", "test", "-c", "playwright.produksi.config.ts", ...rest], { stdio: "inherit", env: { ...process.env, UJI_PRODUKSI_URL: url.replace(/\/$/, "") } });
process.exit(r.status ?? 1);
