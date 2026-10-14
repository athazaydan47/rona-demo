// Klien AI tunggal: Gemini lewat Cloudflare AI Gateway (penyedia Google AI Studio), atau mock deterministik.
// Format URL dan header mengikuti dokumentasi Cloudflare AI Gateway:
//   POST {AI_GATEWAY_URL}/v1beta/models/{model}:generateContent
//   AI_GATEWAY_URL = https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio
//   header x-goog-api-key: GEMINI_API_KEY, dan cf-aig-authorization: Bearer CF_AIG_TOKEN bila gateway terautentikasi.
// v1beta dipakai karena function calling dan responseSchema tersedia di sana. Streaming memakai
//   POST {AI_GATEWAY_URL}/v1beta/models/{model}:streamGenerateContent?alt=sse
// Tingkat berpikir (thinkingConfig.thinkingLevel) dibuat serendah mungkin: "minimal" untuk model yang mendukungnya,
// "low" untuk Gemini 3.8 Flash (tidak mendukung minimal, sesuai dokumentasi Gemini, dicek 14 Okt 2026).

export type AiConfig = {
  provider: "gemini" | "mock" | "none";
  gatewayUrl: string;
  apiKey: string;
  model: string;
  aigToken: string;
  apiVersion: string;
  thinkingLevel: ThinkingLevel;
  dailyCap: number;
  demoMode: boolean;
};

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
const THINKING_LEVELS: ThinkingLevel[] = ["minimal", "low", "medium", "high"];

// Tingkat berpikir terendah yang didukung model (Gemini 3.8 Flash mulai dari "low").
export function lowestThinkingLevel(model: string): ThinkingLevel {
  return /gemini-3\.8|gemini-4/.test(model) ? "low" : "minimal";
}

