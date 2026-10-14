// npm run cek:data: periksa konsistensi data di database (DATABASE_URL), misal setelah reset demo.
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { AnyDb } from "../lib/db-types";
import { checkDataConsistency } from "../lib/demo/consistency";
import { cariDataUji, ringkasDataUji } from "../lib/demo/data-uji";

async function main() {
  const client = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as AnyDb;
    const r = await checkDataConsistency(db);
    // Fase 8B: database kerja dan produksi hanya berisi seed; data bernama uji berarti ada uji yang menulis ke sini.
    const uji = await cariDataUji(db);
    if (uji.length) {
      console.log(`Ditemukan data uji (${ringkasDataUji(uji)}). Jalankan npm run db:reset; uji kini memakai database terpisah berakhiran _uji dan _e2e.`);
      for (const u of uji.slice(0, 10)) console.log(`  ${u.tabel}: ${u.nilai}`);
    }
    if (r.ok && !uji.length) {
      console.log("Data konsisten: buku stok, stok dipesan, poin, terjual, kuota flash, dan voucher cocok. Tidak ada data uji.");
      return 0;
    }
    if (r.ok) return 1;
    const by = new Map<string, number>();
    for (const i of r.issues) by.set(i.check, (by.get(i.check) ?? 0) + 1);
    console.log(`Ditemukan ${r.issues.length} ketidakcocokan: ${[...by].map(([k, n]) => `${k} ${n}`).join(", ")}`);
    for (const i of r.issues.slice(0, 20)) console.log(`  ${i.check} ${i.key}: seharusnya ${i.expected}, tercatat ${i.actual}`);
    return 1;
  } finally {
    await client.end();
  }
}

main().then((code) => process.exit(code), (e) => (console.error(e), process.exit(1)));
