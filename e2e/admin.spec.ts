import { expect, test } from "@playwright/test";
import { addToCart, fillMalangAddress, fillRecipient, loginStaff, orderNumberFromUrl, orderRow, pickVariants, sql, uniquePhone } from "./helpers";

test("tamu membeli dengan kirim; Admin Online melihatnya di dashboard, memproses, input resi; pembeli melihat resinya", async ({ page, browser }) => {
  const [pick] = await pickVariants("gudang-online", ["lumi-cloud-lip-cream", "dayu-gel-pencil-liner"], 3, 1);
  await addToCart(page, pick);
  await page.goto("/checkout");
  await fillRecipient(page, uniquePhone());
  await fillMalangAddress(page);
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await page.getByRole("radio", { name: "JNE REG" }).click();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "QRIS" }).click();
  await page.getByRole("button", { name: /Buat Pesanan/ }).click();
  await page.waitForURL(/\/bayar\/RONA-/);
  const number = orderNumberFromUrl(page.url());
  await page.getByRole("button", { name: "Simulasikan pembayaran berhasil" }).click();
  await page.waitForURL(/\/sukses/);

  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await loginStaff(admin, "Admin Online");
  await expect(admin.getByTestId("pesanan-terbaru").getByText(number)).toBeVisible();
  await admin.goto(`/admin/pesanan/${number}`);
  await admin.getByRole("button", { name: "Proses pesanan" }).click();
  await expect(admin.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Diproses");
  await admin.getByRole("button", { name: "Kirim pesanan" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Kurir").selectOption("JNE");
  await dialog.getByLabel("Nomor resi").fill("JNE9900112233");
  await dialog.getByRole("button", { name: "Kirim pesanan" }).click();
  await expect(admin.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Dikirim");
  await expect(admin.getByTestId("resi")).toHaveText("JNE9900112233");
  expect((await orderRow(number)).status).toBe("dikirim");
  const log = await sql`select 1 from audit_logs where object_id = ${number} and action = 'pesanan.status'`;
  expect(log.length).toBe(2);

  await page.goto(`/pesanan/${number}`);
  await expect(page.getByText("JNE9900112233")).toBeVisible();
  await admin.context().close();
});

test("Ambil di Toko Rona Dinoyo dengan Bayar di Toko: Staf Dinoyo menandai lunas dan diambil; pesanan lokasi lain ditolak", async ({ page, browser }) => {
  const [pick] = await pickVariants("dinoyo", null, 2, 1);
  await addToCart(page, pick);
  await page.goto("/checkout");
  await fillRecipient(page, uniquePhone());
  await page.getByRole("radio", { name: /^Ambil di Toko/ }).click();
  await page.getByRole("radio", { name: "Rona Dinoyo" }).click();
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "Bayar di Toko" }).click();
  await page.getByRole("button", { name: /Buat Pesanan/ }).click();
  await page.waitForURL(/\/pesanan\/RONA-.*\/sukses/);
  const number = orderNumberFromUrl(page.url());

  const staff = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await loginStaff(staff, "Staf Cabang Dinoyo");
  await staff.goto(`/admin/pesanan/${number}`);
  await expect(staff.getByRole("button", { name: "Batalkan pesanan" })).toHaveCount(0);
  await staff.getByRole("button", { name: "Tandai lunas dan sudah diambil" }).click();
  await expect(staff.getByTestId("status-pesanan").filter({ visible: true })).toHaveText("Selesai");
  expect((await orderRow(number)).status).toBe("selesai");

  const [other] = await sql<{ number: string }[]>`select o.number from orders o join locations l on l.id = o.location_id where l.slug <> 'dinoyo' order by o.id desc limit 1`;
  await staff.goto(`/admin/pesanan/${other.number}`);
  await expect(staff.getByTestId("akses-ditolak")).toBeVisible();
  await expect(staff.getByText("di luar lokasi yang kamu ampu")).toBeVisible();
  await staff.context().close();
});

test("Gudang mentransfer stok dari Gudang Online ke Rona Sawojajar: matriks berubah, buku stok berisi dua baris berreferensi sama", async ({ page }) => {
  const [pick] = await pickVariants("gudang-online", ["arunika-hujan-edp", "kirana-lab-caffeine-eye-serum", "nara-men-acne-control-serum"], 5, 1);
  const [v] = await sql<{ sku: string }[]>`select sku from variants where id = ${pick.variantId}`;
  const stock = async (slug: string) => (await sql<{ a: number }[]>`select i.on_hand - i.reserved as a from inventory i join locations l on l.id = i.location_id where i.variant_id = ${pick.variantId} and l.slug = ${slug}`)[0].a;
  const [g0, s0] = [await stock("gudang-online"), await stock("sawojajar")];

  await loginStaff(page, "Gudang");
  await page.goto("/admin/stok/transfer");
  await page.getByLabel("Lokasi asal").selectOption({ label: "Gudang Online" });
  await page.getByLabel("Lokasi tujuan").selectOption({ label: "Rona Sawojajar" });
  await page.getByLabel("Varian baris 1").fill(v.sku);
  await page.getByRole("option", { name: new RegExp(v.sku) }).click();
  await page.getByLabel("Jumlah baris 1").fill("2");
  await page.getByRole("button", { name: "Lanjut ke ringkasan" }).click();
  await expect(page.getByTestId("ringkasan-stok")).toContainText("Gudang Online ke Rona Sawojajar");
  await page.getByRole("button", { name: "Simpan" }).click();
  const reference = (await page.getByTestId("referensi-stok").textContent())?.trim() ?? "";
  expect(reference).toMatch(/^TRF-/);

  expect(await stock("gudang-online")).toBe(g0 - 2);
  expect(await stock("sawojajar")).toBe(s0 + 2);
  await page.goto(`/admin/stok?q=${encodeURIComponent(v.sku)}`);
  await expect(page.locator(`tr[data-varian="${v.sku}"] td[data-lokasi="sawojajar"]`)).toHaveAttribute("data-tersedia", String(s0 + 2));
  await page.goto(`/admin/stok/${pick.variantId}?jenis=transfer`);
  await expect(page.getByTestId("buku-stok").getByText(reference)).toHaveCount(2);
  const rows = await sql<{ quantity: number }[]>`select quantity from stock_movements where reference = ${reference} order by quantity`;
  expect(rows.map((r) => r.quantity)).toEqual([-2, 2]);
});
