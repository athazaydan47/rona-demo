import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL belum diisi. Salin .env.example ke .env.local.");
}

declare global {
  var __tokoSql: ReturnType<typeof postgres> | undefined;
}

// Satu pool untuk seluruh proses (hot reload dev tidak membuka pool baru). DATABASE_URL di produksi adalah
// connection string pooled Neon (PgBouncer mode transaction), karena itu prepared statement dimatikan.
// Di Vercel tiap instance fungsi punya pool sendiri, jadi ukurannya dijaga kecil.
const client = globalThis.__tokoSql ?? postgres(url, { max: process.env.VERCEL ? 5 : 10, prepare: false, onnotice: () => {} });
if (process.env.NODE_ENV !== "production") globalThis.__tokoSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export { schema };
