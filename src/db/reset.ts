import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { runMigrations } from "./migrate";
import { runSeed } from "./seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("db:reset hanya boleh dijalankan saat DEMO_MODE=true.");
  }
  const client = postgres(url, { max: 1, onnotice: () => {} });
  console.log("Mengosongkan skema public...");
  await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await client.unsafe("DROP SCHEMA public CASCADE");
  await client.unsafe("CREATE SCHEMA public");
  await client.end();
  console.log("Menjalankan migrasi...");
  await runMigrations(url);
  console.log("Mengisi data demo...");
  await runSeed(url);
  console.log("Reset selesai.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
