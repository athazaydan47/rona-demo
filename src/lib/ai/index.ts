// Titik masuk AI: model sesuai konfigurasi (Gemini lewat Cloudflare AI Gateway, mock, atau tidak ada).
// Sejak Fase 8B setiap pemakai menyebut kelompok fiturnya; bila fitur itu dimatikan di src/config/fitur.ts, model null
// dan UI AI terkait tersembunyi seperti saat kunci AI kosong.
import { fiturAktif, type Fitur } from "@/config/fitur";
import { aiConfig, aiTersedia as kunciAiAda, createGeminiModel, type AiConfig, type AiModel } from "./client";
import { createMockModel } from "./mock";

export { aiConfig } from "./client";

export type FiturAi = Extract<Fitur, "aiPembeli" | "aiFotoLink" | "asistenAdmin">;

// UI AI untuk sebuah kelompok fitur hanya dirender bila kunci AI ada dan fiturnya aktif.
export function aiTersedia(fitur: FiturAi, cfg: AiConfig = aiConfig()) {
  return fiturAktif(fitur) && kunciAiAda(cfg);
}

export function aiModel(fitur: FiturAi, cfg: AiConfig = aiConfig()): AiModel | null {
  if (!fiturAktif(fitur)) return null;
  if (cfg.provider === "mock") return createMockModel();
  if (cfg.provider === "gemini") return createGeminiModel(cfg);
  return null;
}
