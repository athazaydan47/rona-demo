import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL belum diisi. Salin .env.example ke .env.local.");
}

declare global {
  var __ronaSql: ReturnType<typeof postgres> | undefined;
}

// Satu koneksi pool untuk seluruh proses (hot reload dev tidak membuka pool baru).
const client = globalThis.__ronaSql ?? postgres(url, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__ronaSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export { schema };
