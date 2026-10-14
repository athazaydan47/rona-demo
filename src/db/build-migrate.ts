// Dijalankan oleh `npm run build` sebelum `next build`. Di build produksi Vercel (VERCEL_ENV=production) menjalankan
// migrasi dengan kunci advisory; di tempat lain hanya mencetak bahwa migrasi dilewati. Gagal migrasi = build gagal.
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { planBuildMigration, runBuildMigrations, type JournalEntry } from "./build-migrate-core";

const LOCK_KEY = 726_277_002;

async function main() {
  const plan = planBuildMigration(process.env);
  if (!plan.run) {
    console.log(plan.reason);
    return;
  }
  console.log(`Migrasi produksi memakai ${plan.via}.`);
  const client = postgres(plan.url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { casing: "snake_case" });
  const journal = (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: JournalEntry[] }).entries;
  try {
    await runBuildMigrations({
      journal,
      log: (l) => console.log(l),
      lock: async () => void (await db.execute(sql`select pg_advisory_lock(${LOCK_KEY})`)),
      unlock: async () => void (await db.execute(sql`select pg_advisory_unlock(${LOCK_KEY})`)),
      applied: async () => {
        const [t] = (await db.execute(sql`select to_regclass('drizzle.__drizzle_migrations') as t`)) as unknown as { t: string | null }[];
        if (!t?.t) return [];
        const rows = (await db.execute(sql`select created_at from drizzle.__drizzle_migrations`)) as unknown as { created_at: string | number }[];
        return rows.map((r) => Number(r.created_at));
      },
      migrate: async () => {
        await db.execute(sql`create extension if not exists pg_trgm`);
        await migrate(db, { migrationsFolder: "./drizzle" });
      },
    });
  } finally {
    await client.end();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
