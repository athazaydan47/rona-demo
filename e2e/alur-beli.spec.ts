import { expect, test } from "@playwright/test";
import { addToCart, fillMalangAddress, fillRecipient, orderNumberFromUrl, orderRow, pickVariants, sql, stockOf, uniquePhone } from "./helpers";

test.afterAll(async () => {
  await sql.end();
});

test("tamu membeli 2 produk berbeda shade dengan voucher, kirim ke Kota Malang, bayar QRIS simulasi", async ({ page }) => {
  const picks = await pickVariants("gudang-online", ["lumi-velvet-matte-lipstick", "pualam-velvet-matte-cushion-spf-50"], 3, 2);
  const before = await Promise.all(picks.map((p) => stockOf(p.variantId, "gudang-online")));

  for (const p of picks) await addToCart(page, p);

  await page.goto("/checkout");
  await fillRecipient(page, uniquePhone());
  await fillMalangAddress(page);
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();

  const jne = page.getByRole("radio", { name: "JNE REG" });
  await expect(jne).toBeVisible();
  await jne.click();
  await expect(jne.getByText(/Estimasi tiba/)).toBeVisible();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();

  await page.getByRole("radio", { name: "QRIS" }).click();
  await page.getByLabel("Kode voucher").fill("RONABARU");
  await page.getByRole("button", { name: "Pakai" }).click();
  await expect(page.getByText(/Voucher terpasang, hemat Rp\s20\.000/)).toBeVisible();

  await page.getByRole("button", { name: /Buat Pesanan/ }).click();
  await page.waitForURL(/\/bayar\/RONA-/);
  const number = orderNumberFromUrl(page.url());
  await expect(page.getByRole("img", { name: /Kode QRIS/ })).toBeVisible();

  const reserved = await Promise.all(picks.map((p) => stockOf(p.variantId, "gudang-online")));
  reserved.forEach((s, i) => expect(s.reserved).toBe(before[i].reserved + 1));

  await page.getByRole("button", { name: "Simulasikan pembayaran berhasil" }).click();
  await page.waitForURL(/\/pesanan\/RONA-.*\/sukses/);
  await expect(page.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Dibayar");

  const order = await orderRow(number);
  expect(order).toMatchObject({ status: "dibayar", voucher_code: "RONABARU", method: "kirim" });
  const after = await Promise.all(picks.map((p) => stockOf(p.variantId, "gudang-online")));
  after.forEach((s, i) => {
    expect(s.onHand).toBe(before[i].onHand - 1);
    expect(s.reserved).toBe(before[i].reserved);
  });
});

test("ambil di Rona Dinoyo dengan Bayar di Toko, staf menandai lunas dan diambil, status Selesai", async ({ page }) => {
  const [pick] = await pickVariants("dinoyo", null, 2, 1);
  const before = await stockOf(pick.variantId, "dinoyo");
  await addToCart(page, pick);

  await page.goto("/checkout");
  await fillRecipient(page, uniquePhone());
  await page.getByRole("radio", { name: /^Ambil di Toko/ }).click();
  await page.getByRole("radio", { name: "Rona Dinoyo" }).click();
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await expect(page.getByText(/Siap diambil/).first()).toBeVisible();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "Bayar di Toko" }).click();
  await page.getByRole("button", { name: /Buat Pesanan/ }).click();

  await page.waitForURL(/\/pesanan\/RONA-.*\/sukses/);
  const number = orderNumberFromUrl(page.url());
  await expect(page.getByText("Pesanan dibuat, bayar saat ambil")).toBeVisible();
  expect((await stockOf(pick.variantId, "dinoyo")).reserved).toBe(before.reserved + 1);

  await page.getByRole("main").getByRole("link", { name: "Lacak pesanan" }).click();
  await page.waitForURL(new RegExp(`/pesanan/${number}\\?t=`));
  await page.getByRole("button", { name: "Simulasikan staf: tandai lunas dan sudah diambil" }).click();
  await expect(page.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Selesai");

  expect(await orderRow(number)).toMatchObject({ status: "selesai", method: "ambil" });
  expect(await stockOf(pick.variantId, "dinoyo")).toEqual({ onHand: before.onHand - 1, reserved: before.reserved });
  const history = await sql<{ to_status: string }[]>`select to_status from order_status_history h join orders o on o.id = h.order_id where o.number = ${number} order by h.id`;
  expect(history.map((h) => h.to_status)).toEqual(["menunggu_pembayaran", "dibayar", "selesai"]);
});

test("pesanan dibiarkan kedaluwarsa: jam dimajukan, status Dibatalkan dan stok kembali", async ({ page, request }) => {
  const [pick] = await pickVariants("gudang-online", ["kalis-scalp-tonic", "teduh-low-ph-gel-wash", "embun-hyaluron-5-serum"], 2, 1);
  const before = await stockOf(pick.variantId, "gudang-online");
  await addToCart(page, pick);

  await page.goto("/checkout");
  await fillRecipient(page, uniquePhone());
  await fillMalangAddress(page);
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await page.getByRole("radio", { name: "J&T EZ" }).click();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "Virtual Account BCA" }).click();
  await page.getByRole("button", { name: /Buat Pesanan/ }).click();
  await page.waitForURL(/\/bayar\/RONA-/);
  const number = orderNumberFromUrl(page.url());
  await expect(page.getByTestId("nomor-va")).toBeVisible();
  expect((await stockOf(pick.variantId, "gudang-online")).reserved).toBe(before.reserved + 1);

  try {
    const res = await request.post("/api/demo/jam", { data: { menit: 20 } });
    expect(res.ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pesanan dibatalkan" })).toBeVisible();
  } finally {
    await request.post("/api/demo/jam", { data: { menit: 0 } });
  }
  expect((await orderRow(number)).status).toBe("dibatalkan");
  expect(await stockOf(pick.variantId, "gudang-online")).toEqual(before);
});
