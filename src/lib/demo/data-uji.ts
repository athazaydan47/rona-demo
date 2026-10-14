// Penjaga data uji (Fase 8B): cari baris yang namanya menandakan data uji (Uji, E2E, test, Playwright) di tabel yang
// tampil ke pengunjung atau staf. Database kerja dan produksi seharusnya hanya berisi seed, jadi hasilnya
// harus kosong. Dipakai cek:data, cuplik, aset:portofolio, /api/sehat, dan uji seed.
import { sql } from "drizzle-orm";
import type { AnyDb } from "@/lib/db-types";

// Kata utuh, tanpa membedakan huruf besar kecil: "Uji", "SJ-UJI-1", "Flash Uji E2E", "test". "Teruji" tidak cocok.
export const POLA_DATA_UJI = "\\m(uji|e2e|test|playwright)\\M";
export const polaDataUji = /(^|[^\p{L}\p{N}])(uji|e2e|test|playwright)(?![\p{L}\p{N}])/iu;

export type TemuanDataUji = { tabel: string; nilai: string };

const CEK: { tabel: string; kolom: string[] }[] = [
  { tabel: "products", kolom: ["name", "slug"] },
  { tabel: "variants", kolom: ["shade_name", "sku"] },
  { tabel: "brands", kolom: ["name"] },
  { tabel: "categories", kolom: ["name"] },
  { tabel: "flash_sales", kolom: ["name"] },
  { tabel: "vouchers", kolom: ["code", "title"] },
  { tabel: "banners", kolom: ["title"] },
  { tabel: "articles", kolom: ["title"] },
  { tabel: "locations", kolom: ["name"] },
  { tabel: "staff", kolom: ["name"] },
  { tabel: "customers", kolom: ["name"] },
  { tabel: "orders", kolom: ["guest_name"] },
  { tabel: "reviews", kolom: ["author_name", "body"] },
  { tabel: "stock_movements", kolom: ["reference", "note"] },
];

// Tabel yang dicek untuk produksi lewat /api/sehat: hanya jumlah, tanpa isi.
export const TABEL_PUBLIK = ["products", "flash_sales", "vouchers"] as const;

export async function cariDataUji(db: AnyDb, opts: { tabel?: readonly string[]; batas?: number } = {}): Promise<TemuanDataUji[]> {
  const batas = opts.batas ?? 20;
  const out: TemuanDataUji[] = [];
  for (const c of CEK) {
    if (opts.tabel && !opts.tabel.includes(c.tabel)) continue;
    const kondisi = sql.join(
      c.kolom.map((k) => sql`${sql.identifier(k)} ~* ${POLA_DATA_UJI}`),
      sql` or `,
    );
    const nilai = sql.join(
      c.kolom.map((k) => sql`${sql.identifier(k)}::text`),
      sql`, ' | ', `,
    );
    const rows = (await db.execute(sql`select concat(${nilai}) as nilai from ${sql.identifier(c.tabel)} where ${kondisi} limit ${batas}`)) as unknown as { nilai: string }[];
    for (const r of rows) out.push({ tabel: c.tabel, nilai: String(r.nilai).slice(0, 120) });
  }
  return out;
}

export async function hitungDataUji(db: AnyDb, tabel: readonly string[] = TABEL_PUBLIK) {
  const temuan = await cariDataUji(db, { tabel, batas: 50 });
  return Object.fromEntries(tabel.map((t) => [t, temuan.filter((x) => x.tabel === t).length])) as Record<string, number>;
}

export function ringkasDataUji(temuan: TemuanDataUji[]) {
  const per = new Map<string, number>();
  for (const t of temuan) per.set(t.tabel, (per.get(t.tabel) ?? 0) + 1);
  return [...per].map(([t, n]) => `${t} ${n}`).join(", ");
}
