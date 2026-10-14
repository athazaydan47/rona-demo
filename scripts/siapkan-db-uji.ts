// Siapkan database uji yang bersih (migrasi + seed) di Postgres lokal (Fase 8B).
//   npx tsx scripts/siapkan-db-uji.ts <nama database kerja>_e2e
// Dipakai Playwright (perintah webServer pertama) supaya uji E2E tidak pernah menulis ke database kerja rona_demo.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const base = process.env.DATABASE_URL_KERJA || process.env.DATABASE_URL || "";
  const { namaDbUji, siapkanDbUji } = await import("../src/db/db-uji");
  const name = process.argv[2] ?? namaDbUji(base, "playwright");
  const { runSeed } = await import("../src/db/seed");
  const t0 = Date.now();
  await siapkanDbUji(base, name, { seed: (url) => runSeed(url) });
  console.log(`Database uji ${name} siap dalam ${Date.now() - t0} ms.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
