// Klien AI tunggal: Gemini lewat Cloudflare AI Gateway (penyedia Google AI Studio), atau mock deterministik.
// Format URL dan header mengikuti dokumentasi Cloudflare AI Gateway:
//   POST {AI_GATEWAY_URL}/v1beta/models/{model}:generateContent
//   AI_GATEWAY_URL = https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio
//   header x-goog-api-key: GEMINI_API_KEY, dan cf-aig-authorization: Bearer CF_AIG_TOKEN bila gateway terautentikasi.
// v1beta dipakai karena function calling dan responseSchema tersedia di sana.

export type AiConfig = {
  provider: "gemini" | "mock" | "none";
  gatewayUrl: string;
  apiKey: string;
  model: string;
  aigToken: string;
  apiVersion: string;
  dailyCap: number;
  demoMode: boolean;
};

export const DEFAULT_MODEL = "gemini-3.5-flash";
export const DEFAULT_DAILY_CAP = 1000;

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const mock = env.AI_PROVIDER?.trim().toLowerCase() === "mock";
  const gatewayUrl = (env.AI_GATEWAY_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (env.GEMINI_API_KEY ?? "").trim();
  const cap = Number.parseInt(env.AI_DAILY_CAP ?? "", 10);
  return {
    provider: mock ? "mock" : gatewayUrl && apiKey ? "gemini" : "none",
    gatewayUrl,
    apiKey,
    model: (env.AI_MODEL ?? "").trim() || DEFAULT_MODEL,
    aigToken: (env.CF_AIG_TOKEN ?? "").trim(),
    apiVersion: (env.AI_API_VERSION ?? "").trim() || "v1beta",
    dailyCap: Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_DAILY_CAP,
    demoMode: env.DEMO_MODE === "true",
  };
}

// UI AI hanya dirender bila ini true. Fitur berbasis aturan tetap jalan tanpa AI.
export function aiTersedia(cfg: AiConfig = aiConfig()) {
  return cfg.provider !== "none";
}

// ---------- Bentuk permintaan dan jawaban (subset API Gemini) ----------

export type Part = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  thoughtSignature?: string;
  thought?: boolean;
};
export type Content = { role: "user" | "model"; parts: Part[] };
export type Schema = { type: "OBJECT" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY"; description?: string; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; required?: string[]; nullable?: boolean };
export type FunctionDecl = { name: string; description: string; parameters: Schema };

export type GenRequest = {
  system?: string;
  contents: Content[];
  tools?: FunctionDecl[];
  toolMode?: "AUTO" | "ANY" | "NONE";
  jsonSchema?: Schema;
  temperature?: number;
  maxOutputTokens?: number;
};
export type GenResponse = { content: Content; text: string; functionCalls: { name: string; args: Record<string, unknown>; id?: string }[]; usage: { input: number; output: number }; model: string };

export interface AiModel {
  readonly name: string;
  generate(req: GenRequest, opts?: { timeoutMs?: number }): Promise<GenResponse>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function requestBody(req: GenRequest) {
  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: req.contents,
    ...(req.tools?.length ? { tools: [{ functionDeclarations: req.tools }], toolConfig: { functionCallingConfig: { mode: req.toolMode ?? "AUTO" } } } : {}),
    generationConfig: {
      temperature: req.temperature ?? 0.3,
      maxOutputTokens: req.maxOutputTokens ?? 1024,
      ...(req.jsonSchema ? { responseMimeType: "application/json", responseSchema: req.jsonSchema } : {}),
    },
  };
}

export function parseResponse(data: unknown, model: string): GenResponse {
  const d = data as { candidates?: { content?: Content; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }; promptFeedback?: { blockReason?: string } };
  const content = d.candidates?.[0]?.content ?? { role: "model" as const, parts: [] };
  if (!d.candidates?.length) throw new AiError(`Jawaban kosong${d.promptFeedback?.blockReason ? ` (${d.promptFeedback.blockReason})` : ""}`, false);
  const parts = content.parts ?? [];
  return {
    content: { role: "model", parts },
    text: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(""),
    functionCalls: parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {}, id: p.functionCall!.id })),
    usage: { input: d.usageMetadata?.promptTokenCount ?? 0, output: (d.usageMetadata?.candidatesTokenCount ?? 0) + (d.usageMetadata?.thoughtsTokenCount ?? 0) },
    model,
  };
}

export function createGeminiModel(cfg: AiConfig, fetchImpl: typeof fetch = fetch): AiModel {
  const url = `${cfg.gatewayUrl}/${cfg.apiVersion}/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const headers: Record<string, string> = { "content-type": "application/json", "x-goog-api-key": cfg.apiKey };
  if (cfg.aigToken) headers["cf-aig-authorization"] = `Bearer ${cfg.aigToken}`;
  const once = async (req: GenRequest, timeoutMs: number) => {
    let res: Response;
    try {
      res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(requestBody(req)), signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new AiError(timeout ? "Waktu habis" : `Jaringan: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } | { message?: string }[] }).error;
      const text = Array.isArray(msg) ? msg[0]?.message : msg?.message;
      throw new AiError(`HTTP ${res.status}: ${text ?? "tanpa pesan"}`.slice(0, 300), res.status === 429 || res.status >= 500, res.status);
    }
    return parseResponse(data, cfg.model);
  };
  return {
    name: cfg.model,
    // Satu kali coba ulang untuk error sementara (429, 5xx, waktu habis), dalam anggaran waktu yang sama.
    async generate(req, opts = {}) {
      const budget = opts.timeoutMs ?? 20_000;
      const started = Date.now();
      try {
        return await once(req, budget);
      } catch (e) {
        const left = budget - (Date.now() - started);
        if (!(e instanceof AiError) || !e.retryable || left < 800) throw e;
        await new Promise((r) => setTimeout(r, 250));
        return once(req, left - 250);
      }
    },
  };
}
