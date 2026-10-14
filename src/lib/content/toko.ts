// Data cabang untuk halaman Toko kami dan Hubungi: alamat, jam buka per hari, hari libur, titik peta. Di-cache dengan
// tag locations (direvalidasi saat cabang diubah di Pengaturan).
import { cacheLife, cacheTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { OpeningHours } from "@/db/schema";
import { cacheTags } from "@/lib/cache-tags";

export type StoreDetail = { id: number; slug: string; name: string; type: "gudang" | "toko"; address: string; district: string; city: string; phone: string; lat: number | null; lng: number | null; hoursLabel: string; openingHours: OpeningHours | null; closedDates: string[]; canPickup: boolean };

export async function getStoreDetails(): Promise<StoreDetail[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.locations());
  const rows = await db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(asc(schema.locations.sortOrder));
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, type: r.type, address: r.address, district: r.district, city: r.city, phone: r.phone, lat: r.lat, lng: r.lng, hoursLabel: r.hoursLabel, openingHours: r.openingHours, closedDates: r.closedDates ?? [], canPickup: r.canPickup }));
}

export const DAY_ORDER: { key: keyof OpeningHours; label: string }[] = [
  { key: "sen", label: "Senin" },
  { key: "sel", label: "Selasa" },
  { key: "rab", label: "Rabu" },
  { key: "kam", label: "Kamis" },
  { key: "jum", label: "Jumat" },
  { key: "sab", label: "Sabtu" },
  { key: "min", label: "Minggu" },
];

export const mapsRouteUrl = (s: Pick<StoreDetail, "lat" | "lng" | "name" | "address" | "city">) => (s.lat != null && s.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address} ${s.city}`)}`);
