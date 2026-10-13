// Utilitas tangkapan layar bersama untuk pemeriksaan visual, memakai Chrome yang sudah terpasang.
//
// Sebagai CLI:
//   node scripts/screenshot.mjs <url> <lebar> <keluaran.png> [aksi]
//   aksi: full | menu | megamenu | filter | hover:<teks tombol> | click:<aria-label tombol>
//
// Sebagai modul: dipakai oleh scripts/cuplik.mjs dan scripts/cuplik-art.tsx.
import { chromium } from "@playwright/test";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Batas aman tinggi satu tangkapan dalam piksel perangkat. Lebih dari ini dipotong per bagian.
const MAX_CAPTURE_PX = 14000;

export async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    try {
      return await chromium.launch({ headless: true });
    } catch {
      throw new Error(
        "Browser untuk Playwright tidak ditemukan. Pasang Google Chrome, atau jalankan: npx playwright install chromium",
      );
    }
  }
}

// Stempel waktu WIB untuk nama file: YYYYMMDD-HHmm.
export function stampWib(date = new Date()) {
  const w = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${w.getUTCFullYear()}${p(w.getUTCMonth() + 1)}${p(w.getUTCDate())}-${p(w.getUTCHours())}${p(w.getUTCMinutes())}`;
}

// "13 Okt 2026, 14.30 WIB"
export function labelWib(date = new Date()) {
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const w = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${w.getUTCDate()} ${bulan[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${p(w.getUTCHours())}.${p(w.getUTCMinutes())} WIB`;
}

const HIDE_DEV_UI = `
  nextjs-portal { display: none !important; }
`;

// Untuk potretan satu halaman penuh: elemen fixed di bawah layar diletakkan di posisi alaminya
// supaya tidak menimpa konten di tengah gambar.
const FULL_PAGE_FIX = `
  nav[aria-label="Navigasi bawah"] { position: relative !important; }
`;

/**
 * Potret satu halaman.
 * @param {import("@playwright/test").Browser} browser
 * @param {string} url
 * @param {{ width: number, height?: number, deviceScaleFactor?: number, out: string, action?: string }} opts
 *   out: path PNG. Bila halaman sangat tinggi, file dipecah menjadi out-1.png, out-2.png, dan seterusnya.
 * @returns {Promise<{ files: { path: string, cssTop: number, cssHeight: number }[], cssWidth: number, cssHeight: number, scrollWidth: number }>}
 */
export async function capturePage(browser, url, opts) {
  const { width, deviceScaleFactor = 1, out, action = "full" } = opts;
  const height = opts.height ?? (width < 768 ? 812 : 900);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.addStyleTag({ content: HIDE_DEV_UI });
    await page.evaluate(() => document.fonts.ready);

    let fullPage = true;
    if (action === "menu") {
      await page.getByRole("button", { name: "Buka menu kategori" }).first().click();
      await page.waitForTimeout(600);
      fullPage = false;
    } else if (action === "filter") {
      await page.getByRole("button", { name: "Buka filter" }).first().click();
      await page.waitForTimeout(700);
      fullPage = false;
    } else if (action === "megamenu") {
      await page.locator('nav[aria-label="Navigasi utama"] button').first().hover();
      await page.waitForTimeout(800);
      fullPage = false;
    } else if (action.startsWith("hover:")) {
      await page.getByRole("button", { name: action.slice(6) }).first().hover();
      await page.waitForTimeout(800);
      fullPage = false;
    } else if (action.startsWith("click:")) {
      await page.getByRole("button", { name: action.slice(6) }).first().click();
      await page.waitForTimeout(600);
      fullPage = false;
    } else if (action !== "full") {
      throw new Error(`Aksi tidak dikenal: ${action}`);
    }

    if (fullPage) {
      await page.addStyleTag({ content: FULL_PAGE_FIX });
      await page.waitForTimeout(150);
    }

    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    const cssHeight = fullPage ? dims.scrollHeight : height;
    const chunkCss = Math.floor(MAX_CAPTURE_PX / deviceScaleFactor);
    const files = [];

    if (!fullPage) {
      await page.screenshot({ path: out, animations: "disabled" });
      files.push({ path: out, cssTop: 0, cssHeight });
    } else if (cssHeight <= chunkCss) {
      await page.screenshot({ path: out, fullPage: true, animations: "disabled" });
      files.push({ path: out, cssTop: 0, cssHeight });
    } else {
      const base = out.replace(/\.png$/, "");
      for (let top = 0, i = 1; top < cssHeight; top += chunkCss, i++) {
        const h = Math.min(chunkCss, cssHeight - top);
        const path = `${base}-${i}.png`;
        await page.screenshot({
          path,
          fullPage: true,
          clip: { x: 0, y: top, width, height: h },
          animations: "disabled",
        });
        files.push({ path, cssTop: top, cssHeight: h });
      }
    }
    return { files, cssWidth: width, cssHeight, scrollWidth: dims.scrollWidth };
  } finally {
    await context.close();
  }
}

/**
 * Potret file HTML lokal sebagai JPEG. Kualitas diturunkan bertahap bila file melebihi maxBytes.
 * @returns {Promise<{ bytes: number, quality: number }>}
 */
export async function screenshotHtmlToJpeg(browser, htmlPath, out, { width, quality = 80, maxBytes = 4 * 1024 * 1024 }) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 120_000 });
    let q = quality;
    for (;;) {
      await page.screenshot({ path: out, type: "jpeg", quality: q, fullPage: true });
      const bytes = statSync(out).size;
      if (bytes <= maxBytes || q <= 50) return { bytes, quality: q };
      q -= 10;
    }
  } finally {
    await context.close();
  }
}

export function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  const [url, widthArg, out, action = "full"] = process.argv.slice(2);
  if (!url || !out) {
    console.log("Pakai: node scripts/screenshot.mjs <url> <lebar> <keluaran.png> [full|menu|megamenu|hover:<teks>|click:<aria-label>]");
    process.exit(1);
  }
  const width = Number(widthArg || 1440);
  const browser = await launchBrowser();
  try {
    const shot = await capturePage(browser, url, { width, out, action });
    console.log("scrollWidth", shot.scrollWidth, "viewport", width);
    for (const f of shot.files) console.log("ditulis", f.path);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
