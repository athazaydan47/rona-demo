// Evaluasi penulis deskripsi (Fase 8A): npm run eval:deskripsi (atau -- --mock, -- --jumlah=12).
// Untuk 10 produk atau lebih dari katalog (beragam kategori) ditambah satu acuan yang sengaja minim (tanpa bahan aktif,
// tanpa poin admin, tanpa teks pemasok), penulis menghasilkan draf lalu diperiksa dua lapis:
//   1. Pemeriksa di kode (checkClaims) menandai bahan di luar daftar, angka tanpa acuan, dan kata terlarang.
//   2. Pemeriksa independen di skrip ini mengambil SEMUA angka dan bahan aktif yang disebut draf dan mencocokkannya
//      dengan acuan. Bila skrip menemukan masalah yang tidak ditandai checkClaims, itu "bocor".
// Skor: draf bersih (tanpa masalah), draf bermasalah tapi tertangkap, dan bocor. Dilewati bila kunci AI tidak ada.
import { config } from "dotenv";
import type { DescriptionInput } from "../src/lib/ai/penulis";
import { costUsd, IDR_PER_USD, IDR_RATE_NOTE } from "../src/lib/ai/pricing";

config({ path: ".env.local" });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const KNOWN = ["niacinamide", "retinol", "retinal", "centella", "ceramide", "hyaluronic", "hyaluronate", "salicylic", "bha", "aha", "glycolic", "lactic", "vitamin c", "ascorbic", "peptide", "panthenol", "squalane", "zinc", "tranexamic", "arbutin", "kojic", "collagen", "licorice", "tea tree", "azelaic", "bakuchiol", "shea", "argan", "jojoba", "aloe", "mugwort", "snail", "propolis", "green tea", "rice", "oat"];

