// Bantu isi kuis dari foto (opsional). Foto wajah dibaca model untuk memperkirakan kondisi yang TAMPAK saja, dengan
// skema ketat tanpa kolom teks bebas: tidak ada tempat untuk diagnosis, nama kondisi kulit, usia, jenis kelamin, etnis,
// identitas, atau saran pengobatan. Keluaran di luar skema ditolak server. Hasilnya hanya usulan jawaban kuis:
// keyakinan rendah tidak diisi, dan pembeli tetap mengonfirmasi setiap langkah.
// Foto hanya ada di memori selama permintaan. ai_logs hanya mencatat fitur, token, latensi, dan berhasil atau gagal.
import type { AnyDb } from "@/lib/db-types";
import { depthLabels } from "@/lib/shade";
import type { QuizAnswers } from "@/lib/skin/profile";
import type { AiModel, Schema } from "./client";
import type { ImageInput } from "./images";
import { logAi } from "./usage";

export const CONFIDENCE = ["rendah", "sedang", "tinggi"] as const;
export type Confidence = (typeof CONFIDENCE)[number];
const AMOUNT = ["tidak", "sedikit", "jelas"] as const;
const PRESENCE = ["ada", "tidak"] as const;
const UNDERTONES = ["warm", "neutral", "cool"] as const;
export const PHOTO_QUALITY = ["cukup", "gelap", "buram", "berfilter", "wajah_tidak_terlihat"] as const;
export type PhotoQuality = (typeof PHOTO_QUALITY)[number];

export type Observation<T> = { nilai: T; keyakinan: Confidence };
export type SkinPhotoReading = {
  kilap: Observation<(typeof AMOUNT)[number]>;
  kering: Observation<(typeof AMOUNT)[number]>;
  kemerahan: Observation<(typeof AMOUNT)[number]>;
  noda: Observation<(typeof PRESENCE)[number]>;
  kedalaman: Observation<number>;
  undertone: Observation<(typeof UNDERTONES)[number]>;
  kualitas: PhotoQuality;
};

// Satu-satunya kolom yang boleh ada. Kolom lain (misal diagnosis, usia, saran) membuat seluruh keluaran ditolak.
export const SKIN_PHOTO_FIELDS = ["kilap", "kering", "kemerahan", "noda", "kedalaman", "undertone", "kualitas"] as const;

const obs = (nilai: Schema): Schema => ({ type: "OBJECT", properties: { nilai, keyakinan: { type: "STRING", enum: [...CONFIDENCE] } }, required: ["nilai", "keyakinan"], propertyOrdering: ["nilai", "keyakinan"] });

export const SKIN_PHOTO_SCHEMA: Schema = {
  type: "OBJECT",
  properties: {
    kilap: obs({ type: "STRING", enum: [...AMOUNT], description: "kilap atau minyak yang tampak" }),
    kering: obs({ type: "STRING", enum: [...AMOUNT], description: "kesan kering atau mengelupas yang tampak" }),
    kemerahan: obs({ type: "STRING", enum: [...AMOUNT], description: "kemerahan yang tampak" }),
    noda: obs({ type: "STRING", enum: [...PRESENCE], description: "noda atau jerawat yang tampak, tanpa jenis" }),
    kedalaman: obs({ type: "INTEGER", minimum: 1, maximum: 6, description: "perkiraan kedalaman warna kulit 1 sampai 6" }),
    undertone: obs({ type: "STRING", enum: [...UNDERTONES] }),
    kualitas: { type: "STRING", enum: [...PHOTO_QUALITY] },
  },
  required: [...SKIN_PHOTO_FIELDS],
  propertyOrdering: ["kualitas", ...SKIN_PHOTO_FIELDS.filter((f) => f !== "kualitas")],
};

