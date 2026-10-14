// Uji asap produksi (Fase 8B): hanya-baca, aman untuk situs yang sudah tayang. Tidak membuat pesanan, tidak masuk,
// tidak mengubah data. Dijalankan lewat: npm run uji:produksi -- --url=https://alamat-situs
import { expect, test } from "@playwright/test";

const PRODUK = process.env.UJI_PRODUK_SLUG ?? "pualam-velvet-matte-cushion-spf-50";

test("beranda tampil dengan judul toko dan tanpa galat konsol", async ({ page }) => {
  const galat: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) galat.push(m.text());
  });
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigasi bawah" }).or(page.getByRole("navigation", { name: "Navigasi utama" })).first()).toBeAttached();
  expect(galat).toEqual([]);
});

test("halaman produk menampilkan nama, harga, dan tombol beli", async ({ page }) => {
  const res = await page.goto(`/p/${PRODUK}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByTestId("harga-produk").filter({ visible: true }).first()).toContainText("Rp");
  await expect(page.getByRole("button", { name: /Tambah ke Keranjang|Kabari aku/ }).first()).toBeVisible();
});

test("pencarian tahan salah ketik", async ({ page }) => {
  const res = await page.goto("/cari?q=cusion");
  expect(res?.status()).toBe(200);
  await expect(page.locator("article").first()).toBeVisible();
});

test("404 sungguhan untuk produk dan halaman yang tidak ada", async ({ request }) => {
  expect((await request.get("/p/produk-yang-tidak-ada-xyz")).status()).toBe(404);
  expect((await request.get("/halaman-yang-tidak-ada-xyz")).status()).toBe(404);
});

test("/api/sehat: database terjangkau, seed terpasang, tanpa data uji", async ({ request }) => {
  const res = await request.get("/api/sehat");
  expect(res.status()).toBe(200);
  const d = await res.json();
  expect(d).toMatchObject({ ok: true, db: { ok: true } });
  expect(d.seed.terpasang).toBeGreaterThan(0);
  expect(d.dataUji).toEqual({ products: 0, flash_sales: 0, vouchers: 0 });
  // Tidak ada data pribadi atau rahasia di jawaban.
  expect(JSON.stringify(d)).not.toMatch(/postgres|password|secret|@[a-z]+\.[a-z]/i);
});

test("robots.txt menolak semua perayap dan header noindex terpasang", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \//);
  const res = await request.get("/");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
});

test("header keamanan dan security.txt", async ({ request }) => {
  const h = (await request.get("/")).headers();
  const csp = h["content-security-policy"] ?? h["content-security-policy-report-only"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  if (process.env.UJI_HTTPS !== "0" && /^https:/.test(String(test.info().project.use.baseURL))) expect(h["strict-transport-security"]).toContain("max-age=");
  const sec = await request.get("/.well-known/security.txt");
  expect(sec.status()).toBe(200);
  const text = await sec.text();
  expect(text).toMatch(/^Contact: mailto:/m);
  expect(text).toMatch(/^Expires: \d{4}-/m);
});

test("route cron menolak tanpa rahasia", async ({ request }) => {
  expect([401, 503]).toContain((await request.get("/api/cron/kedaluwarsa")).status());
});
