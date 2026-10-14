// Vitest globalSetup (Fase 8B): siapkan database uji (nama database kerja + _uji) yang bersih (migrasi + seed) sebelum uji integrasi,
// supaya uji tidak pernah menulis ke database kerja rona_demo. DATABASE_URL untuk berkas uji diatur di vitest.config.ts.
import { config } from "dotenv";
import { namaDbUji, siapkanDbUji } from "@/db/db-uji";
import { runSeed } from "@/db/seed";

export default async function setup() {
  config({ path: ".env.local", quiet: true });
  const base = process.env.DATABASE_URL_KERJA || process.env.DATABASE_URL || "";
  if (!base) return; // tanpa database, uji integrasi dilewati (describe.skipIf)
  const t0 = Date.now();
  const nama = namaDbUji(base, "vitest");
  await siapkanDbUji(base, nama, { seed: (url) => runSeed(url) });
  console.log(`Database uji ${nama} siap dalam ${Date.now() - t0} ms.`);
}
