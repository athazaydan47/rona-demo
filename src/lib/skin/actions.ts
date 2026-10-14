"use server";

// Server action Fase 7A: simpan profil kulit (kuis dan Shade Finder), padanan shade, dan tafsir kalimat padanan.
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { aiConfig, aiModel } from "@/lib/ai";
import { globalCapReached, logAi } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { padananShade, type ShadeMatch } from "@/lib/catalog/tools";
import { now } from "@/lib/clock";
import { currentSkinProfile, storeSkinProfile } from "./current";
import { quizToProfile, withShade, type QuizAnswers } from "./profile";
import { SHADE_GROUPS } from "./shade";
import { MEREK } from "@/config/merek";
import { BATAS, clientIp, hashKey, rateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";
import { cocok, skema } from "@/lib/validasi";

export async function saveQuizAction(answers: QuizAnswers): Promise<{ ok: boolean; where?: "akun" | "cookie"; message?: string }> {
  if (!cocok(skema.kuis, answers)) return { ok: false, message: "Jawaban kuis tidak valid." };
  const profile = quizToProfile(answers, now());
  if (!profile.skinType) return { ok: false, message: "Pilih jenis kulitmu dulu, ya." };
  return { ok: true, where: await storeSkinProfile(profile) };
}

export async function saveShadeProfileAction(raw: { depth: number; undertone: string }) {
  const input = cocok(skema.profilShade, raw);
  if (!input) return { ok: false };
  const p = withShade(await currentSkinProfile(), input, now());
  await storeSkinProfile(p);
  return { ok: true };
}

export type ShadeSourceProduct = { id: number; name: string; brandName: string; categorySlug: string; variants: { id: number; shadeName: string; hex: string }[] };

// Produk berkategori shade untuk dipilih sebagai "shade yang biasa kamu pakai".
export async function shadeSourcesAction(group?: string | null): Promise<ShadeSourceProduct[]> {
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

export async function shadeMatchAction(variantId: number, targetProductId?: number | null): Promise<{ sumber: { produk: string; shade: string; hex: string } | null; hasil: ShadeMatch[] }> {
  const id = Number(variantId);
  if (!Number.isInteger(id) || id <= 0) return { sumber: null, hasil: [] };
  const r = await padananShade(db, id, now(), targetProductId ? { targetProductId: Number(targetProductId) } : {});
  return { sumber: r.sumber, hasil: r.hasil };
}

// "aku pakai cushion Pualam shade 02" menjadi varian yang tepat (AI), lalu dihitung oleh algoritma padanan.
export async function interpretShadeTextAction(text: string): Promise<{ ok: true; varianId: number; label: string } | { ok: false; message: string }> {
  const cfg = aiConfig();
  const model = aiModel("aiPembeli", cfg);
  const q = String(text ?? "").trim().slice(0, 160);
  if (!model) return { ok: false, message: "Fitur ini butuh AI yang sedang tidak tersedia. Pilih produk dan shade dari daftar, ya." };
  if (q.length < 4) return { ok: false, message: "Tulis produk dan shade yang biasa kamu pakai." };
  const at = now();
  const batas = BATAS.tafsirShadePerPengunjung;
  const rl = await rateLimit(db, `tafsir-shade:${hashKey(clientIp(await headers()))}`, batas.limit, batas.windowMs, at);
  if (!rl.ok) return { ok: false, message: "Batas tafsiran hari ini sudah tercapai. Pilih produk dan shade dari daftar, ya." };
  if (await globalCapReached(db, cfg, at).catch(() => true)) return { ok: false, message: "Sedang istirahat, coba lagi besok. Kamu tetap bisa memilih dari daftar." };
  const sources = await shadeSourcesAction();
  const options = sources.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${p.brandName} ${p.name}, shade ${v.shadeName}` })));
  const t0 = Date.now();
  try {
    const res = await model.generate(
      {
        contents: [{ role: "user", parts: [{ text: ["TUGAS: padanan_teks. Pilih satu varian yang dimaksud pembeli dari daftar. Jawab varianId 0 bila tidak ada yang cocok.", `Kalimat: ${q}`, "Daftar:", ...options.map((o) => `- ${o.id}: ${o.label}`)].join("\n") }] }],
        jsonSchema: { type: "OBJECT", properties: { varianId: { type: "INTEGER" } }, required: ["varianId"] },
        temperature: 0,
        maxOutputTokens: 60,
      },
      { timeoutMs: 6000 },
    );
    const id = Number((JSON.parse(res.text || "{}") as { varianId?: unknown }).varianId);
    const hit = options.find((o) => o.id === id);
    await logAi(db, { feature: "padanan_shade", model: res.model, inputTokens: res.usage.input, outputTokens: res.usage.output, latencyMs: Date.now() - t0, ok: Boolean(hit), visitorHash: await currentVisitorHash(), at });
    return hit ? { ok: true, varianId: hit.id, label: hit.label } : { ok: false, message: `Produk itu belum kami temukan di katalog ${MEREK.nama}. Coba pilih dari daftar, ya.` };
  } catch (e) {
    await logAi(db, { feature: "padanan_shade", model: model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), visitorHash: await currentVisitorHash(), at }).catch(() => {});
    return { ok: false, message: "AI sedang tidak bisa dihubungi. Pilih produk dan shade dari daftar, ya." };
  }
}
