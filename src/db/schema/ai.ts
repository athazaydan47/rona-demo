// Tabel AI (Fase 7A). Tidak ikut dikosongkan reset demo: cache hasil AI tetap berlaku karena seed deterministik,
// dan log pemakaian dipakai untuk batas harian serta perkiraan biaya. Sengaja tanpa foreign key ke tabel demo.
import { sql } from "drizzle-orm";
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
    // Asisten Admin (Fase 7B): staf yang bertanya, pintu (panel, kabar_harian, wa), nama tool yang dipanggil, dan
    // peringatan penjaga angka. Isi hasil tool tidak pernah dicatat.
    staffId: integer(),
    door: text(),
    tools: text().array().notNull().default(sql`'{}'::text[]`),
    warning: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_logs_visitor_idx").on(t.visitorHash, t.feature, t.createdAt), index("ai_logs_created_idx").on(t.createdAt), index("ai_logs_staff_idx").on(t.staffId, t.createdAt)],
);

// Corong Rona Advisor (Fase 7B) untuk tab Laporan: pesan ke Advisor dan tambah ke keranjang dari kartu Advisor.
// Data demo: ikut dikosongkan reset dan diisi seed riwayat.
export const advisorEvents = pgTable(
  "advisor_events",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    kind: text().notNull(), // percakapan | keranjang
    visitorHash: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("advisor_events_created_idx").on(t.createdAt, t.kind)],
);

export type DailyBriefData = Record<string, unknown>;

// Kabar Harian (Fase 7B): satu baris per hari WIB. Isi angka deterministik dari src/lib/reports, narasi dari AI atau
// templat. Tidak ikut dikosongkan reset supaya riwayat 14 hari tetap ada.
export const dailyBriefs = pgTable("daily_briefs", {
  day: text().primaryKey(), // "2026-10-13" (WIB)
  data: jsonb().$type<DailyBriefData>().notNull(),
  narrative: text().notNull(),
  source: text().notNull(), // ai | templat
  model: text().notNull().default(""),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

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
