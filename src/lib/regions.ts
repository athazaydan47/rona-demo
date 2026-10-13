// Data wilayah dari dataset terbuka cahyadsn/wilayah (MIT), disimpan di repo: src/data/wilayah.json.
// Provinsi dan kota/kabupaten seluruh Indonesia, kecamatan hanya Jawa Timur.
import data from "@/data/wilayah.json";
import type { Zone } from "@/lib/shipping";

type Pair = [string, string];
const wilayah = data as unknown as { provinsi: Pair[]; kota: Record<string, Pair[]>; kecamatan: Record<string, Pair[]> };

export const JATIM = "35";
export const KOTA_MALANG = "35.73";
const JAWA = new Set(["31", "32", "33", "34", "35", "36"]);

export type Region = { kode: string; nama: string };
const toRegion = ([kode, nama]: Pair): Region => ({ kode, nama });

export const provinces = (): Region[] => wilayah.provinsi.map(toRegion);
export const regencies = (provinceCode: string): Region[] => (wilayah.kota[provinceCode] ?? []).map(toRegion);
export const districts = (regencyCode: string): Region[] => (wilayah.kecamatan[regencyCode] ?? []).map(toRegion);
export const hasDistrictData = (provinceCode: string) => provinceCode === JATIM;

export function regionName(kode: string) {
  if (!kode) return "";
  const parts = kode.split(".");
  if (parts.length === 1) return wilayah.provinsi.find((p) => p[0] === kode)?.[1] ?? "";
  if (parts.length === 2) return wilayah.kota[parts[0]]?.find((p) => p[0] === kode)?.[1] ?? "";
  return wilayah.kecamatan[parts.slice(0, 2).join(".")]?.find((p) => p[0] === kode)?.[1] ?? "";
}

// Zona ongkir dari kode kota/kabupaten: dalam kota (Kota Malang), Jawa Timur, Jawa lain, luar Jawa.
export function zoneForRegency(regencyCode: string): Zone | null {
  const prov = regencyCode.split(".")[0];
  if (!prov || !wilayah.kota[prov]?.some((r) => r[0] === regencyCode)) return null;
  if (regencyCode === KOTA_MALANG) return "dalam_kota";
  if (prov === JATIM) return "jatim";
  if (JAWA.has(prov)) return "jawa";
  return "luar_jawa";
}
