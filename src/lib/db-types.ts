import type { PgDatabase } from "drizzle-orm/pg-core";

// Tipe database atau transaksi Drizzle yang bisa dioper ke modul logika (supaya bisa diuji dengan koneksi sendiri).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<any, any, any>;
