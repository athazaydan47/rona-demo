import { expect, test } from "@playwright/test";
import { loginStaff } from "./helpers";

// Fase 8A: halaman bantuan, 404 bermerek, etalase demo, panduan demo, dan alternatif keyboard kanban.

test("404 bermerek: pencarian dan kategori populer, status 404 sungguhan", async ({ page }) => {
  const res = await page.goto("/halaman-yang-tidak-ada");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman ini belum ada" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Kategori populer" }).getByRole("link")).toHaveCount(5);
  const res2 = await page.goto("/p/produk-yang-tidak-ada-xyz");
  expect(res2?.status()).toBe(404);
});

test("halaman bantuan: FAQ akordeon, daftar cabang dengan rute, cek ongkir menghitung dari tarif toko", async ({ page }) => {
  await page.goto("/faq");
  const faq = page.getByTestId("faq");
  await expect(faq).toBeVisible();
  const first = faq.getByRole("button").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");

  await page.goto("/toko");
  const branches = page.getByTestId("daftar-cabang");
  await expect(branches.getByRole("link", { name: /Rute di Google Maps/ })).toHaveCount(3);

  await page.goto("/cek-ongkir");
  const box = page.getByTestId("cek-ongkir");
  await box.getByLabel("Kota tujuan").selectOption({ label: "Kota Malang, Jawa Timur" });
  await expect(box.getByText(/JNE REG/)).toBeVisible();
  await expect(box.getByText(/Rp\s?9\.000/)).toBeVisible();

  await page.goto("/kebijakan-privasi");
  await expect(page).toHaveURL(/\/kebijakan\/privasi$/);
});

test("tentang demo: fitur per kelompok, masuk cepat, dan panduan 5 menit yang tercentang otomatis", async ({ page }) => {
  await page.goto("/tentang-demo");
  for (const h of ["Untuk pembeli", "Untuk pemilik toko dan staf", "AI yang dijaga kode"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  await expect(page.getByTestId("akun-demo").getByRole("button", { name: "Masuk sebagai Pembeli Demo" })).toBeVisible();
  await expect(page.getByTestId("akun-demo").getByRole("button", { name: "Owner", exact: true })).toBeVisible();

  await page.getByTestId("buka-panduan-tentang").click();
  const guide = page.getByTestId("panduan-demo");
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("checkbox")).toHaveCount(10);
  await expect(guide.getByRole("checkbox", { checked: true })).toHaveCount(0);

  // Membuka beranda mencentang langkah flash sale; kemajuan tersimpan di localStorage.
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // tunggu hidrasi supaya klik pita tidak hilang
  await page.getByTestId("buka-panduan").click();
  await expect(page.getByTestId("panduan-demo")).toBeVisible();
  await expect(page.getByTestId("panduan-demo").getByRole("checkbox", { checked: true })).toHaveCount(1);
  expect(await page.evaluate(() => window.localStorage.getItem("rona.panduan-demo"))).toContain("flash");
  await page.getByRole("button", { name: "Tutup panduan demo" }).click();
  await expect(page.getByTestId("panduan-demo")).toBeHidden();
});

test("kanban: kartu bisa dipindah tanpa seret lewat daftar status (keyboard dan HP)", async ({ page }) => {
  await loginStaff(page, "Owner", "/admin/pesanan");
  const select = page.getByTestId("pindah-status").filter({ visible: true }).first(); // daftar HP tersembunyi di desktop
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  expect(options[0]).toBe("Pindahkan ke...");
  expect(options.length).toBeGreaterThan(1);
});
