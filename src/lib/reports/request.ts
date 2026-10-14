// Laporan untuk satu permintaan staf: periode, cakupan lokasi sesuai izin, data periode ini dan pembandingnya.
// Dipakai halaman Laporan dan route unduhan Excel supaya keduanya selalu menghitung hal yang sama.
import { asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { allLocations, can, type StaffPrincipal } from "@/lib/admin/permissions";
import type { AnyDb } from "@/lib/db-types";
import { buildReport, previousRange, resolvePeriod, summarize, type ResolvedPeriod } from "./index";
import { loadReportData } from "./load";

export type ReportParams = { periode?: string; dari?: string; sampai?: string; lokasi?: string; banding?: string };

// Cakupan lokasi (murni): staf yang mengampu lokasi tertentu otomatis terbatas ke lokasinya.
export function reportLocationScope(staff: Pick<StaffPrincipal, "locationIds">, requested: number | null): number[] | null {
  if (allLocations(staff)) return requested ? [requested] : null;
  if (requested && staff.locationIds.includes(requested)) return [requested];
  return staff.locationIds;
}

export async function reportForRequest(db: AnyDb, staff: StaffPrincipal, params: ReportParams, now: Date) {
  const period: ResolvedPeriod = resolvePeriod(params.periode, now, { from: params.dari, to: params.sampai });
  const requested = Number.parseInt(params.lokasi ?? "", 10) || null;
  const locationIds = reportLocationScope(staff, requested);
  const locations = (await db.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(asc(schema.locations.sortOrder))).filter((l) => allLocations(staff) || staff.locationIds.includes(l.id));
  const data = await loadReportData(db, period, { locationIds });
  const report = buildReport(data);
  const compare = params.banding === "1" ? summarize(await loadReportData(db, previousRange(period), { locationIds })) : null;
  const locationLabel = locationIds == null ? "Semua cabang" : locations.filter((l) => locationIds.includes(l.id)).map((l) => l.name).join(", ") || "Tidak ada";
  return { period, data, report, compare, locations, locationIds, locationLabel, selectedLocation: locationIds && locationIds.length === 1 ? locationIds[0] : null, finance: can(staff, "laporan.keuangan") };
}
