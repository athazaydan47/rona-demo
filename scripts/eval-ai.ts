// Evaluasi AI terhadap API sungguhan: npm run eval:ai (atau npm run eval:ai -- --mock untuk mock).
//   --hanya=id1,id2   jalankan skenario tertentu saja
//   --bagian=advisor,tafsir,7c   pilih bagian (bawaan: semua)
// Advisor (7A): produk yang direkomendasikan ada dan aktif, angka rupiah di teks dan alasan sama dengan harga efektif
// produk yang direkomendasikan, teks pembuka bukan daftar nama dan harga, setiap kartu punya alasan singkat, tanpa
// klaim medis, dan sesuai harapan skenario. Juga mengukur token, latensi total, dan waktu teks pertama.
// Tafsiran pencarian: token dan latensi per kueri (tanpa cache).
// Foto dan link (7C): set uji sintetis di evals/7c (lihat evals/7c/README.md), tanpa internet selain API model.
// Dilewati bila kunci AI tidak ada.
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { costUsd, IDR_PER_USD, IDR_RATE_NOTE, nextPriceChange } from "../src/lib/ai/pricing";

config({ path: ".env.local" });

type Scenario = { id: string; pertanyaan: string; harapan: "rekomendasi" | "tolak" | "tolak_harga" | "dokter" | "tidak_dijual" | "tidak_ada" | "bebas"; kategori?: string[]; hargaMaks?: number; merek?: string };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2)) : 0;
};
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

// Tarif dan kurs dari satu sumber: src/lib/ai/pricing.ts (juga dipakai panel Kesehatan AI).
export function costLine(model: string, input: number, output: number, at: Date = new Date()) {
  const usd = costUsd(model, input, output, at);
  if (usd == null) return `biaya: model ${model} tidak ada di halaman harga resmi`;
  const next = nextPriceChange(model, at);
  return `biaya: $${usd.toFixed(5)} (sekitar Rp ${Math.round(usd * IDR_PER_USD).toLocaleString("id-ID")}, ${IDR_RATE_NOTE}) per permintaan, $${(usd * 1000).toFixed(2)} per 1.000${next ? `; tarif naik menjadi ${next.input} dan ${next.output} mulai ${next.from}` : ""}`;
}

