// Alur admin untuk lembar cuplik: /admin/masuk, Dashboard Owner, Pesanan (kanban dan tabel), detail pesanan,
// pratinjau label A6, matriks stok, formulir transfer, opname dengan selisih, Staf dan izin, Log aktivitas,
// lalu Dashboard Staf Dinoyo di HP. Tidak menyimpan transfer atau opname.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

const MAX_H = { 375: 1300, 1440: 900 };

async function pickData() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [order] = await sql`select number from orders where status in ('dibayar', 'diproses', 'dikirim') and method = 'kirim' order by id desc limit 1`;
    const [anyOrder] = await sql`select number from orders order by id desc limit 1`;
    const [variant] = await sql`
      select v.sku from variants v join inventory i on i.variant_id = v.id join locations l on l.id = i.location_id
      where l.slug = 'gudang-online' and i.on_hand - i.reserved >= 5 order by v.id limit 1`;
    const [dinoyo] = await sql`select id from locations where slug = 'dinoyo'`;
    return { number: (order ?? anyOrder)?.number, sku: variant?.sku, dinoyoId: dinoyo?.id };
  } finally {
    await sql.end();
  }
}

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAdminFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
  const height = width < 768 ? 812 : 900;
  const data = await pickData();
  const shots = [];
  const run = async (label, fn) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", baseURL: baseUrl });
    const page = await context.newPage();
    const snap = async (name, fullPage = true) => {
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(outDir, `${slug}-${width}-${shots.length + 1}.png`);
      const shot = await shootPage(page, out, { width, height, deviceScaleFactor, fullPage, mode, maxCssHeight: MAX_H[width] });
      shots.push({ ...shot, path: name, width });
    };
    const settle = async () => {
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(350);
    };
    const visit = async (url, name) => {
      await page.goto(url, { waitUntil: "load" });
      await settle();
      await snap(name);
    };
    const login = async (role, kembali = "/admin") => {
      await page.goto(`/admin/masuk?kembali=${encodeURIComponent(kembali)}`, { waitUntil: "load" });
      await page.getByRole("button", { name: role, exact: true }).click();
      await page.waitForURL((u) => u.pathname === kembali, { timeout: 30_000 });
      await settle();
    };
    try {
      await fn({ page, snap, settle, visit, login });
    } catch (e) {
      console.error(`  (${label} gagal: ${e instanceof Error ? e.message.split("\n")[0] : e})`);
    } finally {
      await context.close();
    }
  };

  await run("owner", async ({ page, snap, settle, visit, login }) => {
    await page.goto("/admin/masuk", { waitUntil: "load" });
    await settle();
    await snap("/admin/masuk", false);
    await login("Owner");
    await snap("Dashboard (Owner)");
    await visit("/admin/pesanan", "Pesanan: kanban");
    await visit("/admin/pesanan?tampilan=tabel", "Pesanan: tabel");
    if (data.number) {
      await visit(`/admin/pesanan/${data.number}`, "Detail pesanan");
      await visit(`/admin/pesanan/${data.number}/label`, "Pratinjau label A6");
    }
    await visit("/admin/stok", "Matriks stok");
    await page.goto("/admin/stok/transfer", { waitUntil: "load" });
    await settle();
    await page.getByLabel("Lokasi tujuan").selectOption({ label: "Rona Sawojajar" });
    if (data.sku) {
      await page.getByLabel("Varian baris 1").fill(data.sku);
      await page.getByRole("option", { name: new RegExp(data.sku) }).click();
      await page.getByLabel("Jumlah baris 1").fill("3");
      await page.getByRole("button", { name: "Lanjut ke ringkasan" }).click();
      await page.getByTestId("ringkasan-stok").waitFor();
    }
    await snap("Transfer: ringkasan sebelum simpan");
    await page.goto(`/admin/stok/opname?lokasi=${data.dinoyoId ?? ""}&merek=lumi`, { waitUntil: "load" });
    await settle();
    const inputs = page.getByRole("textbox", { name: /Jumlah fisik/ });
    const n = Math.min(4, await inputs.count());
    for (let i = 0; i < n; i++) await inputs.nth(i).fill(String([12, 3, 7, 0][i]));
    await page.waitForTimeout(200);
    await snap("Opname dengan selisih");
    await visit("/admin/staf", "Staf dan izin");
    await visit("/admin/log", "Log aktivitas");
  });

  if (width < 768) {
    await run("dinoyo", async ({ snap, login }) => {
      await login("Staf Cabang Dinoyo");
      await snap("Dashboard Staf Dinoyo (HP)");
    });
  }
  return shots;
}
