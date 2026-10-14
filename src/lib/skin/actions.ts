"use server";

// Server action Fase 7A: simpan profil kulit (kuis dan Shade Finder), padanan shade, dan tafsir kalimat padanan.
import { db } from "@/db/client";
import { aiConfig, aiModel } from "@/lib/ai";
import { globalCapReached, logAi } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { padananShade, type ShadeMatch } from "@/lib/catalog/tools";
import { now } from "@/lib/clock";
import { currentSkinProfile, storeSkinProfile } from "./current";
import { quizToProfile, withShade, type QuizAnswers } from "./profile";
import { resolveShadeText, shadeSources, tafsirShadeDenganAi, type ShadeSourceProduct } from "./tafsir-shade";
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

export type { ShadeSourceProduct };

// Produk berkategori shade untuk dipilih sebagai "shade yang biasa kamu pakai".
export async function shadeSourcesAction(group?: string | null): Promise<ShadeSourceProduct[]> {
  return shadeSources(db, group ?? null);
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
  const sources = await shadeSources(db);
  // Aturan dulu (merek, nama produk, kode shade); AI hanya bila aturan tidak menemukan satu varian pun.
  const rule = resolveShadeText(q, sources);
  if (rule.status === "cocok") return { ok: true, varianId: rule.pilih.varianId, label: rule.pilih.label };
  const t0 = Date.now();
  try {
    const r = await tafsirShadeDenganAi(model, q, sources);
    await logAi(db, { feature: "padanan_shade", model: r.model, inputTokens: r.usage.input, outputTokens: r.usage.output, latencyMs: Date.now() - t0, ok: Boolean(r.pilih), visitorHash: await currentVisitorHash(), at });
    return r.pilih ? { ok: true, varianId: r.pilih.varianId, label: r.pilih.label } : { ok: false, message: `Produk itu belum kami temukan di katalog ${MEREK.nama}. Coba pilih dari daftar, ya.` };
  } catch (e) {
    await logAi(db, { feature: "padanan_shade", model: model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), visitorHash: await currentVisitorHash(), at }).catch(() => {});
    return { ok: false, message: "AI sedang tidak bisa dihubungi. Pilih produk dan shade dari daftar, ya." };
  }
}
