// Pembacaan pengaturan langsung dari database (tanpa cache Next), untuk layanan dan uji.
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { normalizeSettings, type StoreSettings } from "./index";

export async function loadSettings(database: AnyDb): Promise<StoreSettings> {
  const rows = await database.select({ key: schema.settings.key, value: schema.settings.value }).from(schema.settings);
  return normalizeSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}
