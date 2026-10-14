// Alur admin Fase 6B untuk lembar cuplik: Dashboard dengan data riwayat, daftar produk, formulir produk dengan pratinjau,
// pohon kategori dengan peringatan nama mirip, kalender flash sale, formulir voucher, banner dengan pratinjau,
// pengaturan, lalu kanban baru dan opname di HP. Tidak menyimpan apa pun.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

const MAX_H = { 375: 1300, 1440: 900 };

async function pickData() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [product] = await sql`
      select p.id from products p join variants v on v.product_id = p.id
      where p.status = 'aktif' group by p.id having count(v.id) >= 4 order by p.id limit 1`;
    const [leaf] = await sql`select c.name from categories c where c.parent_id is not null and length(c.name) >= 6 order by c.sort_order, c.id limit 1`;
    const [dinoyo] = await sql`select id from locations where slug = 'dinoyo'`;
    return { productId: product?.id, leafName: leaf?.name ?? "Lip Tint", dinoyoId: dinoyo?.id };
  } finally {
    await sql.end();
  }
}

// Salah ketik yang wajar: tukar dua huruf terakhir.
const typo = (s) => s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1);

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAdmin6bFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
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
  const settle = async () => {
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(350);
  };
  const visit = async (url) => {
    await page.goto(url, { waitUntil: "load" });
    await settle();
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
    await settle();
    await snap("Dashboard dengan riwayat 90 hari");

    if (!phone) {
      await step("produk", async () => {
        await visit("/admin/produk");
        await snap("Daftar produk");
      });
    }
    if (data.productId) {
      await step("formulir produk", async () => {
        await visit(`/admin/produk/${data.productId}`);
        await page.getByRole("tab", { name: "Varian" }).click();
        await page.waitForTimeout(250);
        await snap("Formulir produk: varian dan pratinjau ProductArt");
      });
    }
    await step("kategori", async () => {
      await visit("/admin/kategori");
      await page.getByRole("button", { name: "Tambah kategori" }).click();
      await page.getByLabel("Nama kategori").fill(typo(data.leafName));
      await page.getByRole("dialog").getByRole("button", { name: "Simpan", exact: true }).click();
      await page.getByTestId("peringatan-mirip").waitFor({ timeout: 10_000 });
      await snap("Kategori: peringatan nama mirip", false);
    });
    await step("flash", async () => {
      await visit("/admin/promo?tab=flash");
      const first = page.locator("[data-slot]").first();
      if (await first.count()) await first.click();
      await page.waitForTimeout(250);
      await snap("Promo: kalender flash sale");
    });
    if (!phone) {
      await step("voucher", async () => {
        await visit("/admin/promo?tab=voucher");
        await snap("Promo: voucher dan statistik");
        await page.getByRole("button", { name: "Buat voucher" }).click();
        await page.getByLabel("Kode voucher").fill("GAJIAN25");
        await page.getByLabel("Judul voucher").fill("Hemat gajian");
        await page.getByLabel("Tipe voucher").selectOption("persen");
        await page.getByLabel("Nilai voucher").fill("25");
        await page.getByLabel("Maksimal potongan").fill("50000");
        await page.getByLabel("Minimal belanja").fill("200000");
        await page.waitForTimeout(200);
        await snap("Promo: formulir voucher", false);
      });
      await step("banner", async () => {
        await visit("/admin/promo?tab=banner");
        await page.getByRole("button", { name: /^Ubah / }).first().click();
        await page.getByTestId("pratinjau-banner").waitFor();
        await page.waitForTimeout(300);
        await snap("Promo: banner dengan pratinjau 375 dan 1440", false);
      });
    }
    await step("pengaturan", async () => {
      await visit("/admin/pengaturan");
      await snap("Pengaturan");
    });
    await step("kanban", async () => {
      await visit("/admin/pesanan");
      await snap("Pesanan: kanban baru");
    });
    if (phone) {
      await step("opname", async () => {
        await visit(`/admin/stok/opname?lokasi=${data.dinoyoId ?? ""}&merek=lumi`);
        const inputs = page.getByRole("textbox", { name: /Jumlah fisik/ }).filter({ visible: true });
        const n = Math.min(3, await inputs.count());
        for (let i = 0; i < n; i++) await inputs.nth(i).fill(String([12, 3, 7][i]));
        await page.waitForTimeout(200);
        await snap("Opname di HP: kartu dan bilah bawah", false);
      });
    }
  } finally {
    await context.close();
  }
  return shots;
}
