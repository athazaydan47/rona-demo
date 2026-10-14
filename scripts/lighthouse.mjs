// Lighthouse mobile (4G tersimulasi) untuk halaman utama toko di build produksi lokal.
//   node scripts/lighthouse.mjs [label]   (server di CUPLIK_URL, bawaan http://localhost:3211)
//   CUPLIK_URL=https://localhost:3443 node scripts/lighthouse.mjs h2   lewat proksi HTTP/2 (scripts/proxy-h2.mjs), mendekati Vercel
// Hasil: tabel Performance, Accessibility, Best Practices, LCP, CLS; JSON disimpan ke _review/lighthouse-<label>.json
import { writeFileSync, mkdirSync } from "node:fs";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const base = (process.env.CUPLIK_URL ?? "http://localhost:3211").replace(/\/$/, "");
const label = process.argv[2] ?? "sekarang";
// --terapan: throttling diterapkan sungguhan di browser (devtools), bukan simulasi Lantern. Lebih lambat dijalankan,
// tetapi mengukur halaman yang benar-benar dimuat lewat 4G tiruan dan CPU 4x lebih lambat.
const terapan = process.argv.includes("--terapan");
const pages = ["/", "/c/bibir", "/p/pualam-velvet-matte-cushion-spf-50", "/keranjang", "/checkout"];
// Untuk proksi HTTP/2 lokal (scripts/proxy-h2.mjs) sertifikatnya buatan sendiri, jadi galat sertifikat diabaikan.
const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox", ...(base.startsWith("https://localhost") ? ["--ignore-certificate-errors"] : [])] });
const rows = [];
try {
  for (const p of pages) {
    const r = await lighthouse(base + p, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices"], formFactor: "mobile", screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.6, disabled: false }, throttlingMethod: terapan ? "devtools" : "simulate" });
    const c = r.lhr.categories;
    const a = r.lhr.audits;
    rows.push({ page: p, perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c["best-practices"].score * 100), lcp: Math.round(a["largest-contentful-paint"].numericValue) / 1000, cls: Math.round(a["cumulative-layout-shift"].numericValue * 1000) / 1000, tbt: Math.round(a["total-blocking-time"].numericValue), bytes: Math.round(a["total-byte-weight"].numericValue / 1024) });
    process.stdout.write(".");
  }
} finally {
  await chrome.kill();
}
console.log(`\n${"Halaman".padEnd(40)} Perf  A11y  BP   LCP(s)  CLS    TBT(ms)  Total KB`);
for (const r of rows) console.log(`${r.page.padEnd(40)} ${String(r.perf).padEnd(5)} ${String(r.a11y).padEnd(5)} ${String(r.bp).padEnd(4)} ${String(r.lcp).padEnd(7)} ${String(r.cls).padEnd(6)} ${String(r.tbt).padEnd(8)} ${r.bytes}`);
mkdirSync("_review", { recursive: true });
writeFileSync(`_review/lighthouse-${label}.json`, JSON.stringify(rows, null, 2));
