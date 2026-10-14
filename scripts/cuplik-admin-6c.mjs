// Alur admin Fase 6C untuk lembar cuplik: Laporan ringkasan dan satu tab rincian, daftar dan detail pelanggan,
// moderasi ulasan dengan dialog balas, notifikasi keluar, lalu Laporan di HP. Tidak menyimpan apa pun.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

const MAX_H = { 375: 1300, 1440: 900 };

async function pickData() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [customer] = await sql`select customer_id as id from orders where customer_id is not null group by customer_id order by count(*) desc limit 1`;
    return { customerId: customer?.id };
  } finally {
    await sql.end();
  }
}

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAdmin6cFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
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
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(350);
  };
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      console.error(`  (${label} gagal: ${e instanceof Error ? e.message.split("\n")[0] : e})`);
    }
  };

  try {
    await visit("/admin/masuk?kembali=%2Fadmin");
    await page.getByRole("button", { name: "Owner", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/admin", { timeout: 30_000 });

    await step("laporan", async () => {
      await visit("/admin/laporan?periode=30_hari&banding=1");
      await snap(phone ? "Laporan di HP: ringkasan" : "Laporan: ringkasan 30 hari dengan pembanding");
    });
    if (!phone) {
      await step("laporan rincian", async () => {
        await visit("/admin/laporan?periode=30_hari&tab=merek");
        await snap("Laporan: per merek");
      });
      await step("pelanggan", async () => {
        await visit("/admin/pelanggan");
        await snap("Pelanggan: daftar dan segmen");
        if (data.customerId) {
          await visit(`/admin/pelanggan/${data.customerId}`);
          await snap("Pelanggan: detail");
        }
      });
      await step("ulasan", async () => {
        await visit("/admin/ulasan?belum=1");
        await page.locator("[data-ulasan]").first().getByRole("button", { name: "Balas" }).click();
        await page.getByTestId("dialog-balas").getByLabel("Isi balasan").fill("Terima kasih masukannya, Kak. Tim kami segera menghubungimu, ya.");
        await page.waitForTimeout(250);
        await snap("Ulasan: moderasi dengan dialog balas", false);
      });
      await step("notifikasi", async () => {
        await visit("/admin/notifikasi");
        const first = page.getByRole("button", { name: /Pratinjau isi/ }).first();
        if (await first.count()) await first.click();
        await page.waitForTimeout(200);
        await snap("Notifikasi keluar");
      });
    } else {
      await step("laporan HP rincian", async () => {
        await visit("/admin/laporan?periode=30_hari&tab=kanal");
        await snap("Laporan di HP: per kanal");
      });
    }
  } finally {
    await context.close();
  }
  return shots;
}
