// Alur AI pembeli untuk lembar cuplik (server dengan AI_PROVIDER=mock): panel Advisor dengan kartu produk (375 dan
// 1440), pencarian dengan chip tafsiran, satu langkah kuis, rutinitas dengan saran pemakaian, dialog padanan shade,
// "Cocok untuk kulitmu?", dan ringkasan ulasan. Ringkasan dibuat dulu dengan npm run ai:ringkasan (mock).
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

const MAX_H = { 375: 1300, 1440: 900 };

async function pickData() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [cushion] = await sql`select p.slug from products p join categories c on c.id = p.category_id where c.slug = 'cushion' and p.status = 'aktif' order by p.id limit 1`;
    const [summary] = await sql`select p.slug from review_summaries s join products p on p.id = s.product_id where p.status = 'aktif' order by s.review_count desc, p.id limit 1`;
    return { cushion: cushion?.slug, summary: summary?.slug };
  } finally {
    await sql.end();
  }
}

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAiBuyerFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
  const height = width < 768 ? 812 : 900;
  const phone = width < 768;
  const data = await pickData();
  const shots = [];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", baseURL: baseUrl });
  const page = await context.newPage();
  const snap = async (name, fullPage = true) => {
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
    await step("advisor", async () => {
      await visit("/");
      await page.getByTestId("tombol-advisor").click();
      const panel = page.getByTestId("panel-advisor");
      await panel.getByLabel("Pesan untuk Rona Advisor").fill("Sunscreen untuk kulit berminyak di bawah 100 ribu");
      await panel.getByRole("button", { name: "Kirim" }).click();
      await panel.getByTestId("kartu-advisor").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(300);
      await snap("Rona Advisor dengan kartu produk", false);
      await page.keyboard.press("Escape");
    });
    if (phone) return shots;

    await step("cari", async () => {
      await visit(`/cari?q=${encodeURIComponent("lipstik yang ga bikin bibir kering buat kondangan")}`);
      await snap("Pencarian dengan chip tafsiran", false);
    });
    await step("kuis", async () => {
      await visit("/kuis-kulit");
      const quiz = page.getByTestId("kuis-kulit");
      await quiz.getByTestId("kulit-kombinasi").click();
      await quiz.getByRole("button", { name: /Lanjut/ }).click();
      await quiz.getByTestId("masalah-jerawat").click();
      await quiz.getByTestId("masalah-kusam").click();
      await quiz.getByRole("button", { name: /Lanjut/ }).click();
      await quiz.getByTestId("sensitif-rendah").click();
      await quiz.getByRole("button", { name: /Lanjut/ }).click();
      await quiz.getByTestId("budget-150000").click();
      await quiz.getByRole("button", { name: /Lanjut/ }).click();
      await quiz.getByTestId("kedalaman-3").click();
      await quiz.getByTestId("undertone-warm").click();
      await snap("Kuis kulit: langkah warna kulit", false);
      await quiz.getByRole("button", { name: /Lanjut/ }).click();
      await quiz.getByTestId("rutin-sunscreen").click();
      await quiz.getByRole("button", { name: "Lihat rutinitasku" }).click();
      await page.waitForURL(/\/rutinitas$/);
      await page.waitForTimeout(600);
      await snap("Rutinitas dengan saran pemakaian");
    });
    if (data.cushion) {
      await step("produk", async () => {
        await visit(`/p/${data.cushion}`);
        await page.getByTestId("cocok-kulit").scrollIntoViewIfNeeded();
        await snap("Halaman produk: Cocok untuk kulitmu?", false);
        await page.getByTestId("tombol-padanan").click();
        const dialog = page.getByRole("dialog", { name: "Cari padanan shade" });
        await dialog.getByRole("button", { name: "Cari padanan" }).click();
        await dialog.getByTestId("hasil-padanan").waitFor();
        await page.waitForTimeout(300);
        await snap("Dialog padanan shade", false);
        await page.keyboard.press("Escape");
      });
    }
    if (data.summary) {
      await step("ringkasan", async () => {
        await visit(`/p/${data.summary}`);
        await page.getByTestId("ringkasan-ulasan").scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snap("Ringkasan ulasan AI", false);
      });
    }
  } finally {
    await context.close();
  }
  return shots;
}
