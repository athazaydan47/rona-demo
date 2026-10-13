import { expect, test } from "@playwright/test";
import { addToCart, demoCustomer, fillMalangAddress, fillRecipient, loginAsDemo, orderNumberFromUrl, orderRow, pickVariants, resetDemoReviews, sql, uniquePhone } from "./helpers";

let guestOrderNumber = "";

test("tamu membeli, lalu masuk dengan nomor WA yang sama lewat OTP demo: pesanan ada di akun dan keranjang tergabung", async ({ page }) => {
  const phone = uniquePhone();
  const [first, second] = await pickVariants("gudang-online", ["lumi-cloud-lip-cream", "dayu-gel-pencil-liner", "mekar-kopi-body-scrub"], 3, 2);

  await addToCart(page, first);
  await page.goto("/checkout");
  await fillRecipient(page, phone);
  await fillMalangAddress(page);
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await page.getByRole("radio", { name: "JNE REG" }).click();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "QRIS" }).click();
  await page.getByRole("button", { name: /Buat Pesanan/ }).click();
  await page.waitForURL(/\/bayar\/RONA-/);
  guestOrderNumber = orderNumberFromUrl(page.url());
  await page.getByRole("button", { name: "Simulasikan pembayaran berhasil" }).click();
  await page.waitForURL(/\/sukses/);

  // Masih tamu: tambah produk lain ke keranjang, lalu simpan pesanan ke akun.
  await addToCart(page, second);
  await page.goto(`/pesanan/${guestOrderNumber}/sukses`);
  await page.getByRole("link", { name: "Simpan ke akun" }).click();
  await page.waitForURL(/\/masuk\?kembali=/);
  await page.getByLabel("Nomor WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Kirim kode lewat WhatsApp" }).click();
  const code = (await page.getByTestId("otp-demo").textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Kode OTP").fill(code);
  await expect(page.getByRole("heading", { name: "Senang kenalan!" })).toBeVisible();
  await page.getByLabel("Nama").fill("Tamu Jadi Member");
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();
  await page.waitForURL(new RegExp(`/pesanan/${guestOrderNumber}$`));
  await expect(page.getByRole("heading", { name: guestOrderNumber })).toBeVisible();

  await page.goto("/akun/pesanan");
  await expect(page.getByTestId("kartu-pesanan").filter({ hasText: guestOrderNumber })).toBeVisible();

  const [customer] = await sql<{ id: number }[]>`select id from customers where phone = ${phone}`;
  expect((await sql`select 1 from orders where number = ${guestOrderNumber} and customer_id = ${customer.id}`).length).toBe(1);
  const items = await sql<{ variant_id: number; quantity: number }[]>`select ci.variant_id, ci.quantity from cart_items ci join carts c on c.id = ci.cart_id where c.customer_id = ${customer.id}`;
  expect(items.map((i) => i.variant_id)).toContain(second.variantId);

  const [{ name }] = await sql<{ name: string }[]>`select p.name from products p join variants v on v.product_id = p.id where v.id = ${second.variantId}`;
  await page.goto("/keranjang");
  await expect(page.getByRole("main").getByText(name).filter({ visible: true }).first()).toBeVisible();
});

