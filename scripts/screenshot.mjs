// Tangkapan layar untuk pemeriksaan visual memakai Chrome yang sudah terpasang.
//   node scripts/screenshot.mjs <url> <lebar> <keluaran.png> [aksi]
//   aksi: full | hover:<teks> | click:<aria-label>
import { chromium } from "@playwright/test";

const [url, widthArg, out, action = "full"] = process.argv.slice(2);
const width = Number(widthArg || 1440);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
if (action.startsWith("hover:")) {
  await page.getByRole("button", { name: action.slice(6) }).first().hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: false });
} else if (action.startsWith("click:")) {
  await page.getByRole("button", { name: action.slice(6) }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: false });
} else {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log("scrollWidth", scrollWidth, "viewport", width);
  await page.screenshot({ path: out, fullPage: true });
}
await browser.close();
