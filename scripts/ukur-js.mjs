// Ukur JavaScript yang dimuat per route (byte terkirim, termasuk chunk yang dimuat saat jalan) di build produksi lokal.
//   node scripts/ukur-js.mjs   (server di CUPLIK_URL, bawaan http://localhost:3211)
import { chromium } from "@playwright/test";
const base = (process.env.CUPLIK_URL ?? "http://localhost:3211").replace(/\/$/, "");
const pages = ["/", "/c/bibir", "/p/pualam-velvet-matte-cushion-spf-50", "/keranjang", "/checkout", "/admin/masuk"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
console.log(`${"Halaman".padEnd(40)} JS KB  berkas  HTML KB`);
for (const p of pages) {
  const page = await ctx.newPage();
  let js = 0, n = 0, html = 0;
  page.on("response", async (r) => {
    const u = r.url();
    if (!u.startsWith(base)) return;
    try {
      const b = (await r.body()).length;
      if (/\.js(\?|$)/.test(u)) { js += b; n += 1; }
      if (u === base + p || u.replace(/\/$/, "") === base + p) html += b;
    } catch {}
  });
  await page.goto(base + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  console.log(`${p.padEnd(40)} ${String(Math.round(js / 1024)).padEnd(6)} ${String(n).padEnd(7)} ${Math.round(html / 1024)}`);
  await page.close();
}
await browser.close();
