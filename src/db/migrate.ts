import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { directUrl } from "./connection";

// Dipakai db:deploy, db:migrate, dan db:reset. Memakai koneksi langsung (DATABASE_URL_UNPOOLED) bila ada.
export async function runMigrations(url = directUrl()) {
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { casing: "snake_case" });
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.end();
}

const isMain = process.argv[1]?.endsWith("migrate.ts");
if (isMain) {
  runMigrations()
    .then(() => {
      console.log("Migrasi selesai.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