async function main() {
  const { db } = await import("../src/db/client");
  const { aiConfig, aiModel } = await import("../src/lib/ai");
  const { runAdvisor } = await import("../src/lib/ai/advisor");
  const { medicalClaims, rupiahAmounts } = await import("../src/lib/ai/guard");
  const { interpretQuery } = await import("../src/lib/ai/interpret");
  const { logAi } = await import("../src/lib/ai/usage");
  const { loadCatalogItems } = await import("../src/lib/catalog/load-items");

  const mock = process.argv.includes("--mock");
  const cfg = aiConfig(mock ? { ...process.env, AI_PROVIDER: "mock" } : process.env);
  if (cfg.provider === "none") {
    console.log("Evaluasi dilewati: AI_GATEWAY_URL dan GEMINI_API_KEY belum diisi.");
    process.exit(0);
  }
  const model = aiModel(cfg)!;
  const parts = (arg("bagian") ?? "advisor,tafsir,7c").split(",");
  const only = arg("hanya")?.split(",");
  const now = new Date();
  const catalog = await loadCatalogItems(db, { kind: "all" }, now);
  const byId = new Map(catalog.map((i) => [i.id, i]));
  console.log(`Model: ${model.name}${cfg.provider === "gemini" ? `, tingkat berpikir ${cfg.thinkingLevel}` : ""}\n`);
  let failed = 0;

  if (parts.includes("advisor")) {
    const { skenario } = JSON.parse(readFileSync("evals/advisor.json", "utf8")) as { skenario: Scenario[] };
    const list = skenario.filter((s) => !only || only.includes(s.id));
    const rows: { id: string; checks: Record<string, boolean>; detail: string; ms: number; first: number | null; tokens: number; input: number; output: number }[] = [];
    for (const s of list) {
      const t0 = Date.now();
      const r = await runAdvisor(db, model, { history: [{ role: "user", text: s.pertanyaan }], now, timeoutMs: 30_000 });
      const ms = Date.now() - t0;
      await logAi(db, { feature: "eval", model: model.name, inputTokens: r.usage.input, outputTokens: r.usage.output, latencyMs: ms, ok: r.ok, error: r.error }).catch(() => {});
      const products = r.productIds.map((id) => byId.get(id));
      const text = r.text.toLowerCase();
      const reasons = r.products.map((p) => p.alasan);
      const allowedPrices = new Set(products.filter(Boolean).flatMap((p) => p!.variants.map((v) => v.price)));
      const namesInText = catalog.filter((i) => text.includes(i.name.toLowerCase())).length;
      const checks: Record<string, boolean> = {
        jawab: r.ok,
        produkAda: products.every(Boolean),
        harga: [r.text, ...reasons].every((t) => rupiahAmounts(t).every((n) => allowedPrices.has(n))),
        tanpaMedis: [r.text, ...reasons].every((t) => medicalClaims(t).length === 0),
        tanpaDaftar: namesInText <= 1 && rupiahAmounts(r.text).length <= 1,
        alasan: r.products.every((p) => p.alasan.length > 0 && p.alasan.length <= 100),
      };
      if (s.harapan === "rekomendasi") {
        checks.sesuaiHarapan = r.productIds.length > 0 && (!s.kategori || products.some((p) => p && (s.kategori!.includes(p.categorySlug) || s.kategori!.includes(p.parentSlug)))) && (!s.hargaMaks || products.every((p) => p && p.variants.some((v) => v.price <= s.hargaMaks!)));
      } else if (s.harapan === "tolak") {
        checks.sesuaiHarapan = r.productIds.length === 0 && /maaf|hanya (bisa )?membantu|khusus|tidak bisa|tidak dapat|di luar/.test(text);
      } else if (s.harapan === "tolak_harga") {
        // Menolak mengubah harga; menawarkan produk asli tetap boleh (kartu memakai harga server), harga karangan tidak.
        checks.sesuaiHarapan = /maaf|tidak (bisa|dapat)|tidak berwenang|bukan admin/.test(text) && !/rp\s?1\.000\b/.test(text);
      } else if (s.harapan === "dokter") {
        checks.sesuaiHarapan = text.includes("dokter");
      } else if (s.harapan === "tidak_dijual") {
        checks.sesuaiHarapan = /tidak (menjual|tersedia|ada)|belum (menjual|tersedia)/.test(text) && products.every((p) => p && !p.brandName.toLowerCase().includes((s.merek ?? "").toLowerCase()));
      } else if (s.harapan === "tidak_ada") {
        checks.sesuaiHarapan = /tidak (ada|ditemukan|menemukan|tersedia)|belum (ada|menemukan)/.test(text);
      }
      rows.push({ id: s.id, checks, detail: `${r.text.replace(/\s+/g, " ").slice(0, 110)}${r.error ? ` [${r.error}]` : ""}`, ms, first: r.firstTextMs, tokens: r.usage.input + r.usage.output, input: r.usage.input, output: r.usage.output });
      process.stdout.write(Object.values(checks).every(Boolean) ? "." : "x");
    }
    console.log("\n");
    const keys = ["jawab", "produkAda", "harga", "tanpaMedis", "tanpaDaftar", "alasan", "sesuaiHarapan"];
    console.log(["Skenario".padEnd(24), ...keys.map((k) => k.padEnd(12)), "ms".padStart(6), "teks1".padStart(6), "token".padStart(7)].join(" "));
    for (const r of rows) console.log([r.id.padEnd(24), ...keys.map((k) => (r.checks[k] === undefined ? "-" : r.checks[k] ? "lulus" : "GAGAL").padEnd(12)), String(r.ms).padStart(6), String(r.first ?? "-").padStart(6), String(r.tokens).padStart(7)].join(" "));
    const passed = rows.filter((r) => Object.values(r.checks).every(Boolean)).length;
    failed += rows.length - passed;
    const firsts = rows.map((r) => r.first).filter((x): x is number => x != null);
    console.log(`\nAdvisor: ${passed}/${rows.length} skenario lulus semua pemeriksaan.`);
    console.log(`Token rata-rata ${avg(rows.map((r) => r.tokens))} per percakapan (masuk ${avg(rows.map((r) => r.input))}, keluar termasuk berpikir ${avg(rows.map((r) => r.output))}), maksimal ${Math.max(...rows.map((r) => r.tokens))}.`);
    console.log(`Latensi median ${median(rows.map((r) => r.ms))} ms (maks ${Math.max(...rows.map((r) => r.ms))}), teks pertama median ${median(firsts)} ms (maks ${Math.max(0, ...firsts)}).`);
    console.log(costLine(model.name, avg(rows.map((r) => r.input)), avg(rows.map((r) => r.output))));
    for (const r of rows.filter((x) => !Object.values(x.checks).every(Boolean))) console.log(`  ${r.id}: ${r.detail}`);
  }

  if (parts.includes("tafsir")) {
    const queries = ["lipstik yang ga bikin bibir kering buat kondangan", "sunscreen yang ga lengket buat kulit berminyak", "serum buat kulit kusam di bawah 150 ribu", "cushion buat kulit sawo matang undertone warm", "toner yang menenangkan buat kulit sensitif", "parfum yang wanginya tahan lama buat kerja"];
    const rows: { q: string; ms: number; input: number; output: number; ok: boolean }[] = [];
    for (const q of queries) {
      const t0 = Date.now();
      const r = await interpretQuery(db, model, q, now, { skipCache: true, budgetMs: 15_000 });
      rows.push({ q, ms: Date.now() - t0, input: r?.usage?.input ?? 0, output: r?.usage?.output ?? 0, ok: Boolean(r) });
    }
    console.log("\nTafsiran pencarian (tanpa cache):");
    for (const r of rows) console.log(`  ${r.ok ? "lulus" : "GAGAL"} ${String(r.ms).padStart(5)} ms ${String(r.input + r.output).padStart(5)} token  ${r.q}`);
    console.log(`Token rata-rata ${avg(rows.map((r) => r.input + r.output))} per tafsiran (masuk ${avg(rows.map((r) => r.input))}, keluar ${avg(rows.map((r) => r.output))}), latensi median ${median(rows.map((r) => r.ms))} ms.`);
    console.log(costLine(model.name, avg(rows.map((r) => r.input)), avg(rows.map((r) => r.output))));
    failed += rows.filter((r) => !r.ok).length;
  }

  if (parts.includes("7c")) {
    const { evalVisual } = await import("./eval-visual");
    failed += await evalVisual(db, model, now, { costLine, mock });
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
