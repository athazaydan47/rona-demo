// Alur AI dari foto dan link untuk lembar cuplik (server dengan AI_PROVIDER=mock): pilihan isi kuis, layar
// persetujuan foto, kuis terisi dari foto, dan /cari-dari-video dengan hasil dupe di 375 dan 1440 px.
// Gambar uji sintetis dari evals/7c/gambar (bukan foto orang sungguhan).
import path from "node:path";
import { shootPage } from "./screenshot.mjs";

const MAX_H = { 375: 1300, 1440: 900 };
const FACE = path.resolve("evals/7c/gambar/wajah-ilustrasi.jpg");
const TIKTOK = "https://www.tiktok.com/@rona.demo/video/7300000000000000001";

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAiPhotoFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
  const height = width < 768 ? 812 : 900;
  const phone = width < 768;
  const shots = [];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", baseURL: baseUrl });
  const page = await context.newPage();
  const snap = async (name, fullPage = false) => {
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(outDir, `${slug}-${width}-${shots.length + 1}.png`);
    const shot = await shootPage(page, out, { width, height, deviceScaleFactor, fullPage, mode, maxCssHeight: MAX_H[width] });
    shots.push({ ...shot, path: name, width });
  };
  const visit = async (url) => {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(700);
  };
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      console.error(`  (${label} gagal: ${e instanceof Error ? e.message.split("\n")[0] : e})`);
    }
  };

  try {
    if (!phone) {
      await step("kuis foto", async () => {
        await visit("/kuis-kulit");
        const quiz = page.getByTestId("kuis-kulit");
        await quiz.scrollIntoViewIfNeeded();
        await snap("Kuis kulit: pilihan isi sendiri atau dari foto");
        await quiz.getByTestId("bantu-foto").click();
        await quiz.getByTestId("setuju-foto").check();
        await page.waitForTimeout(200);
        await snap("Persetujuan sebelum unggah foto");
        await quiz.getByRole("button", { name: "Lanjut pilih foto" }).click();
        await quiz.getByTestId("input-galeri").setInputFiles(FACE);
        await quiz.getByTestId("info-dari-foto").waitFor({ timeout: 15_000 });
        await page.waitForTimeout(300);
        await snap("Kuis terisi dari foto, bertanda dari foto");
      });
    }
    await step("cari dari video", async () => {
      await visit("/cari-dari-video");
      await page.getByTestId("input-link").fill(TIKTOK);
      await page.getByRole("button", { name: "Cari yang mirip" }).click();
      await page.getByTestId("kartu-dupe").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(400);
      await snap("Cari dari video: hasil dupe", true);
    });
  } finally {
    await context.close();
  }
  return shots;
}