export const DEFAULT_MODEL = "gemini-3.6-flash";
export const DEFAULT_DAILY_CAP = 1000;

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const mock = env.AI_PROVIDER?.trim().toLowerCase() === "mock";
  const gatewayUrl = (env.AI_GATEWAY_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (env.GEMINI_API_KEY ?? "").trim();
  const cap = Number.parseInt(env.AI_DAILY_CAP ?? "", 10);
  const model = (env.AI_MODEL ?? "").trim() || DEFAULT_MODEL;
  const level = (env.AI_THINKING_LEVEL ?? "").trim().toLowerCase() as ThinkingLevel;
  return {
    provider: mock ? "mock" : gatewayUrl && apiKey ? "gemini" : "none",
    gatewayUrl,
    apiKey,
    model,
    aigToken: (env.CF_AIG_TOKEN ?? "").trim(),
    apiVersion: (env.AI_API_VERSION ?? "").trim() || "v1beta",
    thinkingLevel: THINKING_LEVELS.includes(level) ? level : lowestThinkingLevel(model),
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
  inlineData?: { mimeType: string; data: string }; // gambar base64, hanya di memori selama permintaan
  fileData?: { mimeType?: string; fileUri: string }; // URL YouTube publik (diambil langsung oleh Google)
  videoMetadata?: { startOffset?: string; endOffset?: string; fps?: number };
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  thoughtSignature?: string;
  thought?: boolean;
};
export type Content = { role: "user" | "model"; parts: Part[] };
export type Schema = { type: "OBJECT" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY"; description?: string; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; required?: string[]; nullable?: boolean; propertyOrdering?: string[]; minimum?: number; maximum?: number; maxItems?: number };
export type FunctionDecl = { name: string; description: string; parameters: Schema };

export type GenRequest = {
  system?: string;
  contents: Content[];
  tools?: FunctionDecl[];
  toolMode?: "AUTO" | "ANY" | "NONE";
  jsonSchema?: Schema;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingLevel?: ThinkingLevel; // bawaan: AiConfig.thinkingLevel
  mediaResolution?: "low" | "medium" | "high";
};
export type GenResponse = { content: Content; text: string; functionCalls: { name: string; args: Record<string, unknown>; id?: string }[]; usage: { input: number; output: number }; model: string };

export type GenOptions = { timeoutMs?: number };

export interface AiModel {
  readonly name: string;
  generate(req: GenRequest, opts?: GenOptions): Promise<GenResponse>;
  // Sama dengan generate, tetapi teks dialirkan lewat onText begitu tiba. Hasil akhirnya identik.
  stream(req: GenRequest, onText: (delta: string) => void, opts?: GenOptions): Promise<GenResponse>;
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

const MEDIA_RESOLUTION = { low: "MEDIA_RESOLUTION_LOW", medium: "MEDIA_RESOLUTION_MEDIUM", high: "MEDIA_RESOLUTION_HIGH" } as const;

export function requestBody(req: GenRequest, defaults: { thinkingLevel?: ThinkingLevel } = {}) {
  const thinkingLevel = req.thinkingLevel ?? defaults.thinkingLevel;
  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: req.contents,
    ...(req.tools?.length ? { tools: [{ functionDeclarations: req.tools }], toolConfig: { functionCallingConfig: { mode: req.toolMode ?? "AUTO" } } } : {}),
    generationConfig: {
      temperature: req.temperature ?? 0.3,
      maxOutputTokens: req.maxOutputTokens ?? 1024,
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
      ...(req.mediaResolution ? { mediaResolution: MEDIA_RESOLUTION[req.mediaResolution] } : {}),
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

// Gabungkan potongan stream menjadi satu konten: teks yang berurutan disatukan (thoughtSignature ikut disimpan),
// function call disimpan utuh supaya bisa dikirim balik apa adanya.
export function mergeStreamParts(chunks: Part[][]): Part[] {
  const out: Part[] = [];
  for (const parts of chunks) {
    for (const p of parts) {
      const last = out[out.length - 1];
      if (p.text != null && !p.functionCall && last && last.text != null && !last.functionCall && Boolean(last.thought) === Boolean(p.thought)) {
        last.text += p.text;
        if (p.thoughtSignature) last.thoughtSignature = p.thoughtSignature;
      } else if (p.text === "" && p.thoughtSignature && last && !last.thoughtSignature) {
        last.thoughtSignature = p.thoughtSignature;
      } else {
        out.push({ ...p });
      }
    }
  }
  return out;
}

// Baca stream SSE Gemini. onText dipanggil untuk setiap potongan teks jawaban (bukan teks berpikir).
export async function readSse(body: ReadableStream<Uint8Array>, model: string, onText: (delta: string) => void): Promise<GenResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: Part[][] = [];
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;
  let blocked: string | undefined;
  let any = false;
  let buf = "";
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const d = JSON.parse(line.slice(5).trim()) as { candidates?: { content?: Content }[]; usageMetadata?: typeof usage; promptFeedback?: { blockReason?: string } };
    if (d.usageMetadata) usage = d.usageMetadata;
    if (d.promptFeedback?.blockReason) blocked = d.promptFeedback.blockReason;
    const parts = d.candidates?.[0]?.content?.parts ?? [];
    if (d.candidates?.length) any = true;
    chunks.push(parts);
    for (const p of parts) if (p.text && !p.thought) onText(p.text);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) handle(line.trim());
  }
  if (buf.trim()) handle(buf.trim());
  if (!any) throw new AiError(`Jawaban kosong${blocked ? ` (${blocked})` : ""}`, false);
  return parseResponse({ candidates: [{ content: { role: "model", parts: mergeStreamParts(chunks) } }], usageMetadata: usage }, model);
}

// Model tanpa stream asli (mock dan uji): teks dikirim sekaligus setelah jawaban selesai.
export function withStream(m: { name: string; generate: AiModel["generate"] }): AiModel {
  return {
    name: m.name,
    generate: (req, opts) => m.generate(req, opts),
    async stream(req, onText, opts) {
      const res = await m.generate(req, opts);
      if (res.text) onText(res.text);
      return res;
    },
  };
}

export function createGeminiModel(cfg: AiConfig, fetchImpl: typeof fetch = fetch): AiModel {
  const base = `${cfg.gatewayUrl}/${cfg.apiVersion}/models/${encodeURIComponent(cfg.model)}`;
  const headers: Record<string, string> = { "content-type": "application/json", "x-goog-api-key": cfg.apiKey };
  if (cfg.aigToken) headers["cf-aig-authorization"] = `Bearer ${cfg.aigToken}`;
  const post = async (req: GenRequest, timeoutMs: number, stream: boolean) => {
    let res: Response;
    try {
      // Foto dan screenshot pembeli tidak boleh tersimpan di log gateway: isi permintaan dan jawaban dilewati,
      // hanya metadata (token, status, durasi) yang dicatat Cloudflare AI Gateway.
      const hasImage = req.contents.some((c) => c.parts.some((p) => p.inlineData));
      res = await fetchImpl(stream ? `${base}:streamGenerateContent?alt=sse` : `${base}:generateContent`, { method: "POST", headers: hasImage ? { ...headers, "cf-aig-collect-log-payload": "false" } : headers, body: JSON.stringify(requestBody(req, { thinkingLevel: cfg.thinkingLevel })), signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new AiError(timeout ? "Waktu habis" : `Jaringan: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data as { error?: { message?: string } | { message?: string }[] }).error;
      const text = Array.isArray(msg) ? msg[0]?.message : msg?.message;
      throw new AiError(`HTTP ${res.status}: ${text ?? "tanpa pesan"}`.slice(0, 300), res.status === 429 || res.status >= 500, res.status);
    }
    return res;
  };
  // Satu kali coba ulang untuk error sementara (429, 5xx, waktu habis), dalam anggaran waktu yang sama.
  const withRetry = async <T,>(budget: number, run: (timeoutMs: number) => Promise<T>, canRetry: () => boolean = () => true) => {
    const started = Date.now();
    try {
      return await run(budget);
    } catch (e) {
      const left = budget - (Date.now() - started);
      if (!(e instanceof AiError) || !e.retryable || left < 800 || !canRetry()) throw e;
      await new Promise((r) => setTimeout(r, 250));
      return run(left - 250);
    }
  };
  return {
    name: cfg.model,
    async generate(req, opts = {}) {
      return withRetry(opts.timeoutMs ?? 20_000, async (t) => parseResponse(await (await post(req, t, false)).json().catch(() => ({})), cfg.model));
    },
    async stream(req, onText, opts = {}) {
      // Coba ulang hanya bila belum ada teks yang terkirim, supaya pembeli tidak melihat teks ganda.
      let sent = false;
      return withRetry(
        opts.timeoutMs ?? 20_000,
        async (t) => {
          const res = await post(req, t, true);
          if (!res.body) throw new AiError("Stream kosong", true);
          try {
            return await readSse(res.body, cfg.model, (d) => {
              sent = true;
              onText(d);
            });
          } catch (e) {
            if (e instanceof AiError) throw e;
            const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
            throw new AiError(timeout ? "Waktu habis" : `Stream terputus: ${e instanceof Error ? e.message : String(e)}`, true);
          }
        },
        () => !sent,
      );
    },
  };
}
