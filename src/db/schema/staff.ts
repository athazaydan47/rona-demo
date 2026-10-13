import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { locations } from "./catalog";

export const roles = pgTable(
  "roles",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull(), // owner, admin_online, staf_cabang, gudang
    name: text().notNull(),
    description: text().notNull().default(""),
    defaultPermissions: text().array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [uniqueIndex("roles_slug_idx").on(t.slug)],
);

export const staff = pgTable(
  "staff",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    roleId: integer()
      .notNull()
      .references(() => roles.id),
    locationId: integer().references(() => locations.id), // lokasi utama (lama); daftar lengkap di staff_locations
    isActive: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("staff_email_idx").on(t.email)],
);

// Izin per akun: menimpa izin bawaan peran.
export const permissions = pgTable(
  "permissions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    staffId: integer()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    key: text().notNull(),
    allowed: boolean().notNull().default(true),
  },
  (t) => [uniqueIndex("permissions_staff_key_idx").on(t.staffId, t.key)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    staffId: integer().references(() => staff.id, { onDelete: "set null" }),
    // Salinan nama pelaku saat itu (tetap terbaca walau akun dihapus), misal "Owner Demo" atau "sistem".
    actorName: text().notNull().default(""),
    action: text().notNull(),
    objectType: text().notNull(),
    objectId: text().notNull().default(""),
    summary: text().notNull().default(""),
    locationId: integer(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_object_idx").on(t.objectType, t.objectId),
    index("audit_logs_staff_idx").on(t.staffId, t.createdAt),
    index("audit_logs_action_idx").on(t.action, t.createdAt),
  ],
);

// Lokasi yang diampu tiap akun staf. Kosong berarti semua lokasi (Owner, Admin Online, Gudang).
export const staffLocations = pgTable(
  "staff_locations",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    staffId: integer()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    locationId: integer()
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("staff_locations_staff_location_idx").on(t.staffId, t.locationId)],
);

// Sesi staf, terpisah dari sesi pembeli. Token acak di cookie, hash SHA-256 di database, berlaku 12 jam.
export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tokenHash: text().notNull(),
    staffId: integer()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    userAgent: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("staff_sessions_token_idx").on(t.tokenHash), index("staff_sessions_staff_idx").on(t.staffId)],
);

// Percobaan masuk staf untuk rate limit dan kunci sementara (serverless, jadi disimpan di database).
export const staffLoginAttempts = pgTable(
  "staff_login_attempts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text().notNull(),
    ipHash: text().notNull().default(""),
    success: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_login_attempts_email_idx").on(t.email, t.createdAt), index("staff_login_attempts_ip_idx").on(t.ipHash, t.createdAt)],
);
