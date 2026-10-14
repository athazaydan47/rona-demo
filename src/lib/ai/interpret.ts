// Tafsiran pencarian bahasa sehari-hari: kalimat menjadi filter katalog terstruktur (skema JSON), divalidasi
// terhadap nilai yang diizinkan, di-cache 7 hari per kueri yang dinormalisasi. Anggaran waktu 2,5 detik: bila AI
// gagal atau lambat, pemanggil langsung memakai pencarian trigram biasa.
import { asc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { ATTRIBUTES, type CatalogFilters } from "@/lib/catalog/filters";
import { CONCERN_VALUES, FINISH_VALUES, SKIN_TYPE_VALUES, UNDERTONE_VALUES } from "@/lib/catalog/tools";
import type { AiModel, Schema } from "./client";
import { cacheGet, cacheSet, logAi, shortHash } from "./usage";

export const INTERPRET_BUDGET_MS = 2500;
export const INTERPRET_CACHE_DAYS = 7;

export type Interpretation = {
  kategori: string | null;
  merek: string[];
  jenisKulit: string[];
  masalah: string[];
  finish: string[];
  undertone: string[];
  spf: boolean;
  hargaMaks: number | null;
  atribut: string[];
  kataKunci: string;
};
export type AllowedValues = { categories: { slug: string; name: string }[]; brands: { slug: string; name: string }[] };

const CUE_WORDS = /\b(yang|buat|untuk|utk|ga|gak|nggak|enggak|tidak|biar|supaya|kalau|kalo|di ?bawah|murah|cocok|bikin|tapi|dan|ada)\b/i;

// Kueri terlihat seperti kalimat: minimal 4 kata, atau mengandung kata penghubung sehari-hari.
export function looksLikeSentence(q: string) {
  const words = q.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 4) return true;
  return words.length >= 2 && CUE_WORDS.test(q);
}

export function normalizeQuery(q: string) {
  return q
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function interpretSchema(allowed: AllowedValues): Schema {
  return {
    type: "OBJECT",
    properties: {
      // Gemini menolak string kosong di enum, jadi "tidak jelas" ditulis sebagai null.
      kategori: { type: "STRING", enum: allowed.categories.map((c) => c.slug), nullable: true, description: "slug kategori, null bila tidak jelas" },
      merek: { type: "ARRAY", items: { type: "STRING", enum: allowed.brands.map((b) => b.slug) } },
      jenisKulit: { type: "ARRAY", items: { type: "STRING", enum: [...SKIN_TYPE_VALUES] } },
      masalah: { type: "ARRAY", items: { type: "STRING", enum: [...CONCERN_VALUES] } },
      finish: { type: "ARRAY", items: { type: "STRING", enum: [...FINISH_VALUES] } },
      undertone: { type: "ARRAY", items: { type: "STRING", enum: [...UNDERTONE_VALUES] } },
      spf: { type: "BOOLEAN" },
      hargaMaks: { type: "INTEGER", description: "harga maksimal dalam rupiah, 0 bila tidak disebut" },
      atribut: { type: "ARRAY", items: { type: "STRING", enum: Object.keys(ATTRIBUTES) } },
      kataKunci: { type: "STRING", description: "kata kunci produk yang tersisa, kosong bila sudah tertangkap filter" },
    },
    required: ["kategori", "merek", "jenisKulit", "masalah", "finish", "undertone", "spf", "hargaMaks", "atribut", "kataKunci"],
  };
}

const arr = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : []);

// Validasi keluaran model: nilai di luar daftar yang diizinkan dibuang.
export function validateInterpretation(raw: unknown, allowed: AllowedValues): Interpretation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cat = typeof r.kategori === "string" && allowed.categories.some((c) => c.slug === r.kategori) ? r.kategori : null;
  const price = Number(r.hargaMaks);
  const out: Interpretation = {
    kategori: cat,
    merek: arr(r.merek, allowed.brands.map((b) => b.slug)),
    jenisKulit: arr(r.jenisKulit, SKIN_TYPE_VALUES),
    masalah: arr(r.masalah, CONCERN_VALUES),
    finish: arr(r.finish, FINISH_VALUES),
    undertone: arr(r.undertone, UNDERTONE_VALUES),
    spf: r.spf === true,
    hargaMaks: Number.isInteger(price) && price >= 10_000 && price <= 5_000_000 ? price : null,
    atribut: arr(r.atribut, Object.keys(ATTRIBUTES)),
    kataKunci: typeof r.kataKunci === "string" ? r.kataKunci.trim().replace(/[^\p{L}\p{N}\s-]/gu, "").slice(0, 60) : "",
  };
  return out;
}

