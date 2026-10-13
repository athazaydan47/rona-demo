// Alur beli otomatis untuk lembar cuplik: tambah 2 produk, lalu potret laci keranjang, /keranjang,
// tiga langkah checkout, /bayar, halaman sukses, dan /pesanan. Membuat satu pesanan demo sungguhan per lebar.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

async function pickTwoVariants() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`
      select p.slug as product_slug, v.shade_slug
      from variants v
      join products p on p.id = v.product_id
      join inventory i on i.variant_id = v.id
      join locations l on l.id = i.location_id
      where l.slug = 'gudang-online' and v.is_active and p.status = 'aktif' and i.on_hand - i.reserved >= 3
        and p.slug in ('lumi-velvet-matte-lipstick', 'pualam-velvet-matte-cushion-spf-50', 'lumi-water-tint', 'pualam-second-skin-foundation')
      order by p.slug, v.sort_order`;
    const picks = [];
    for (const r of rows) {
      if (picks.some((p) => p.productSlug === r.product_slug)) continue;
      picks.push({ productSlug: r.product_slug, shadeSlug: r.shade_slug });
      if (picks.length === 2) break;
    }
    if (picks.length < 2) throw new Error("Tidak menemukan 2 produk ber-shade dengan stok gudang untuk alur beli.");
    return picks;
  } finally {
    await sql.end();
  }
}

/**
 * @param {import("@playwright/test").Browser} browser
 * @returns {Promise<Array<object>>} potretan dengan label untuk lembar kontak
 */
export async function captureBuyFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug }) {
  const height = width < 768 ? 812 : 900;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", baseURL: baseUrl });
  const page = await context.newPage();
  const shots = [];
  const snap = async (label, fullPage = true) => {
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(outDir, `${slug}-${width}-${shots.length + 1}.png`);
    const shot = await shootPage(page, out, { width, height, deviceScaleFactor, fullPage });
    shots.push({ ...shot, path: label, width });
  };
  const settle = async () => {
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
  };
  try {
    const picks = await pickTwoVariants();
    for (const [i, p] of picks.entries()) {
      await page.goto(`/p/${p.productSlug}?shade=${p.shadeSlug}`, { waitUntil: "load" });
      await settle();
      await page.getByRole("button", { name: "Tambah ke Keranjang", exact: true }).click();
      const drawer = page.getByRole("dialog", { name: /Keranjang/ });
      await drawer.getByRole("link", { name: "Checkout" }).waitFor({ timeout: 20_000 });
      await page.waitForTimeout(500);
      if (i === picks.length - 1) await snap("Laci keranjang", false);
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
    }

    await page.goto("/keranjang", { waitUntil: "load" });
    await settle();
    await snap("/keranjang");

    await page.goto("/checkout", { waitUntil: "load" });
    await settle();
    await page.getByLabel("Nama penerima").fill("Ayu Lestari");
    await page.getByLabel("Nomor WhatsApp").fill(`0813${String(Date.now()).slice(-8)}`);
    await page.getByLabel("Provinsi").selectOption("35");
    await page.getByLabel("Kota atau kabupaten").selectOption("35.73");
    await page.getByLabel("Kecamatan").selectOption({ label: "Lowokwaru" });
    await page.getByLabel("Kode pos").fill("65145");
    await page.getByLabel("Alamat lengkap").fill("Jl. Sumbersari Gg. 4 No. 12, RT 03 RW 05, dekat masjid");
    await page.waitForTimeout(600);
    await snap("Checkout langkah 1: penerima dan alamat");

    await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
    await page.getByRole("radio", { name: "JNE REG" }).click();
    await page.waitForTimeout(700);
    await snap("Checkout langkah 2: pengiriman");

    await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
    await page.getByRole("radio", { name: "QRIS" }).click();
    await page.getByLabel("Kode voucher").fill("RONABARU");
    await page.getByRole("button", { name: "Pakai" }).click();
    await page.getByText(/Voucher terpasang/).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await snap("Checkout langkah 3: pembayaran");

    await page.getByRole("button", { name: /Buat Pesanan/ }).click();
    await page.waitForURL(/\/bayar\/RONA-/, { timeout: 30_000 });
    await settle();
    await snap("/bayar (QRIS)");

    await page.getByRole("button", { name: "Simulasikan pembayaran berhasil" }).click();
    await page.waitForURL(/\/pesanan\/RONA-.*\/sukses/, { timeout: 30_000 });
    await settle();
    await snap("Halaman sukses");

    await page.getByRole("main").getByRole("link", { name: "Lacak pesanan" }).click();
    await page.waitForURL(/\/pesanan\/RONA-[^/]+\?t=/, { timeout: 30_000 });
    await settle();
    await snap("/pesanan");
  } finally {
    await context.close();
  }
  return shots;
}
