// "Aku pakai cushion Pualam 02" menjadi varian yang tepat (Fase 8C, satu sumber untuk halaman Padanan Shade dan chat
// asisten). Pencocokan berbasis aturan dulu (merek, kata nama produk, kode atau nama shade), AI hanya sebagai cadangan.
import { and, asc, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import type { AiModel } from "@/lib/ai/client";
import { SHADE_GROUPS } from "./shade";

export type ShadeSourceProduct = { id: number; name: string; brandName: string; categorySlug: string; variants: { id: number; shadeName: string; hex: string }[] };

// Produk berkategori shade (cushion, foundation, lipstik, dan lainnya) beserta varian aktifnya.
export async function shadeSources(db: AnyDb, group?: string | null): Promise<ShadeSourceProduct[]> {
  const cats = Object.entries(SHADE_GROUPS)
    .filter(([, g]) => !group || g === group)
    .map(([slug]) => slug);
  const rows = await db
    .select({ id: schema.products.id, name: schema.products.name, brandName: schema.brands.name, categorySlug: schema.categories.slug, variantId: schema.variants.id, shadeName: schema.variants.shadeName, hex: schema.variants.hex })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .innerJoin(schema.variants, eq(schema.variants.productId, schema.products.id))
    .where(and(eq(schema.products.status, "aktif"), eq(schema.variants.isActive, true), inArray(schema.categories.slug, cats)))
    .orderBy(asc(schema.products.name), asc(schema.variants.sortOrder));
  const map = new Map<number, ShadeSourceProduct>();
  for (const r of rows) {
    const p = map.get(r.id) ?? { id: r.id, name: r.name, brandName: r.brandName, categorySlug: r.categorySlug, variants: [] };
    p.variants.push({ id: r.variantId, shadeName: r.shadeName, hex: r.hex });
    map.set(r.id, p);
  }
  return [...map.values()];
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const CATEGORY_ALIASES: Record<string, string[]> = { lipstik: ["lipstick"], lipstick: ["lipstik"], cushion: ["kusyen"], foundation: ["fondasi", "alas"] };

export type ShadePick = { varianId: number; label: string };
export type ShadeResolve = { status: "cocok"; pilih: ShadePick } | { status: "pilih"; pilihan: ShadePick[]; pesan: string } | { status: "tidak" };

const label = (p: ShadeSourceProduct, v: { shadeName: string }) => `${p.name}, shade ${v.shadeName}`;

// Murni (diuji): kandidat produk dari merek dan kata nama produk, lalu shade dari kode angka ("02", "2", "02N") atau
// nama shade ("gading", "sawo matang"). Lebih dari satu kandidat dikembalikan sebagai pilihan, bukan ditebak.
export function resolveShadeText(text: string, sources: ShadeSourceProduct[]): ShadeResolve {
  const t = words(text);
  const tset = new Set(t.flatMap((w) => [w, ...(CATEGORY_ALIASES[w] ?? [])]));
  const scored = sources
    .map((p) => {
      const brand = words(p.brandName);
      const brandHit = brand.every((w) => tset.has(w));
      const own = words(p.name).filter((w) => !brand.includes(w) && w.length >= 3 && !/^spf$|^\d+$/.test(w));
      const hits = own.filter((w) => tset.has(w)).length;
      return { p, score: (brandHit ? 2 : 0) + hits, hits, brandHit };
    })
    .filter((x) => x.brandHit || x.hits >= 2);
  if (!scored.length) return { status: "tidak" };
  const best = Math.max(...scored.map((x) => x.score));
  const products = scored.filter((x) => x.score === best).map((x) => x.p);
  const nums = t.map((w) => /^(\d{1,2})([a-z]?)$/.exec(w)).filter(Boolean) as RegExpExecArray[];
  const shadeHits = (p: ShadeSourceProduct) =>
    p.variants.filter((v) => {
      const sw = words(v.shadeName);
      const code = /^(\d{1,2})([a-z]?)/.exec(sw[0] ?? "");
      const numHit = code ? nums.some((n) => Number(n[1]) === Number(code[1]) && (!n[2] || n[2] === code[2])) : false;
      const nameWords = sw.filter((w) => !/^\d/.test(w) && w.length >= 4);
      const nameHit = nameWords.length > 0 && nameWords.every((w) => tset.has(w));
      return numHit || nameHit;
    });
  const pairs = products.flatMap((p) => shadeHits(p).map((v) => ({ varianId: v.id, label: label(p, v) })));
  if (pairs.length === 1) return { status: "cocok", pilih: pairs[0] };
  if (pairs.length > 1) return { status: "pilih", pilihan: pairs.slice(0, 4), pesan: "Ada beberapa yang cocok dengan kalimatmu. Yang mana yang kamu pakai?" };
  // Produk ketemu tetapi shade belum disebut: satu shade langsung dipakai, selain itu tawarkan shade produk itu.
  if (products.length === 1 && products[0].variants.length === 1) return { status: "cocok", pilih: { varianId: products[0].variants[0].id, label: label(products[0], products[0].variants[0]) } };
  if (products.length === 1) return { status: "pilih", pilihan: products[0].variants.slice(0, 10).map((v) => ({ varianId: v.id, label: label(products[0], v) })), pesan: `Shade ${products[0].name} yang mana yang kamu pakai?` };
  return { status: "pilih", pilihan: products.slice(0, 4).map((p) => ({ varianId: p.variants[0].id, label: `${p.name} (pilih shade di langkah berikutnya)` })), pesan: "Produk yang mana yang kamu maksud?" };
}

// Cadangan AI: pilih satu varian dari daftar lengkap. Varian di luar daftar tidak pernah diterima.
export async function tafsirShadeDenganAi(model: AiModel, text: string, sources: ShadeSourceProduct[], timeoutMs = 6000): Promise<{ pilih: ShadePick | null; usage: { input: number; output: number }; model: string }> {
  const options = sources.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${p.brandName} ${p.name}, shade ${v.shadeName}` })));
  const res = await model.generate(
    {
      contents: [{ role: "user", parts: [{ text: ["TUGAS: padanan_teks. Pilih satu varian yang dimaksud pembeli dari daftar. Jawab varianId 0 bila tidak ada yang cocok.", `Kalimat: ${text.slice(0, 160)}`, "Daftar:", ...options.map((o) => `- ${o.id}: ${o.label}`)].join("\n") }] }],
      jsonSchema: { type: "OBJECT", properties: { varianId: { type: "INTEGER" } }, required: ["varianId"] },
      temperature: 0,
      maxOutputTokens: 60,
    },
    { timeoutMs },
  );
  const id = Number((JSON.parse(res.text || "{}") as { varianId?: unknown }).varianId);
  const hit = options.find((o) => o.id === id);
  return { pilih: hit ? { varianId: hit.id, label: hit.label } : null, usage: res.usage, model: res.model };
}
