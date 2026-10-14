// Transkripsi masukan suara Asisten Admin lewat Gemini. Rekaman hanya di memori selama permintaan, tidak disimpan,
// dan isi permintaannya tidak dicatat di log gateway (header cf-aig-collect-log-payload, lihat client.ts).
import type { AiModel } from "@/lib/ai/client";
import { logAi } from "@/lib/ai/usage";
import type { AnyDb } from "@/lib/db-types";

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 60 detik Opus kira-kira 0,5 MB
export const MAX_AUDIO_SECONDS = 60;

export function sniffAudio(b: Uint8Array): string | null {
  const ascii = (from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (b.length >= 4 && ascii(0, 4) === "OggS") return "audio/ogg";
  if (b.length >= 12 && ascii(4, 4) === "ftyp") return "audio/mp4";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio/wav";
  if (b.length >= 3 && (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))) return "audio/mp3";
  return null;
}

export type TranscribeResult = { ok: true; teks: string } | { ok: false; message: string };

export async function transcribeAudio(db: AnyDb, model: AiModel, bytes: Uint8Array, opts: { staffId: number; now: Date }): Promise<TranscribeResult> {
  if (!bytes.length) return { ok: false, message: "Rekamannya kosong. Coba lagi, ya." };
  if (bytes.length > MAX_AUDIO_BYTES) return { ok: false, message: `Rekaman terlalu panjang. Maksimal ${MAX_AUDIO_SECONDS} detik.` };
  const mimeType = sniffAudio(bytes);
  if (!mimeType) return { ok: false, message: "Format rekaman belum didukung." };
  const t0 = Date.now();
  try {
    const res = await model.generate(
      {
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } }, { text: "TUGAS: transkripsi. Tulis ulang ucapan dalam rekaman ini persis dalam bahasa Indonesia, tanpa tambahan. Bila tidak ada ucapan, kembalikan teks kosong." }] }],
        temperature: 0,
        maxOutputTokens: 300,
      },
      { timeoutMs: 20_000 },
    );
    const teks = res.text.replace(/\s+/g, " ").trim().slice(0, 500);
    await logAi(db, { feature: "transkripsi", model: res.model, inputTokens: res.usage.input, outputTokens: res.usage.output, latencyMs: Date.now() - t0, ok: Boolean(teks), staffId: opts.staffId, door: "panel", visitorHash: `staf:${opts.staffId}`, at: opts.now }).catch(() => {});
    return teks ? { ok: true, teks } : { ok: false, message: "Suaramu belum terdengar jelas. Coba lagi di tempat yang lebih tenang." };
  } catch (e) {
    await logAi(db, { feature: "transkripsi", model: model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), staffId: opts.staffId, door: "panel", visitorHash: `staf:${opts.staffId}`, at: opts.now }).catch(() => {});
    return { ok: false, message: "Rekaman belum bisa diproses. Ketik pertanyaanmu, ya." };
  }
}
