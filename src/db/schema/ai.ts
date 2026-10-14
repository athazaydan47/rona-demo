// Tabel AI (Fase 7A). Tidak ikut dikosongkan reset demo: cache hasil AI tetap berlaku karena seed deterministik,
// dan log pemakaian dipakai untuk batas harian serta perkiraan biaya. Sengaja tanpa foreign key ke tabel demo.
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Pencatatan pemakaian per panggilan AI. Isi percakapan tidak disimpan, kecuali kueri pencarian yang dinormalisasi.
export const aiLogs = pgTable(
  "ai_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    feature: text().notNull(), // advisor, tafsir_cari, padanan_shade, rutinitas, ringkasan_ulasan, eval
    model: text().notNull().default(""),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    latencyMs: integer().notNull().default(0),
    ok: boolean().notNull().default(true),
    error: text(),
    visitorHash: text().notNull().default(""),
    query: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_logs_visitor_idx").on(t.visitorHash, t.feature, t.createdAt), index("ai_logs_created_idx").on(t.createdAt)],
);

// Cache hasil AI per kunci (misal tafsir:<kueri>, rutinitas:<hash>), dengan masa berlaku.
export const aiCache = pgTable(
  "ai_cache",
  {
    key: text().primaryKey(),
    feature: text().notNull(),
    value: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("ai_cache_expires_idx").on(t.expiresAt)],
);

export type ReviewSummary = { pros: string[]; cons: string[]; suitableFor: string };

// Ringkasan ulasan per produk, dibuat ulang hanya bila hash daftar ulasan tayang berubah.
export const reviewSummaries = pgTable("review_summaries", {
  productId: integer().primaryKey(),
  reviewHash: text().notNull(),
  reviewCount: integer().notNull(),
  summary: jsonb().$type<ReviewSummary>().notNull(),
  model: text().notNull().default(""),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
