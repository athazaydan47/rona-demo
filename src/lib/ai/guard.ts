// Pagar pengaman keluaran Rona Advisor (murni): id produk wajib berasal dari hasil tool di percakapan ini, nama
// produk katalog yang tidak ada di hasil tool ditolak, dan kata klaim medis dilarang.

export const MAX_RECOMMENDED = 4;

// Kata yang menandakan klaim medis. Dipakai saat validasi dan di evaluasi (npm run eval:ai).
export const MEDICAL_BANNED = [
  "menyembuhkan",
  "mengobati",
  "obat jerawat",
  "dijamin sembuh",
  "pasti sembuh",
  "terbukti klinis",
  "terbukti secara klinis",
  "menghilangkan permanen",
  "diagnosis",
  "resep dokter",
  "antibiotik",
] as const;

export function medicalClaims(text: string) {
  const t = text.toLowerCase();
  // "Dokter kulit" boleh (arahan ke dokter), yang dilarang klaim penyembuhan.
  return MEDICAL_BANNED.filter((w) => t.includes(w));
}

export type AdvisorOutput = { teks: string; produkIds: number[] };
export type ValidationResult = { ids: number[]; rejectedIds: number[]; foreignNames: string[]; medical: string[] };

// allowedIds: produk yang muncul di hasil tool percakapan ini. catalogNames: semua nama produk aktif.
// allowedNames: nama produk di hasil tool. Nama di teks yang ada di katalog tetapi tidak di hasil tool = mengarang.
export function validateAdvisorOutput(out: AdvisorOutput, allowedIds: Set<number>, catalogNames: string[], allowedNames: Set<string>): ValidationResult {
  const seen = new Set<number>();
  const ids: number[] = [];
  const rejectedIds: number[] = [];
  for (const raw of out.produkIds ?? []) {
    const id = Number(raw);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    if (allowedIds.has(id) && ids.length < MAX_RECOMMENDED) ids.push(id);
    else rejectedIds.push(id);
  }
  const text = (out.teks ?? "").toLowerCase();
  const allowedLower = new Set([...allowedNames].map((n) => n.toLowerCase()));
  const foreignNames = catalogNames.filter((n) => n.length >= 6 && text.includes(n.toLowerCase()) && !allowedLower.has(n.toLowerCase()));
  return { ids, rejectedIds, foreignNames, medical: medicalClaims(out.teks ?? "") };
}

// Buang kalimat yang menyebut nama terlarang atau klaim medis (dipakai bila pembuatan ulang tetap melanggar).
export function stripSentences(text: string, banned: string[]) {
  if (!banned.length) return text;
  const lower = banned.map((b) => b.toLowerCase());
  const kept = text.split(/(?<=[.!?])\s+/).filter((s) => !lower.some((b) => s.toLowerCase().includes(b)));
  return kept.join(" ").trim();
}

export const MEDICAL_REFERRAL = "Untuk keluhan kulit yang serius, misalnya jerawat meradang, ruam, atau iritasi yang tidak membaik, sebaiknya periksa ke dokter kulit, ya.";
