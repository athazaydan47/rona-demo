// Database terpisah untuk uji (Fase 8B). Nama database kerja (dari DATABASE_URL) diberi akhiran: _uji untuk Vitest dan
// _e2e untuk Playwright, sehingga database kerja hanya berisi seed dan data uji tidak bocor ke cuplik atau aset portofolio.
// Hanya untuk Postgres lokal: database uji dibuat di server yang sama dengan DATABASE_URL.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { isLocalDatabase } from "./connection";

export const AKHIRAN_DB_UJI = { vitest: "_uji", playwright: "_e2e" } as const;

export const namaDatabase = (url: string) => decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
// Nama database uji dari database kerja, misal toko_demo menjadi toko_demo_uji.
export const namaDbUji = (urlKerja: string, jenis: keyof typeof AKHIRAN_DB_UJI) => `${namaDatabase(urlKerja)}${AKHIRAN_DB_UJI[jenis]}`;

// Ganti nama database di connection string (host, pengguna, dan kata sandi tetap).
export function withDatabase(url: string, name: string) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

// Buat database uji bila belum ada, kosongkan skemanya, migrasi, lalu isi seed. Menolak host selain lokal.
export async function siapkanDbUji(baseUrl: string, name: string, opts: { seed?: (url: string) => Promise<void>; log?: (m: string) => void } = {}) {
  if (!baseUrl) throw new Error("DATABASE_URL belum diisi.");
  if (!isLocalDatabase(baseUrl)) throw new Error(`Database uji hanya dibuat di Postgres lokal, bukan ${new URL(baseUrl).hostname}.`);
  if (!/^[a-z0-9_]+_(uji|e2e)$/.test(name) || name === namaDatabase(baseUrl)) throw new Error(`Nama database uji tidak sah: ${name}`);
  const log = opts.log ?? (() => {});
  const admin = postgres(baseUrl, { max: 1, onnotice: () => {} });
  try {
    const [exists] = await admin`select 1 as ok from pg_database where datname = ${name}`;
    if (!exists) await admin.unsafe(`create database ${name}`);
  } finally {
    await admin.end();
  }
  const url = withDatabase(baseUrl, name);
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await client.unsafe("CREATE SCHEMA public");
    const db = drizzle(client, { casing: "snake_case" });
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
  log(`Database uji ${name} dimigrasi.`);
  if (opts.seed) {
    await opts.seed(url);
    log(`Database uji ${name} diisi seed.`);
  }
  return url;
}
