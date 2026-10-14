// Evaluasi Fase 7C (dipanggil dari scripts/eval-ai.ts, bagian "7c"): foto kuis dan cari dupe dari screenshot atau
// link, memakai set sintetis di evals/7c. Link memakai data oEmbed rekaman (tanpa internet), video YouTube tidak
// dibaca. Mengukur kelulusan, token, latensi, dan biaya per foto dan per link.
import { readFileSync } from "node:fs";
import type { AiModel } from "../src/lib/ai/client";
import type { AnyDb } from "../src/lib/db-types";

type FotoCase = { id: string; berkas: string; harapan: "valid" | "kualitas_kurang" };
type DupeCase = { id: string; tipe?: string[]; produk?: string; shade?: string; kategori?: string[]; namaMengandung?: string; minimal?: number; gagal?: "screenshot" | "tidak_valid" };
type GambarCase = DupeCase & { berkas: string[] };
type LinkCase = DupeCase & { url: string; oembed?: { title: string; author_name: string; author_url: string } };

type Opts = { costLine: (model: string, input: number, output: number) => string; mock: boolean };

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export async function evalVisual(db: AnyDb, base: AiModel, now: Date, opts: Opts): Promise<number> {
  const { analyzeSkinPhoto } = await import("../src/lib/ai/skin-photo");
  const { dupeFromLink, dupeFromScreenshots } = await import("../src/lib/ai/dupe");
  const { loadCatalogItems } = await import("../src/lib/catalog/load-items");
  const { withStream } = await import("../src/lib/ai/client");
  const manifest = JSON.parse(readFileSync("evals/7c/skenario.json", "utf8")) as { foto: FotoCase[]; gambar: GambarCase[]; link: LinkCase[] };
  const catalog = await loadCatalogItems(db, { kind: "all" }, now);
  const bySlug = new Map(catalog.map((i) => [i.slug, i]));
  const byId = new Map(catalog.map((i) => [i.id, i]));
  const img = (f: string) => ({ mimeType: "image/jpeg" as const, data: readFileSync(`evals/7c/gambar/${f}`).toString("base64") });

  // Model pembungkus untuk menghitung token per kasus.
  let usage = { input: 0, output: 0 };
  const model: AiModel = withStream({
    name: base.name,
    async generate(req, o) {
      const r = await base.generate(req, o);
      usage = { input: usage.input + r.usage.input, output: usage.output + r.usage.output };
      return r;
    },
  });
  const visitorHash = `eval-7c-${now.getTime()}`;
  type Row = { bagian: string; id: string; lulus: boolean; detail: string; ms: number; input: number; output: number };
  const rows: Row[] = [];
  const run = async (bagian: string, id: string, fn: () => Promise<{ lulus: boolean; detail: string }>) => {
    usage = { input: 0, output: 0 };
    const t0 = Date.now();
    const r = await fn().catch((e) => ({ lulus: false, detail: `galat: ${e instanceof Error ? e.message : String(e)}` }));
    rows.push({ bagian, id, ...r, ms: Date.now() - t0, ...usage });
    process.stdout.write(r.lulus ? "." : "x");
  };

  for (const c of manifest.foto) {
    await run("foto", c.id, async () => {
      const r = await analyzeSkinPhoto(db, model, img(c.berkas), { now, visitorHash });
      if (!r.ok) return { lulus: false, detail: r.message };
      const lulus = c.harapan === "valid" ? true : r.quality !== "cukup";
      return { lulus, detail: r.quality === "cukup" ? `usulan ${JSON.stringify(r.suggestion.answers)}` : `kualitas ${r.quality}` };
    });
  }

  const judge = (c: DupeCase, outcome: Awaited<ReturnType<typeof dupeFromLink>>) => {
    if (c.gagal) return { lulus: !outcome.ok && (c.gagal === "screenshot" ? Boolean(outcome.suggestScreenshot) : !outcome.suggestScreenshot), detail: outcome.ok ? `tidak ditolak (${outcome.match.tipe})` : outcome.message };
    if (!outcome.ok) return { lulus: false, detail: outcome.message };
    const m = outcome.match;
    const picks = m.picks.map((p) => byId.get(p.productId));
    const checks = [
      !c.tipe || c.tipe.includes(m.tipe),
      !c.produk || m.picks[0]?.productId === bySlug.get(c.produk)?.id,
      !c.shade || picks[0]?.variants.find((v) => v.id === m.picks[0]?.variantId)?.shadeName === c.shade,
      !c.kategori || (picks.length > 0 && picks.every((p) => p && (c.kategori!.includes(p.categorySlug) || c.kategori!.includes(p.parentSlug)))),
      !c.namaMengandung || ("namaTerbaca" in m && (m.namaTerbaca ?? "").toLowerCase().includes(c.namaMengandung.toLowerCase())),
      !c.minimal || m.picks.length >= c.minimal,
      picks.every(Boolean),
    ];
    const name = "namaTerbaca" in m ? m.namaTerbaca : null;
    return { lulus: checks.every(Boolean), detail: `${m.tipe}${name ? ` "${name}"` : ""}: ${picks.map((p, i) => `${p?.name ?? "?"} (${m.picks[i].alasan})`).join("; ")}` };
  };

  for (const c of manifest.gambar) {
    await run("gambar", c.id, async () => judge(c, await dupeFromScreenshots({ db, model, now, visitorHash }, c.berkas.map(img))));
  }

  // oEmbed rekaman: tidak ada permintaan ke internet.
  const recorded = new Map(manifest.link.filter((l) => l.oembed).map((l) => [l.url, l.oembed!]));
  for (const c of manifest.link) {
    const fetchImpl = async (url: string) => {
      const target = new URL(url).searchParams.get("url") ?? "";
      const hit = [...recorded.entries()].find(([u]) => {
        const id = (s: string) => /\/video\/(\d+)/.exec(s)?.[1] ?? /[?&]v=([\w-]+)/.exec(s)?.[1] ?? /youtu\.be\/([\w-]+)/.exec(s)?.[1];
        return id(u) === id(target);
      })?.[1];
      return hit ? new Response(JSON.stringify(hit), { status: 200 }) : new Response("{}", { status: 404 });
    };
    await run("link", c.id, async () => judge(c, await dupeFromLink({ db, model, now, visitorHash, fetchImpl, skipCache: true, useVideo: false }, c.url)));
  }

  console.log("\n\nFoto dan link (7C):");
  console.log(["Bagian".padEnd(7), "Skenario".padEnd(24), "Hasil".padEnd(6), "ms".padStart(6), "token".padStart(6), " Detail"].join(" "));
  for (const r of rows) console.log([r.bagian.padEnd(7), r.id.padEnd(24), (r.lulus ? "lulus" : "GAGAL").padEnd(6), String(r.ms).padStart(6), String(r.input + r.output).padStart(6), ` ${r.detail.slice(0, 150)}`].join(" "));
  const passed = rows.filter((r) => r.lulus).length;
  console.log(`\n7C: ${passed}/${rows.length} skenario lulus.${opts.mock ? " (mock: pengenalan gambar memakai kunci jawaban set sintetis)" : ""}`);
  const fotoRows = rows.filter((r) => r.bagian === "foto");
  const gambarRows = rows.filter((r) => r.bagian === "gambar");
  const linkRows = rows.filter((r) => r.bagian === "link" && r.input > 0);
  for (const [label, list] of [["per foto kuis", fotoRows], ["per screenshot", gambarRows], ["per link (caption)", linkRows]] as const) {
    if (!list.length) continue;
    const i = avg(list.map((r) => r.input));
    const o = avg(list.map((r) => r.output));
    console.log(`Token rata-rata ${label}: ${i + o} (masuk ${i}, keluar ${o}); ${opts.costLine(base.name, i, o)}`);
  }
  // Tidak ada jalur penyimpanan: baris ai_logs evaluasi ini tidak memuat isi foto atau teks pembeli.
  const { sql } = await import("drizzle-orm");
  const logRows = (await db.execute(sql`select feature, query, error from ai_logs where visitor_hash = ${visitorHash}`)) as unknown as { feature: string; query: string | null; error: string | null }[];
  const leaked = logRows.filter((l) => l.query || (l.error ?? "").length > 300);
  console.log(`ai_logs: ${logRows.length} baris dari evaluasi ini, ${leaked.length} memuat isi masukan.`);
  return rows.length - passed + leaked.length;
}