export function skinPhotoPrompt() {
  return [
    "TUGAS: foto_kulit. Ini foto wajah dari pembeli toko kosmetik untuk membantu mengisi kuis kulit. Nilai hanya yang TAMPAK di foto.",
    "Isi kualitas dulu: cukup, gelap, buram, berfilter (filter atau efek kecantikan), atau wajah_tidak_terlihat. Bila kualitas tidak cukup, beri keyakinan rendah untuk semua kolom.",
    `Kedalaman warna kulit: ${depthLabels.map((d) => `${d.depth} ${d.label.toLowerCase()} (${d.hex})`).join(", ")}.`,
    "Jangan menyebut diagnosis atau nama kondisi kulit. Jangan menebak usia, jenis kelamin, etnis, atau identitas. Jangan memberi saran pengobatan. Isi hanya kolom skema.",
  ].join("\n");
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function readObs<T>(raw: unknown, ok: (v: unknown) => v is T): Observation<T> | null {
  if (!isPlainObject(raw)) return null;
  if (Object.keys(raw).some((k) => k !== "nilai" && k !== "keyakinan")) return null;
  if (!ok(raw.nilai) || !CONFIDENCE.includes(raw.keyakinan as Confidence)) return null;
  return { nilai: raw.nilai, keyakinan: raw.keyakinan as Confidence };
}
const inList = <T extends string>(list: readonly T[]) => (v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const isDepth = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6;

// Validasi ketat: kolom di luar skema, nilai di luar daftar, atau bentuk yang salah membuat seluruh keluaran ditolak.
export function validateSkinPhoto(raw: unknown): SkinPhotoReading | null {
  if (!isPlainObject(raw)) return null;
  if (Object.keys(raw).some((k) => !(SKIN_PHOTO_FIELDS as readonly string[]).includes(k))) return null;
  const kilap = readObs(raw.kilap, inList(AMOUNT));
  const kering = readObs(raw.kering, inList(AMOUNT));
  const kemerahan = readObs(raw.kemerahan, inList(AMOUNT));
  const noda = readObs(raw.noda, inList(PRESENCE));
  const kedalaman = readObs(raw.kedalaman, isDepth);
  const undertone = readObs(raw.undertone, inList(UNDERTONES));
  const kualitas = inList(PHOTO_QUALITY)(raw.kualitas) ? raw.kualitas : null;
  if (!kilap || !kering || !kemerahan || !noda || !kedalaman || !undertone || !kualitas) return null;
  return { kilap, kering, kemerahan, noda, kedalaman, undertone, kualitas };
}

export type QuizSuggestion = { answers: Partial<QuizAnswers>; fromPhoto: (keyof QuizAnswers)[]; hints: Partial<Record<keyof QuizAnswers, string>> };
const sure = (o: { keyakinan: Confidence }) => o.keyakinan !== "rendah";

// Usulan jawaban kuis dari pembacaan foto. Hanya keyakinan sedang atau tinggi yang diisi; sensitivitas, budget, dan
// rutinitas tidak bisa dilihat dari foto sehingga tetap diisi pembeli.
export function suggestionFromPhoto(r: SkinPhotoReading): QuizSuggestion {
  const answers: Partial<QuizAnswers> = {};
  const hints: QuizSuggestion["hints"] = {};
  if (sure(r.kilap) && sure(r.kering)) {
    const shine = r.kilap.nilai;
    const dry = r.kering.nilai;
    answers.skinType = shine === "jelas" && dry === "tidak" ? "berminyak" : dry === "jelas" && shine === "tidak" ? "kering" : shine !== "tidak" && dry !== "tidak" ? "kombinasi" : "normal";
  }
  if (sure(r.noda) && r.noda.nilai === "ada") answers.concerns = ["jerawat"];
  if (sure(r.kedalaman)) answers.depth = r.kedalaman.nilai;
  if (sure(r.undertone)) answers.undertone = r.undertone.nilai;
  if (sure(r.kemerahan) && r.kemerahan.nilai === "jelas") hints.sensitivity = "Foto menunjukkan kemerahan. Bila kulitmu memang mudah bereaksi, pilih jawaban yang sesuai.";
  return { answers, fromPhoto: Object.keys(answers) as (keyof QuizAnswers)[], hints };
}

export const QUALITY_TIPS: Record<Exclude<PhotoQuality, "cukup">, string> = {
  gelap: "Fotonya terlalu gelap. Coba menghadap jendela di siang hari, tanpa lampu kuning.",
  buram: "Fotonya buram. Pegang ponsel lebih stabil dan pastikan kamera fokus ke wajah.",
  berfilter: "Sepertinya ada filter atau efek kecantikan. Pakai kamera biasa tanpa filter, ya.",
  wajah_tidak_terlihat: "Wajah belum terlihat jelas. Ambil foto dari depan, seluruh wajah masuk bingkai.",
};

export type SkinPhotoOutcome =
  | { ok: true; quality: "cukup"; suggestion: QuizSuggestion }
  | { ok: true; quality: Exclude<PhotoQuality, "cukup">; tip: string }
  | { ok: false; message: string };

// Satu foto, satu panggilan model. Tidak ada cache dan tidak ada penyimpanan: hanya baris ai_logs tanpa isi foto.
export async function analyzeSkinPhoto(db: AnyDb, model: AiModel, image: ImageInput, opts: { now: Date; visitorHash: string; timeoutMs?: number }): Promise<SkinPhotoOutcome> {
  const t0 = Date.now();
  try {
    const res = await model.generate(
      { contents: [{ role: "user", parts: [{ inlineData: image }, { text: skinPhotoPrompt() }] }], jsonSchema: SKIN_PHOTO_SCHEMA, mediaResolution: "medium", temperature: 0.2, maxOutputTokens: 400 },
      { timeoutMs: opts.timeoutMs ?? 20_000 },
    );
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(res.text || "null");
    } catch {
      parsed = null;
    }
    const reading = validateSkinPhoto(parsed);
    await logAi(db, { feature: "foto_kulit", model: res.model, inputTokens: res.usage.input, outputTokens: res.usage.output, latencyMs: Date.now() - t0, ok: Boolean(reading), error: reading ? null : "Keluaran di luar skema", visitorHash: opts.visitorHash, at: opts.now }).catch(() => {});
    if (!reading) return { ok: false, message: "Foto belum bisa dibaca. Coba foto lain, atau isi kuisnya sendiri." };
    if (reading.kualitas !== "cukup") return { ok: true, quality: reading.kualitas, tip: QUALITY_TIPS[reading.kualitas] };
    return { ok: true, quality: "cukup", suggestion: suggestionFromPhoto(reading) };
  } catch (e) {
    await logAi(db, { feature: "foto_kulit", model: model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), visitorHash: opts.visitorHash, at: opts.now }).catch(() => {});
    return { ok: false, message: "Foto belum bisa diproses sekarang. Coba lagi sebentar lagi, atau isi kuisnya sendiri." };
  }
}