test("Pembeli Demo: checkout dengan alamat tersimpan dan tukar poin, bayar, kirim, diterima, poin sesuai rumus, ulasan pertama dapat bonus 50", async ({ page }) => {
  await resetDemoReviews();
  const [pick] = await pickVariants("gudang-online", ["arunika-pagi-edp", "kirana-lab-caffeine-eye-serum", "nara-men-acne-control-serum"], 3, 1);
  const productBefore = (await sql<{ review_count: number }[]>`select p.review_count from products p where p.slug = ${pick.productSlug}`)[0];

  await loginAsDemo(page);
  const balanceBefore = (await demoCustomer()).points;
  expect(balanceBefore).toBeGreaterThan(0);
  await addToCart(page, pick);
  await page.goto("/checkout");

  // Alamat utama terpilih otomatis.
  await expect(page.getByRole("radio", { name: /Kos/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await page.getByRole("radio", { name: "JNE REG" }).click();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "QRIS" }).click();
  const toggle = page.getByRole("switch");
  await expect(page.getByText(/^Pakai [\d.]+ poin, hemat Rp/)).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("poin-dipakai").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: /Buat Pesanan/ }).click();
  await page.waitForURL(/\/bayar\/RONA-/);
  const number = orderNumberFromUrl(page.url());

  const [placed] = await sql<{ subtotal: number; voucher_discount: number; points_used: number; customer_id: number }[]>`select subtotal, voucher_discount, points_used, customer_id from orders where number = ${number}`;
  expect(placed.points_used).toBeGreaterThan(0);
  expect(placed.points_used).toBeLessThanOrEqual(Math.floor((placed.subtotal - placed.voucher_discount) * 0.5));
  expect((await demoCustomer()).points).toBe(balanceBefore - placed.points_used);

  await page.getByRole("button", { name: "Simulasikan pembayaran berhasil" }).click();
  await page.waitForURL(/\/sukses/);
  await page.goto(`/pesanan/${number}`);
  await page.getByRole("button", { name: "Simulasikan toko: proses dan kirim pesanan" }).click();
  await expect(page.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Dikirim");
  await page.getByRole("button", { name: "Pesanan diterima" }).click();
  await expect(page.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Selesai");
  expect((await orderRow(number)).status).toBe("selesai");

  const earned = Math.floor((placed.subtotal - placed.voucher_discount - placed.points_used) / 1000);
  expect((await demoCustomer()).points).toBe(balanceBefore - placed.points_used + earned);

  await page.getByRole("link", { name: "Tulis ulasan" }).first().click();
  await page.waitForURL(/\/akun\/ulasan\//);
  await page.getByRole("radio", { name: "5 bintang" }).click();
  await page.getByLabel("Ceritakan pengalamanmu").fill("Wanginya lembut dan tahan lama, cocok untuk dipakai ke kampus.");
  await expect(page.getByLabel("Jenis kulitmu")).toHaveValue("kombinasi");
  await page.getByRole("button", { name: "Kirim ulasan" }).click();
  await expect(page.getByTestId("bonus-ulasan")).toContainText("+50 poin");
  expect((await demoCustomer()).points).toBe(balanceBefore - placed.points_used + earned + 50);

  const productAfter = (await sql<{ review_count: number }[]>`select p.review_count from products p where p.slug = ${pick.productSlug}`)[0];
  expect(productAfter.review_count).toBe(productBefore.review_count + 1);
  const ledgerSum = (await sql<{ s: number }[]>`select coalesce(sum(amount), 0)::int as s from points_ledger where customer_id = ${placed.customer_id}`)[0].s;
  expect(ledgerSum).toBe((await demoCustomer()).points);

  await page.getByRole("link", { name: "Lihat di halaman produk" }).click();
  await page.waitForURL(new RegExp(`/p/${pick.productSlug}`));
  const review = page.getByRole("listitem").filter({ hasText: "Wanginya lembut dan tahan lama" }).filter({ visible: true });
  await expect(review).toBeVisible();
  await expect(review.getByText("Pembeli terverifikasi")).toBeVisible();
  await expect(review.getByText(/Kulit Kombinasi/)).toBeVisible();
});

test("pembeli tidak bisa membuka pesanan milik orang lain", async ({ page }) => {
  // Pesanan tamu dari uji pertama kini milik akun lain; Pembeli Demo tidak punya tokennya.
  let number = guestOrderNumber;
  if (!number) [{ number }] = await sql<{ number: string }[]>`select number from orders where customer_id is distinct from (select id from customers where phone = '080000000001') order by id desc limit 1`;
  await loginAsDemo(page);
  await page.goto(`/pesanan/${number}`);
  await expect(page.getByRole("heading", { name: `Pesanan ${number}` })).toBeVisible();
  await expect(page.getByText(/masukkan nomor WhatsApp yang dipakai saat memesan/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Produk" })).toHaveCount(0);
  await page.goto("/akun/pesanan");
  await expect(page.getByTestId("kartu-pesanan").filter({ hasText: number })).toHaveCount(0);
  // Aksi pemilik lewat route simulasi juga ditolak tanpa token.
  const res = await page.request.post("/api/demo/simulasi-kirim", { data: { nomor: number }, headers: { origin: new URL(page.url()).origin } });
  expect(res.status()).toBe(404);
});
