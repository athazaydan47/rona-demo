// Alur AI admin Fase 7B untuk lembar cuplik (server dengan AI_PROVIDER=mock): panel Asisten Admin dengan jawaban dan
// tabel (1440 dan 375), saran transfer, penulis deskripsi dengan usulan berdampingan, draf balasan ulasan, Kabar
// Harian, dan tab Rona Advisor di Laporan.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

const MAX_H = { 375: 1300, 1440: 900 };

async function pickData() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [p] = await sql`select id from products where slug = 'teduh-calming-centella-toner'`;
    return { productId: p?.id };
  } finally {
    await sql.end();
  }
}

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAiAdminFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
  const height = width < 768 ? 812 : 900;
  const phone = width < 768;
  const data = await pickData();
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
  const ask = async (q) => {
    await page.getByTestId(phone ? "asisten-header" : "asisten-sidebar").click();
    const panel = page.getByTestId("panel-asisten");
    await panel.getByLabel("Pertanyaan untuk Asisten Admin").fill(q);
    await panel.getByRole("button", { name: "Kirim pertanyaan" }).click();
    await panel.getByTestId("jawaban-asisten").last().getByTestId("tabel-asisten").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(300);
  };

  try {
    await visit("/admin/masuk?kembali=%2Fadmin");
    await page.getByRole("button", { name: "Owner", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/admin", { timeout: 30_000 });

    await step("asisten", async () => {
      await page.evaluate(() => sessionStorage.removeItem("rona.asisten"));
      await ask("Merek paling laku di Dinoyo bulan ini");
      await snap(phone ? "Asisten Admin di HP" : "Asisten Admin: jawaban dengan tabel dan sumber");
      await page.keyboard.press("Escape");
    });
    if (phone) return shots;

    await step("saran transfer", async () => {
      await visit("/admin/stok");
      await page.getByTestId("saran-transfer").scrollIntoViewIfNeeded();
      await snap("Stok: saran transfer");
    });
    if (data.productId) {
      await step("penulis deskripsi", async () => {
        await visit(`/admin/produk/${data.productId}`);
        await page.getByRole("tab", { name: "Deskripsi" }).click();
        const writer = page.getByTestId("penulis-ai");
        await writer.getByRole("button", { name: /Bantu tulis dengan AI/ }).click();
        await writer.getByLabel("Poin acuan").fill("- menenangkan kulit yang mudah merah\n- tanpa alkohol, ringan");
        await writer.getByTestId("buat-usulan").click();
        await writer.getByTestId("usulan-ringkas").waitFor({ timeout: 20_000 });
        await writer.getByTestId("usulan-ringkas").scrollIntoViewIfNeeded();
        await snap("Penulis deskripsi: usulan berdampingan dengan isi lama");
      });
    }
    await step("draf balasan", async () => {
      await visit("/admin/ulasan?belum=1");
      await page.getByRole("button", { name: "Balas" }).first().click();
      const dialog = page.getByTestId("dialog-balas");
      await dialog.getByTestId("draf-ai").click();
      await page.waitForFunction(() => (document.querySelector('[aria-label="Isi balasan"]')?.value ?? "").length > 20, null, { timeout: 20_000 });
      await snap("Ulasan: draf balasan dari AI");
      await page.keyboard.press("Escape");
    });
    await step("kabar harian", async () => {
      await visit("/admin/kabar");
      await snap("Kabar Harian dengan pratinjau WA");
    });
    await step("laporan advisor", async () => {
      await visit("/admin/laporan?periode=30_hari&tab=advisor");
      await snap("Laporan: tab Rona Advisor");
    });
  } finally {
    await context.close();
  }
  return shots;
}
