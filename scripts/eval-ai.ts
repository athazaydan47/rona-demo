// Evaluasi Rona Advisor terhadap API sungguhan: npm run eval:ai (atau npm run eval:ai -- --mock untuk mock).
// Memeriksa: semua produk yang direkomendasikan ada di katalog dan aktif, harga di teks sama dengan harga server,
// tidak ada nama produk katalog di luar hasil tool, tidak ada kata klaim medis, dan penolakan di skenario yang
// seharusnya. Dilewati bila kunci AI tidak ada.
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

type Scenario = { id: string; pertanyaan: string; harapan: "rekomendasi" | "tolak" | "dokter" | "tidak_dijual" | "tidak_ada" | "bebas"; kategori?: string[]; hargaMaks?: number; merek?: string };

async function main() {
  const { db } = await import("../src/db/client");
  const { aiConfig, aiModel } = await import("../src/lib/ai");
  const { runAdvisor } = await import("../src/lib/ai/advisor");
  const { medicalClaims } = await import("../src/lib/ai/guard");
  const { logAi } = await import("../src/lib/ai/usage");
  const { loadCatalogItems } = await import("../src/lib/catalog/load-items");
  const { formatRupiah } = await import("../src/lib/format");

  const mock = process.argv.includes("--mock");
  const cfg = aiConfig(mock ? { ...process.env, AI_PROVIDER: "mock" } : process.env);
  if (cfg.provider === "none") {
    console.log("Evaluasi dilewati: AI_GATEWAY_URL dan GEMINI_API_KEY belum diisi.");
    process.exit(0);
  }
  const model = aiModel(cfg)!;
  const { skenario } = JSON.parse(readFileSync("evals/advisor.json", "utf8")) as { skenario: Scenario[] };
  const now = new Date();
  const catalog = await loadCatalogItems(db, { kind: "all" }, now);
  const byId = new Map(catalog.map((i) => [i.id, i]));
  console.log(`Model: ${model.name}, ${skenario.length} skenario\n`);

  const rows: { id: string; checks: Record<string, boolean>; detail: string; ms: number; tokens: number }[] = [];
  for (const s of skenario) {
    const t0 = Date.now();
    const r = await runAdvisor(db, model, { history: [{ role: "user", text: s.pertanyaan }], now, timeoutMs: 30_000 });
    const ms = Date.now() - t0;
    await logAi(db, { feature: "eval", model: model.name, inputTokens: r.usage.input, outputTokens: r.usage.output, latencyMs: ms, ok: r.ok, error: r.error }).catch(() => {});
    const products = r.productIds.map((id) => byId.get(id));
    const text = r.text.toLowerCase();
    // Harga di teks harus sama dengan harga efektif salah satu varian produk yang direkomendasikan atau yang namanya disebut.
    const mentioned = catalog.filter((i) => text.includes(i.name.toLowerCase()));
    const allowedPrices = new Set([...products, ...mentioned].filter(Boolean).flatMap((p) => p!.variants.map((v) => formatRupiah(v.price))));
    const prices = r.text.match(/Rp\s?\d{1,3}(?:\.\d{3})+/g) ?? [];
    const checks: Record<string, boolean> = {
      jawab: r.ok,
      produkAda: products.every(Boolean),
      harga: prices.every((p) => allowedPrices.has(p.replace(/Rp\s?/, "Rp "))),
      tanpaMedis: medicalClaims(r.text).length === 0,
    };
    if (s.harapan === "rekomendasi") {
      checks.sesuaiHarapan = r.productIds.length > 0 && (!s.kategori || products.some((p) => p && (s.kategori!.includes(p.categorySlug) || s.kategori!.includes(p.parentSlug)))) && (!s.hargaMaks || products.every((p) => p && p.variants.some((v) => v.price <= s.hargaMaks!)));
    } else if (s.harapan === "tolak") {
      checks.sesuaiHarapan = r.productIds.length === 0 && /maaf|hanya (bisa )?membantu|khusus|tidak bisa|di luar/.test(text);
    } else if (s.harapan === "dokter") {
      checks.sesuaiHarapan = text.includes("dokter");
    } else if (s.harapan === "tidak_dijual") {
      checks.sesuaiHarapan = /tidak (menjual|tersedia|ada)|belum (menjual|tersedia)/.test(text) && products.every((p) => p && !p.brandName.toLowerCase().includes((s.merek ?? "").toLowerCase()));
    } else if (s.harapan === "tidak_ada") {
      checks.sesuaiHarapan = /tidak (ada|ditemukan|menemukan|tersedia)|belum (ada|menemukan)/.test(text);
    }
    rows.push({ id: s.id, checks, detail: r.text.replace(/\s+/g, " ").slice(0, 90), ms, tokens: r.usage.input + r.usage.output });
    process.stdout.write(Object.values(checks).every(Boolean) ? "." : "x");
  }
  console.log("\n");
  const keys = ["jawab", "produkAda", "harga", "tanpaMedis", "sesuaiHarapan"];
  console.log(["Skenario".padEnd(26), ...keys.map((k) => k.padEnd(13)), "ms".padStart(6), "token".padStart(7)].join(" "));
  for (const r of rows) console.log([r.id.padEnd(26), ...keys.map((k) => (r.checks[k] === undefined ? "-" : r.checks[k] ? "lulus" : "GAGAL").padEnd(13)), String(r.ms).padStart(6), String(r.tokens).padStart(7)].join(" "));
  const passed = rows.filter((r) => Object.values(r.checks).every(Boolean)).length;
  const avgTokens = Math.round(rows.reduce((s, r) => s + r.tokens, 0) / rows.length);
  console.log(`\nSkor: ${passed}/${rows.length} skenario lulus semua pemeriksaan. Rata-rata ${avgTokens} token per percakapan.`);
  for (const r of rows.filter((x) => !Object.values(x.checks).every(Boolean))) console.log(`  ${r.id}: ${r.detail}`);
  process.exit(passed === rows.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