export const interpretationIsEmpty = (i: Interpretation) => !i.kategori && !i.merek.length && !i.jenisKulit.length && !i.masalah.length && !i.finish.length && !i.undertone.length && !i.spf && i.hargaMaks == null && !i.atribut.length;

// Tafsiran menjadi filter katalog. Filter eksplisit dari URL (misal urutan) tetap dipakai.
export function interpretationToFilters(i: Interpretation, base: CatalogFilters): CatalogFilters {
  return {
    ...base,
    category: i.kategori,
    brands: i.merek,
    skinTypes: i.jenisKulit,
    concerns: i.masalah,
    finishes: i.finish,
    undertones: i.undertone,
    spf: i.spf,
    priceMax: i.hargaMaks,
    attributes: i.atribut,
    interpreted: true,
    keyword: i.kataKunci,
    page: 1,
  };
}

export async function allowedValues(db: AnyDb): Promise<AllowedValues> {
  const [categories, brands] = await Promise.all([
    db.select({ slug: schema.categories.slug, name: schema.categories.name }).from(schema.categories).orderBy(asc(schema.categories.sortOrder)),
    db.select({ slug: schema.brands.slug, name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name)),
  ]);
  return { categories, brands };
}

export function interpretPrompt(q: string, allowed: AllowedValues) {
  return [
    "TUGAS: tafsir_cari. Ubah kueri pembeli toko kosmetik menjadi filter katalog.",
    "Hanya pakai nilai dari skema (daftar slug kategori ada di skema). Jangan menebak merek atau kategori yang tidak disebut.",
    `Merek: ${allowed.brands.map((b) => `${b.slug} (${b.name})`).join(", ")}.`,
    `Atribut: ${Object.entries(ATTRIBUTES).map(([k, v]) => `${k} (${v.label})`).join(", ")}.`,
    "Contoh: \"lipstik yang ga bikin bibir kering buat kondangan\" menjadi kategori lipstick, finish satin, atribut melembapkan.",
    `Kueri: ${q}`,
  ].join("\n");
}

export type InterpretResult = { interpretation: Interpretation; source: "cache" | "ai"; usage?: { input: number; output: number } } | null;

export async function interpretQuery(db: AnyDb, model: AiModel, q: string, now: Date, opts: { visitorHash?: string; budgetMs?: number; skipCache?: boolean } = {}): Promise<InterpretResult> {
  const started = Date.now();
  const norm = normalizeQuery(q);
  if (!norm) return null;
  const key = `tafsir:${shortHash(norm)}`;
  const allowed = await allowedValues(db);
  const cached = opts.skipCache ? null : await cacheGet<unknown>(db, key, now).catch(() => null);
  if (cached) {
    const v = validateInterpretation(cached, allowed);
    if (v) return { interpretation: v, source: "cache" };
  }
  const budget = (opts.budgetMs ?? INTERPRET_BUDGET_MS) - (Date.now() - started);
  if (budget < 300) return null;
  const t0 = Date.now();
  try {
    // Model ditandingkan dengan batas waktu supaya pencarian tidak pernah terblokir oleh AI.
    const res = await Promise.race([
      model.generate({ contents: [{ role: "user", parts: [{ text: interpretPrompt(q, allowed) }] }], jsonSchema: interpretSchema(allowed), temperature: 0, maxOutputTokens: 300 }, { timeoutMs: budget }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Waktu habis")), budget)),
    ]);
    const v = validateInterpretation(JSON.parse(res.text || "{}"), allowed);
    await logAi(db, { feature: "tafsir_cari", model: res.model, inputTokens: res.usage.input, outputTokens: res.usage.output, latencyMs: Date.now() - t0, ok: Boolean(v), visitorHash: opts.visitorHash, query: norm, at: now }).catch(() => {});
    if (!v || interpretationIsEmpty(v)) return null;
    await cacheSet(db, key, "tafsir_cari", v, INTERPRET_CACHE_DAYS, now).catch(() => {});
    return { interpretation: v, source: "ai", usage: res.usage };
  } catch (e) {
    await logAi(db, { feature: "tafsir_cari", model: model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), visitorHash: opts.visitorHash, query: norm, at: now }).catch(() => {});
    return null;
  }
}
