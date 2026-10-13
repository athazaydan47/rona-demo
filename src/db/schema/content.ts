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

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const banners = pgTable(
  "banners",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: text().notNull(),
    subtitle: text().notNull().default(""),
    imageUrl: text(),
    href: text().notNull().default("/"),
    position: text().notNull().default("hero"),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("banners_position_idx").on(t.position, t.sortOrder)],
);

export const articles = pgTable(
  "articles",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: text().notNull(),
    slug: text().notNull(),
    excerpt: text().notNull().default(""),
    body: text().notNull(), // markdown sederhana
    coverImage: text(),
    author: text().notNull().default("Tim Rona"),
    linkedProductIds: integer().array().notNull().default(sql`'{}'::integer[]`),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("articles_slug_idx").on(t.slug)],
);
