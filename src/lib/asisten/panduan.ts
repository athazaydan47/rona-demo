// Panduan admin dari berkas di repo (docs/panduan-admin). Jawaban "cara pakai" Asisten Admin selalu dari teks ini.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeName, trigramSimilarity } from "./cocok";

export type Guide = { slug: string; title: string; keywords: string[]; body: string };
// Path ditulis statis (tanpa parameter) supaya pelacak berkas Next hanya menyertakan docs/panduan-admin ke fungsi server,
// bukan seluruh proyek (peringatan "Dynamic filesystem access" saat build, Fase 8B).
let cache: Guide[] | null = null;
export async function loadGuides(): Promise<Guide[]> {
  if (cache) return cache;
  const files = (await readdir(path.join(process.cwd(), "docs", "panduan-admin"))).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  cache = await Promise.all(
    files.map(async (f) => {
      const text = await readFile(path.join(process.cwd(), "docs", "panduan-admin", f), "utf8");
      const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? f;
      const keywords = (/^Kata kunci:\s*(.+)$/m.exec(text)?.[1] ?? "").split(",").map((k) => k.trim()).filter(Boolean);
      const body = text.replace(/^#\s+.+$/m, "").replace(/^Kata kunci:.*$/m, "").trim();
      return { slug: f.replace(/\.md$/, ""), title, keywords, body };
    }),
  );
  return cache;
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
