// Peringatan nama mirip (cegah "Lip Blam" di samping "Lip Balm"): kemiripan trigram ala pg_trgm dan jarak Levenshtein.
export function trigrams(s: string) {
  const out = new Set<string>();
  for (const word of s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean)) {
    const w = `  ${word} `;
    for (let i = 0; i < w.length - 2; i++) out.add(w.slice(i, i + 3));
  }
  return out;
}

export function trigramSimilarity(a: string, b: string) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const t of A) if (B.has(t)) both++;
  return both / (A.size + B.size - both);
}

export function levenshtein(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[y.length];
}

export type SimilarHit = { name: string; similarity: number; distance: number };

// Nama yang mirip dengan nama baru (tidak termasuk yang persis sama, itu ditangani sebagai duplikat).
export function similarNames(name: string, existing: string[], opts: { threshold?: number; maxDistance?: number } = {}): SimilarHit[] {
  const n = name.trim();
  if (n.length < 3) return [];
  const threshold = opts.threshold ?? 0.4;
  const maxDistance = opts.maxDistance ?? 2;
  return existing
    .filter((e) => e.trim().toLowerCase() !== n.toLowerCase())
    .map((e) => ({ name: e, similarity: Math.round(trigramSimilarity(n, e) * 100) / 100, distance: levenshtein(n, e) }))
    .filter((h) => h.similarity >= threshold || (h.distance <= maxDistance && Math.min(n.length, h.name.length) >= 4))
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance)
    .slice(0, 5);
}
