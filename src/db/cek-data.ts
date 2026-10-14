// npm run cek:data: periksa konsistensi data di database (DATABASE_URL), misal setelah reset demo.
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { AnyDb } from "../lib/db-types";
import { checkDataConsistency } from "../lib/demo/consistency";

async function main() {
  const client = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const r = await checkDataConsistency(drizzle(client, { schema, casing: "snake_case" }) as unknown as AnyDb);
    if (r.ok) {
      console.log("Data konsisten: buku stok, stok dipesan, poin, terjual, kuota flash, dan voucher cocok.");
      return 0;
    }
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
