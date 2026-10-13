// Alur akun untuk lembar cuplik: halaman masuk dengan OTP demo tampil, lalu masuk sebagai Pembeli Demo dan potret
// /akun (ringkasan, alamat, pesanan, poin, profil kulit, Kotak Notifikasi), formulir ulasan, dan checkout langkah 3
// dengan poin dipakai. Tidak membuat pesanan dan tidak mengirim ulasan; isi keranjang demo dikosongkan lagi di akhir.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local" });

const DEMO_PHONE = "080000000001";
// Tinggi maksimal per potretan (px CSS) supaya seluruh alur muat di sekitar 2 lembar.
const MAX_H = { 375: 1500, 1440: 1050 };

async function withSql(fn) {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

const pickVariant = () =>
  withSql(async (sql) => {
    const [r] = await sql`
      select p.slug as product_slug, v.shade_slug
      from variants v
      join products p on p.id = v.product_id
      join inventory i on i.variant_id = v.id
      join locations l on l.id = i.location_id
      where l.slug = 'gudang-online' and v.is_active and p.status = 'aktif' and i.on_hand - i.reserved >= 3
        and p.slug in ('pualam-second-skin-foundation', 'lumi-cloud-lip-cream', 'arunika-pagi-edp')
      order by p.slug, v.sort_order limit 1`;
    if (!r) throw new Error("Tidak menemukan produk dengan stok gudang untuk alur akun.");
    return { productSlug: r.product_slug, shadeSlug: r.shade_slug };
  });

const clearDemoCart = () =>
  withSql((sql) => sql`delete from cart_items where cart_id in (select c.id from carts c join customers u on u.id = c.customer_id where u.phone = ${DEMO_PHONE})`);

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureAccountFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
  const height = width < 768 ? 812 : 900;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", baseURL: baseUrl });
  const page = await context.newPage();
  const shots = [];
  const snap = async (label, fullPage = true) => {
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(outDir, `${slug}-${width}-${shots.length + 1}.png`);
    const shot = await shootPage(page, out, { width, height, deviceScaleFactor, fullPage, mode, maxCssHeight: MAX_H[width] });
    shots.push({ ...shot, path: label, width });
  };
  const settle = async () => {
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
  };
  const visit = async (url, label) => {
    await page.goto(url, { waitUntil: "load" });
    await settle();
    await snap(label);
  };
  try {
    // 1. Halaman masuk dengan OTP demo tampil (nomor fiktif sekali pakai, tidak diselesaikan).
    await page.goto("/masuk", { waitUntil: "load" });
    await settle();
    await page.getByLabel("Nomor WhatsApp").fill(`0899${String(Date.now()).slice(-8)}`);
    await page.getByRole("button", { name: "Kirim kode lewat WhatsApp" }).click();
    await page.getByTestId("otp-demo").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(300);
    await snap("/masuk: OTP demo tampil", false);

    // 2. Masuk sebagai Pembeli Demo.
    await page.goto("/masuk?kembali=/akun", { waitUntil: "load" });
    await page.getByRole("button", { name: "Masuk sebagai Pembeli Demo" }).click();
    await page.waitForURL((u) => u.pathname === "/akun", { timeout: 30_000 });
    await settle();
    await snap("/akun ringkasan");
    await visit("/akun/alamat", "/akun/alamat");
    await visit("/akun/pesanan", "/akun/pesanan");
    await visit("/akun/poin", "/akun/poin");
    await visit("/akun/profil-kulit", "/akun/profil-kulit");
    await visit("/akun/notifikasi", "/akun/notifikasi (Kotak Notifikasi)");

    // 3. Formulir ulasan untuk item pesanan Selesai yang belum diulas (diisi, tidak dikirim).
    await page.goto("/akun/pesanan?tab=selesai", { waitUntil: "load" });
    await settle();
    const write = page.getByRole("link", { name: /Tulis ulasan/ }).first();
    const href = await write.getAttribute("href", { timeout: 10_000 }).catch(() => null);
    if (href) {
      await page.goto(href, { waitUntil: "load" });
      await settle();
      await page.getByRole("radio", { name: "5 bintang" }).click();
      await page.getByLabel("Ceritakan pengalamanmu").fill("Teksturnya ringan, tidak lengket, dan wanginya lembut. Cocok untuk kulit kombinasiku.");
      await page.waitForTimeout(200);
      await snap("Formulir ulasan");
    }

    // 4. Checkout langkah 3 dengan poin dipakai (pesanan tidak dibuat).
    const pick = await pickVariant();
    await page.goto(`/p/${pick.productSlug}?shade=${pick.shadeSlug}`, { waitUntil: "load" });
    await settle();
    await page.getByRole("button", { name: "Tambah ke Keranjang", exact: true }).click();
    await page.getByRole("dialog", { name: /Keranjang/ }).getByRole("link", { name: "Checkout" }).waitFor({ timeout: 20_000 });
    await page.goto("/checkout", { waitUntil: "load" });
    await settle();
    await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
    await page.getByRole("radio", { name: "JNE REG" }).click();
    await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
    await page.getByRole("radio", { name: "QRIS" }).click();
    await page.getByRole("switch").click();
    await page.getByTestId("poin-dipakai").first().waitFor({ state: "attached", timeout: 15_000 });
    await page.waitForTimeout(500);
    await snap("Checkout langkah 3: poin dipakai");
  } finally {
    await context.close();
    await clearDemoCart().catch(() => {});
  }
  return shots;
}
