// Pembatas laju umum (Fase 8B): jumlah permintaan per kunci per jendela waktu, disimpan di Postgres supaya berlaku di
// semua instance serverless. Dipakai lacak pesanan, unggah foto, dan tafsiran shade AI. Baris lama dibersihkan cron.
import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().notNull(), // misal "lacak:ip:<hash>"; tidak berisi data pribadi mentah
    windowStart: timestamp({ withTimezone: true }).notNull(),
    hits: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);
