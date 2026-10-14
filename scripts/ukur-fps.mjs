// Ukur kelancaran gerak (Fase 8A) dengan CPU diperlambat 4x lewat CDP (meniru Android kelas menengah):
// tambah ke keranjang (terbang + laci), gulir katalog dengan kartu masuk bertahap, buka sheet filter, dan ganti shade.
// Untuk setiap adegan dihitung durasi frame lewat requestAnimationFrame: rata-rata fps, frame panjang (> 33 ms), dan
// frame terpanjang. Target: fps rata-rata mendekati 60 dan frame panjang sedikit.
//   CUPLIK_URL=http://localhost:3211 node scripts/ukur-fps.mjs
import { chromium } from "@playwright/test";

const base = (process.env.CUPLIK_URL ?? "http://localhost:3211").replace(/\/$/, "");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const startFrames = () =>
  page.evaluate(() => {
    const w = window;
    w.__frames = [];
    let last = performance.now();
    w.__stopFrames = false;
    const tick = (t) => {
      w.__frames.push(t - last);
      last = t;
      if (!w.__stopFrames) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const stopFrames = async (label) => {
  const frames = await page.evaluate(() => {
    window.__stopFrames = true;
    return window.__frames.slice(1);
  });
  const total = frames.reduce((a, b) => a + b, 0);
  const fps = frames.length / (total / 1000);
  const long = frames.filter((f) => f > 33).length;
  const worst = Math.max(...frames);
  console.log(`${label.padEnd(44)} fps rata-rata ${fps.toFixed(0).padStart(3)}  frame > 33 ms: ${String(long).padStart(2)} dari ${String(frames.length).padStart(3)}  terpanjang ${worst.toFixed(0)} ms`);
  return { fps, long, n: frames.length, worst };
};

const results = [];
await page.goto(`${base}/p/pualam-velvet-matte-cushion-spf-50`, { waitUntil: "networkidle" });
await startFrames();
await page.getByRole("radio", { name: /./ }).nth(2).click();
await page.waitForTimeout(600);
results.push(await stopFrames("ganti shade (crossfade galeri)"));

await startFrames();
await page.getByRole("button", { name: "Tambah ke Keranjang", exact: true }).click();
await page.getByRole("dialog", { name: /Keranjang/ }).waitFor();
await page.waitForTimeout(900);
results.push(await stopFrames("tambah ke keranjang (terbang + laci)"));
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

await page.goto(`${base}/c/bibir`, { waitUntil: "networkidle" });
await startFrames();
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(600);
results.push(await stopFrames("gulir katalog (kartu masuk bertahap)"));

await startFrames();
await page.getByRole("button", { name: "Buka filter" }).first().click();
await page.waitForTimeout(700);
results.push(await stopFrames("buka sheet filter"));

await browser.close();
const avg = results.reduce((s, r) => s + r.fps, 0) / results.length;
const longTotal = results.reduce((s, r) => s + r.long, 0);
const n = results.reduce((s, r) => s + r.n, 0);
console.log(`\nRata-rata ${avg.toFixed(0)} fps dengan CPU 4x lebih lambat; ${longTotal} dari ${n} frame lebih dari 33 ms (${((100 * longTotal) / n).toFixed(1)}%).`);
