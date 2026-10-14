// Penjelasan AI singkat untuk rutinitas (opsional). Di-cache per hash profil dan isi rutinitas, jadi kombinasi yang
// sama tidak memanggil AI lagi. Bila AI gagal, rutinitas tetap tampil tanpa penjelasan.
import type { SkinProfile } from "@/db/schema/customers";
import type { AnyDb } from "@/lib/db-types";
import { formatRupiah } from "@/lib/format";
import { profileKey } from "@/lib/skin/profile";
import { routineKey, type Routine } from "@/lib/skin/routine";
import type { AiModel } from "./client";
import { medicalClaims } from "./guard";
import { cacheGet, cacheSet, logAi, shortHash } from "./usage";

export async function explainRoutine(db: AnyDb, model: AiModel, profile: SkinProfile, routine: Routine, now: Date, opts: { visitorHash?: string; timeoutMs?: number } = {}): Promise<string | null> {
  const key = `rutinitas:${shortHash(`${profileKey(profile)}#${routineKey(routine)}`)}`;
  const cached = await cacheGet<{ penjelasan: string }>(db, key, now).catch(() => null);
  if (cached?.penjelasan) return cached.penjelasan;
  const lines = [
    "TUGAS: jelaskan_rutinitas. Tulis 2 sampai 3 kalimat bahasa Indonesia dengan sapaan kamu: kenapa urutan ini cocok untuk profil ini. Tanpa klaim medis, tanpa menyebut produk lain.",
    `Profil: kulit ${profile.skinType}${profile.concerns?.length ? `, masalah ${profile.concerns.join(", ")}` : ""}${profile.sensitivity ? `, sensitivitas ${profile.sensitivity}` : ""}.`,
    `Pagi: ${routine.pagi.map((s) => `${s.label} (${s.main.name})`).join(", ")}.`,
    `Malam: ${routine.malam.map((s) => `${s.label} (${s.main.name})`).join(", ")}.`,
    `Total ${formatRupiah(routine.total)}.`,
    routine.warnings.length ? `Catatan: ${routine.warnings.map((w) => w.text).join(" ")}` : "",
  ];
  const t0 = Date.now();
  try {
    const res = await model.generate({ contents: [{ role: "user", parts: [{ text: lines.filter(Boolean).join("\n") }] }], jsonSchema: { type: "OBJECT", properties: { penjelasan: { type: "STRING" } }, required: ["penjelasan"] }, temperature: 0.4, maxOutputTokens: 300 }, { timeoutMs: opts.timeoutMs ?? 6000 });
    const text = String((JSON.parse(res.text || "{}") as { penjelasan?: unknown }).penjelasan ?? "").trim().slice(0, 600);
    const ok = Boolean(text) && !medicalClaims(text).length;
    await logAi(db, { feature: "rutinitas", model: res.model, inputTokens: res.usage.input, outputTokens: res.usage.output, latencyMs: Date.now() - t0, ok, visitorHash: opts.visitorHash, at: now }).catch(() => {});
    if (!ok) return null;
    await cacheSet(db, key, "rutinitas", { penjelasan: text }, 30, now).catch(() => {});
    return text;
  } catch (e) {
    await logAi(db, { feature: "rutinitas", model: model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), visitorHash: opts.visitorHash, at: now }).catch(() => {});
    return null;
  }
}
