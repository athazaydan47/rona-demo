// Titik masuk AI: model sesuai konfigurasi (Gemini lewat Cloudflare AI Gateway, mock, atau tidak ada).
import { aiConfig, createGeminiModel, type AiConfig, type AiModel } from "./client";
import { createMockModel } from "./mock";

export { aiConfig, aiTersedia } from "./client";

export function aiModel(cfg: AiConfig = aiConfig()): AiModel | null {
  if (cfg.provider === "mock") return createMockModel();
  if (cfg.provider === "gemini") return createGeminiModel(cfg);
  return null;
}
