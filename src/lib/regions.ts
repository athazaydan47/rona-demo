// Data wilayah dari dataset terbuka cahyadsn/wilayah (MIT), disimpan di repo: src/data/wilayah.json.
// Provinsi dan kota/kabupaten seluruh Indonesia, kecamatan hanya Jawa Timur.
import data from "@/data/wilayah.json";
import type { Zone } from "@/lib/shipping";
import { trigramSimilarity } from "@/lib/teks/mirip";

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

// ---------- Kota tujuan dari teks bebas (chat asisten, Fase 8C) ----------

export type KotaTujuan = { kode: string; nama: string; provinsi: string; zona: Zone };
export type HasilCariKota = { status: "cocok"; kota: KotaTujuan } | { status: "ambigu"; pilihan: KotaTujuan[] } | { status: "tidak_dikenal"; teks: string };

// Nama sehari-hari ke kode kota/kabupaten. Jakarta: lima kota administrasi satu zona, diwakili Jakarta Pusat.
const ALIAS_KOTA: Record<string, string> = { jakarta: "31.71", jkt: "31.71", jogja: "34.71", jogjakarta: "34.71", yogya: "34.71", yogyakarta: "34.71", solo: "33.72", surakarta: "33.72", jabodetabek: "31.71" };
const PREFIX = /^(kota administrasi|kabupaten administrasi|kabupaten|kab\.?|kota)\s+/;
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9.\s]/g, " ").replace(/\s+/g, " ").trim();

function semuaKota(): (KotaTujuan & { inti: string; jenis: "kota" | "kabupaten" })[] {
  return wilayah.provinsi.flatMap(([prov, provNama]) =>
    (wilayah.kota[prov] ?? []).map(([kode, nama]) => {
      const n = norm(nama);
      return { kode, nama: nama.trim().replace(/^Kota Administrasi /, "").replace(/^Kabupaten Administrasi /, "Kab. ").replace(/^Kabupaten /, "Kab. "), provinsi: provNama, zona: zoneForRegency(kode)!, inti: n.replace(PREFIX, ""), jenis: /^kota/.test(n) ? ("kota" as const) : ("kabupaten" as const) };
    }),
  ).filter((k) => k.zona);
}

// "ke bandung", "kab malang", "surabya" (salah ketik). Kandidat dengan zona sama dianggap satu jawaban (ongkirnya sama),
// diwakili kota, bukan kabupaten. Zona berbeda (misal Kota Malang dan Kab. Malang) dikembalikan sebagai pilihan.
export function cariKotaTujuan(input: string): HasilCariKota {
  const q = norm(input).replace(/^(ke|di|kota tujuan|tujuan)\s+/, "").replace(/\b(berapa|ongkir|ongkos kirim|dong|ya|kak)\b/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 3) return { status: "tidak_dikenal", teks: input.trim().slice(0, 40) };
  const all = semuaKota();
  const alias = ALIAS_KOTA[q];
  if (alias) {
    const k = all.find((x) => x.kode === alias)!;
    return { status: "cocok", kota: { kode: k.kode, nama: alias === "31.71" ? "Jakarta" : k.nama, provinsi: k.provinsi, zona: k.zona } };
  }
  const jenis = /^(kab|kabupaten)\b/.test(q) ? "kabupaten" : /^kota\b/.test(q) ? "kota" : null;
  const inti = q.replace(PREFIX, "");
  let cands = all.filter((k) => k.inti === inti && (!jenis || k.jenis === jenis));
  if (!cands.length) cands = all.filter((k) => k.inti.startsWith(`${inti} `) && (!jenis || k.jenis === jenis));
  if (!cands.length && !jenis) {
    // Nama provinsi (misal "Bali"): bila semua kotanya satu zona, ongkirnya sama, jadi provinsi itu sudah cukup.
    const prov = wilayah.provinsi.find(([, n]) => norm(n) === inti);
    if (prov) {
      const inProv = all.filter((k) => k.kode.startsWith(`${prov[0]}.`));
      const zonaProv = new Set(inProv.map((k) => k.zona));
      if (inProv.length && zonaProv.size === 1) return { status: "cocok", kota: { kode: inProv[0].kode, nama: prov[1], provinsi: prov[1], zona: inProv[0].zona } };
      return { status: "tidak_dikenal", teks: input.trim().slice(0, 40) };
    }
  }
  if (!cands.length) {
    const scored = all.map((k) => ({ k, s: trigramSimilarity(inti, k.inti) })).filter((x) => x.s >= 0.45 && (!jenis || x.k.jenis === jenis)).sort((a, b) => b.s - a.s);
    cands = scored.filter((x) => x.s >= (scored[0]?.s ?? 1) - 0.05).map((x) => x.k);
  }
  if (!cands.length) return { status: "tidak_dikenal", teks: input.trim().slice(0, 40) };
  const strip = ({ kode, nama, provinsi, zona }: KotaTujuan) => ({ kode, nama, provinsi, zona });
  const zones = new Set(cands.map((c) => c.zona));
  if (zones.size === 1) return { status: "cocok", kota: strip([...cands].sort((a, b) => (a.jenis === "kota" ? -1 : 1) - (b.jenis === "kota" ? -1 : 1))[0]) };
  return { status: "ambigu", pilihan: cands.slice(0, 4).map(strip) };
}