async function main() {
  const { db, schema } = await import("../src/db/client");
  const { inArray } = await import("drizzle-orm");
  const { aiConfig, aiModel } = await import("../src/lib/ai");
  const { writeDescription } = await import("../src/lib/ai/penulis");
  const { DEFAULT_STYLE } = await import("../src/lib/settings");

  const mock = process.argv.includes("--mock");
  const cfg = aiConfig(mock ? { ...process.env, AI_PROVIDER: "mock" } : process.env);
  if (cfg.provider === "none") {
    console.log("Evaluasi dilewati: AI_GATEWAY_URL dan GEMINI_API_KEY belum diisi.");
    process.exit(0);
  }
  const model = aiModel("asistenAdmin", cfg)!;
  const want = Number(arg("jumlah") ?? 11);

  const all = await db.select({ id: schema.products.id, slug: schema.products.slug, name: schema.products.name, brandId: schema.products.brandId, categoryId: schema.products.categoryId, activeIngredients: schema.products.activeIngredients, skinTypes: schema.products.skinTypes, finish: schema.products.finish, spf: schema.products.spf, netto: schema.products.netto, bpom: schema.products.bpom, benefits: schema.products.benefits, howToUse: schema.products.howToUse, shortDescription: schema.products.shortDescription }).from(schema.products).orderBy(schema.products.id);
  const brands = new Map((await db.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands)).map((b) => [b.id, b.name]));
  const cats = new Map((await db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories)).map((c) => [c.id, c.name]));
  // Satu produk per kategori dulu supaya beragam, lalu isi sisanya berurutan.
  const seenCat = new Set<number>();
  const picked = all.filter((p) => (seenCat.has(p.categoryId) ? false : (seenCat.add(p.categoryId), true)));
  for (const p of all) if (picked.length < want - 1 && !picked.includes(p)) picked.push(p);
  const examples = (await db.select({ slug: schema.products.slug, name: schema.products.name, ringkas: schema.products.shortDescription, manfaat: schema.products.benefits, caraPakai: schema.products.howToUse }).from(schema.products).where(inArray(schema.products.slug, DEFAULT_STYLE.contohProduk))).map((e) => ({ name: e.name, ringkas: e.ringkas, manfaat: e.manfaat, caraPakai: e.caraPakai }));

  type Case = { label: string; input: DescriptionInput; minim?: boolean };
  const cases: Case[] = picked.slice(0, want - 1).map((p) => ({
    label: p.name,
    input: { name: p.name, brand: brands.get(p.brandId) ?? "", category: cats.get(p.categoryId) ?? "", activeIngredients: p.activeIngredients ?? [], skinTypes: p.skinTypes ?? [], finish: p.finish, spf: p.spf, netto: p.netto ?? "", bpom: p.bpom ?? "", points: "", supplierText: "", current: { manfaat: p.benefits ?? "" } },
  }));
  // Acuan sengaja minim: hanya nama dan kategori. Draf yang menyebut bahan atau angka apa pun harus tertangkap.
  cases.push({ label: "ACUAN MINIM: Serum Pagi Ceria", minim: true, input: { name: "Serum Pagi Ceria", brand: "Kirana Lab", category: "Serum", activeIngredients: [], skinTypes: [], finish: null, spf: null, netto: "", bpom: "", points: "", supplierText: "", current: {} } });

  console.log(`Model: ${model.name}, ${cases.length} produk (${cases.length - 1} dari katalog + 1 acuan minim)\n`);
  let bersih = 0;
  let tertangkap = 0;
  let bocor = 0;
  let tokens = { input: 0, output: 0 };
  const rows: string[] = [];
  for (const c of cases) {
    const r = await writeDescription(model, c.input, DEFAULT_STYLE, examples);
    if (!r.ok) {
      rows.push(`${c.label.padEnd(44)} GAGAL ${r.message}`);
      bocor += 1;
      continue;
    }
    tokens = { input: tokens.input + r.usage.input, output: tokens.output + r.usage.output };
    const text = Object.values(r.draft).join("\n");
    const flagged = Object.values(r.issues).flat();
    // Pemeriksa independen: setiap angka dengan satuan dan setiap bahan terkenal harus ada di acuan.
    const refText = [c.input.points, c.input.supplierText, c.input.current.manfaat ?? "", c.input.name, c.input.activeIngredients.join(" "), c.input.netto, c.input.spf ? `spf ${c.input.spf}` : ""].join("\n").toLowerCase();
    const found: string[] = [];
    for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(%|persen|jam|ml|gram|g\b|mg|hari|minggu|bulan|kali|x\b)|spf\s*(\d+)|pa\s*(\+{1,4})/gi)) {
      const n = (m[1] ?? m[3] ?? m[4] ?? "").replace(",", ".");
      const ok = m[4] ? refText.includes(`pa${m[4]}`) || refText.includes(`pa ${m[4]}`) : new RegExp(`(^|\\D)${n.replace(".", "\\.")}(\\D|$)`).test(refText);
      if (!ok) found.push(m[0].trim());
    }
    for (const a of KNOWN) if (new RegExp(`\\b${a}\\b`, "i").test(text) && !refText.includes(a)) found.push(a);
    const uncaught = found.filter((f) => !flagged.some((i) => i.alasan.toLowerCase().includes(f.toLowerCase()) || i.kalimat.toLowerCase().includes(f.toLowerCase())));
    const status = uncaught.length ? "BOCOR" : flagged.length ? "tertangkap" : "bersih";
    if (status === "BOCOR") bocor += 1;
    else if (status === "tertangkap") tertangkap += 1;
    else bersih += 1;
    rows.push(`${c.label.slice(0, 44).padEnd(44)} ${status.padEnd(11)} ditandai ${String(flagged.length).padStart(2)}${uncaught.length ? `  lolos: ${uncaught.join(", ")}` : ""}${flagged.length ? `  (${flagged.map((i) => i.alasan).join(" | ").slice(0, 110)})` : ""}`);
    process.stdout.write(status === "BOCOR" ? "x" : ".");
  }
  console.log("\n");
  for (const r of rows) console.log(r);
  const n = cases.length;
  console.log(`\nSkor: ${bersih}/${n} draf bersih, ${tertangkap}/${n} bermasalah tapi tertangkap pemeriksa, ${bocor}/${n} bocor (masalah yang tidak ditandai).`);
  const avgIn = Math.round(tokens.input / n);
  const avgOut = Math.round(tokens.output / n);
  const usd = costUsd(model.name, avgIn, avgOut, new Date());
  console.log(`Token rata-rata ${avgIn + avgOut} per draf.${usd == null ? "" : ` Biaya $${usd.toFixed(5)} per draf (sekitar Rp ${Math.round(usd * IDR_PER_USD).toLocaleString("id-ID")}, ${IDR_RATE_NOTE}).`}`);
  process.exit(bocor ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
