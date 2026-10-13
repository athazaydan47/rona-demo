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
    locationId: integer().references(() => locations.id), // lokasi yang diampu (opsional)
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
    action: text().notNull(),
    objectType: text().notNull(),
    objectId: text().notNull().default(""),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_object_idx").on(t.objectType, t.objectId)],
);
