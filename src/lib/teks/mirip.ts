// Kemiripan teks murni (tanpa database, aman di browser): normalisasi nama dan kemiripan trigram seperti pg_trgm.
// Dipakai pencocokan nama Asisten Admin dan pencocok kota tujuan (Fase 8C, dipindah dari src/lib/asisten/cocok.ts
// supaya modul wilayah yang dipakai formulir checkout tidak ikut menarik Drizzle ke bundel klien).

export function normalizeName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string) {
  const out = new Set<string>();
  for (const w of normalizeName(s).split(" ").filter(Boolean)) {
    const p = `  ${w} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}

export function trigramSimilarity(a: string, b: string) {
  const x = trigrams(a);
  const y = trigrams(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}
