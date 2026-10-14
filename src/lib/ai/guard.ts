// Pagar pengaman keluaran Advisor pembeli (murni): id produk wajib berasal dari hasil tool di percakapan ini, nama
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

// ---------- Angka rupiah dan alasan per produk (Fase 7C) ----------

const RUPIAH_RE = /Rp\.?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,})/gi;

// Semua angka rupiah yang ditulis di teks, sebagai bilangan bulat.
export function rupiahAmounts(text: string): number[] {
  return [...text.matchAll(RUPIAH_RE)].map((m) => Number(m[1].replace(/[.,]/g, ""))).filter((n) => Number.isFinite(n));
}

// Angka rupiah di teks harus sama dengan harga efektif salah satu produk yang direkomendasikan. Kalimat yang memuat
// angka lain dibuang (model bisa salah menyalin harga normal, harga sebelum flash sale, atau menjumlah sendiri).
export function badRupiah(text: string, allowedPrices: Set<number>) {
  return rupiahAmounts(text).filter((n) => !allowedPrices.has(n));
}

export function splitSentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
}

export type SentenceRules = { catalogNames: string[]; allowedNames: Set<string>; allowedPrices: Set<number> };

// Fase 8C: link TikTok dan YouTube dibaca sistem, jadi model tidak boleh menulis bahwa ia tidak bisa membuka link.
export const LINK_REFUSAL = /\b(tidak|belum|gak|ga|nggak|enggak)\s+(bisa|dapat|mampu)\s+(membuka|mengakses|melihat|menonton|memutar|membaca)\s+(link|tautan|video|url|situs)/i;

// Alasan kalimat ditolak, atau null bila aman. Dipakai saat streaming (per kalimat) dan saat validasi akhir.
export function sentenceProblem(sentence: string, rules: SentenceRules): string | null {
  const lower = sentence.toLowerCase();
  if (medicalClaims(sentence).length) return "klaim medis";
  if (LINK_REFUSAL.test(sentence)) return "menolak link";
  const names = rules.catalogNames.filter((n) => n.length >= 6 && lower.includes(n.toLowerCase()));
  const allowedLower = new Set([...rules.allowedNames].map((n) => n.toLowerCase()));
  if (names.some((n) => !allowedLower.has(n.toLowerCase()))) return "produk di luar hasil tool";
  // Teks pembuka bukan daftar: nama produk dan harga tampil di kartu.
  if (names.length >= 2) return "daftar nama produk";
  if (badRupiah(sentence, rules.allowedPrices).length) return "harga tidak sesuai";
  return null;
}

export function filterSentences(text: string, rules: SentenceRules) {
  const kept: string[] = [];
  const dropped: { sentence: string; problem: string }[] = [];
  for (const s of splitSentences(text.trim())) {
    const p = sentenceProblem(s, rules);
    if (p) dropped.push({ sentence: s, problem: p });
    else kept.push(s.trim());
  }
  return { text: kept.join(" "), dropped };
}

export const MAX_REASON_CHARS = 90;

// Alasan singkat per kartu: dipotong di batas kata sekitar 90 karakter, tanpa klaim medis, dan angka rupiah harus
// harga efektif produk itu sendiri. Alasan yang tidak lolos dikosongkan (kartu tetap tampil tanpa alasan).
export function cleanReason(raw: unknown, productPrices: Set<number>): string {
  let s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!s || medicalClaims(s).length || badRupiah(s, productPrices).length) return "";
  if (s.length > MAX_REASON_CHARS + 10) {
    const cut = s.slice(0, MAX_REASON_CHARS);
    s = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[,;:\s]+$/, "")}...`;
  }
  return s;
}
