// Panduan admin dari berkas di repo (docs/panduan-admin). Jawaban "cara pakai" Asisten Admin selalu dari teks ini.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeName, trigramSimilarity } from "./cocok";

export type Guide = { slug: string; title: string; keywords: string[]; body: string };
const DIR = path.join(process.cwd(), "docs", "panduan-admin");

let cache: Guide[] | null = null;
export async function loadGuides(dir = DIR): Promise<Guide[]> {
  if (cache && dir === DIR) return cache;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  const guides = await Promise.all(
    files.map(async (f) => {
      const text = await readFile(path.join(dir, f), "utf8");
      const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? f;
      const keywords = (/^Kata kunci:\s*(.+)$/m.exec(text)?.[1] ?? "").split(",").map((k) => k.trim()).filter(Boolean);
      const body = text.replace(/^#\s+.+$/m, "").replace(/^Kata kunci:.*$/m, "").trim();
      return { slug: f.replace(/\.md$/, ""), title, keywords, body };
    }),
  );
  if (dir === DIR) cache = guides;
  return guides;
}

// Topik ke panduan: kata kunci yang muncul di topik, lalu kemiripan trigram dengan judul.
export function findGuide(guides: Guide[], topic: string): Guide | null {
  const t = normalizeName(topic);
  if (!t) return null;
  const scored = guides
    .map((g) => {
      const kw = g.keywords.filter((k) => t.includes(normalizeName(k))).reduce((s, k) => s + normalizeName(k).length, 0);
      return { g, s: kw * 2 + trigramSimilarity(topic, g.title) * 10 };
    })
    .sort((a, b) => b.s - a.s);
  return scored[0] && scored[0].s >= 3 ? scored[0].g : null;
}
