// Pengaturan untuk halaman dan server action: di-cache dengan tag "settings", direvalidasi saat disimpan di admin.
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { cacheTags } from "@/lib/cache-tags";
import type { AnyDb } from "@/lib/db-types";
import type { StoreSettings } from "./index";
import { loadSettings } from "./db";

export { loadSettings };

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.settings());
  return loadSettings(db as unknown as AnyDb);
}
