import { expect, test } from "@playwright/test";
import { fillMalangAddress, fillRecipient, orderNumberFromUrl, sql, uniquePhone } from "./helpers";

// Server utama memakai AI_PROVIDER=mock. Server tanpa AI ada di port 3212 (lihat playwright.config.ts).
const NO_AI = "http://localhost:3212";

test("Advisor merekomendasikan sunscreen, tambah ke keranjang, item tercatat bersumber Advisor sampai pesanan", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("tombol-advisor").click();
  const panel = page.getByTestId("panel-advisor");
  await expect(panel.getByText("Jawaban AI bisa keliru")).toBeVisible();
  await panel.getByLabel("Pesan untuk Rona Advisor").fill("Sunscreen untuk kulit berminyak di bawah 100 ribu");
  await panel.getByRole("button", { name: "Kirim" }).click();
  const card = panel.getByTestId("kartu-advisor").first();
  await expect(card).toBeVisible();
  await expect(panel.getByTestId("jawaban-advisor").last()).toContainText("Surya Shield");
  const name = (await card.locator("a").nth(1).textContent())?.trim() ?? "";
  await card.getByRole("button", { name: "Tambah" }).click();
  await expect(card.getByText("Masuk keranjang")).toBeVisible();
  await page.keyboard.press("Escape");

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
  const items = await sql<{ product_name: string; source: string | null }[]>`select oi.product_name, oi.source from order_items oi join orders o on o.id = oi.order_id where o.number = ${number}`;
  expect(items).toEqual([{ product_name: name, source: "advisor" }]);
});

test("pencarian kalimat menampilkan chip tafsiran; hapus satu chip dan hasilnya berubah", async ({ page }) => {
  await page.goto(`/cari?q=${encodeURIComponent("lipstik yang ga bikin bibir kering buat kondangan")}`);
  const chips = page.getByTestId("chip-tafsiran");
  await expect(chips).toContainText("Kami artikan sebagai:");
  await expect(chips).toContainText("Lipstick");
  await expect(chips).toContainText("Satin");
  await expect(chips).toContainText("Melembapkan");
  await expect(page.getByTestId("tafsiran-ai").getByRole("link", { name: "cari kata persis saja" })).toBeVisible();
  await expect(page.getByText(/^1 produk/).first()).toBeVisible();

  // Hapus chip kategori: tafsiran lain tetap berlaku dan hasilnya bertambah.
  await page.goto(`/cari?q=${encodeURIComponent("sunscreen yang ga lengket buat kulit berminyak")}`);
  await expect(chips).toContainText("Sunscreen Wajah");
  const count = page.getByText(/^\d+ produk/).first();
  await expect(count).toHaveText(/^2 produk/);
  await chips.getByRole("button", { name: "Hapus filter Sunscreen Wajah", exact: true }).click();
  await expect(chips).not.toContainText("Sunscreen Wajah");
  await expect(count).toHaveText(/^4 produk/);
  expect(page.url()).toContain("tafsir=1");
});

test("kuis kulit sampai rutinitas, lalu Tambah semua ke keranjang", async ({ page }) => {
  await page.goto("/kuis-kulit");
  const quiz = page.getByTestId("kuis-kulit");
  await quiz.getByTestId("kulit-berminyak").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("masalah-jerawat").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("sensitif-rendah").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("budget-150000").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("kedalaman-3").click();
  await quiz.getByTestId("undertone-warm").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("rutin-dasar").click();
  await quiz.getByRole("button", { name: "Lihat rutinitasku" }).click();
  await page.waitForURL(/\/rutinitas$/);
  await expect(page.getByTestId("langkah-rutinitas")).toHaveCount(10);
  await expect(page.getByTestId("peringatan-bahan")).toContainText("sunscreen");
  await expect(page.getByTestId("penjelasan-ai")).toBeVisible();
  await page.getByTestId("tambah-semua").click();
  const drawer = page.getByRole("dialog", { name: /Keranjang/ });
  await expect(drawer).toBeVisible();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from cart_items where source = 'rutinitas' and created_at > now() - interval '2 minutes'`;
  expect(n).toBeGreaterThanOrEqual(5);
});

test("padanan shade menampilkan 3 hasil, juga dari dialog di halaman produk", async ({ page }) => {
  await page.goto("/padanan-shade");
  await page.getByRole("button", { name: "Cari padanan" }).click();
  await expect(page.getByTestId("hasil-padanan").locator("li")).toHaveCount(3);

  const [p] = await sql<{ slug: string }[]>`select p.slug from products p join categories c on c.id = p.category_id where c.slug = 'cushion' and p.status = 'aktif' order by p.id limit 1`;
  await page.goto(`/p/${p.slug}`);
  await page.getByTestId("tombol-padanan").click();
  const dialog = page.getByRole("dialog", { name: "Cari padanan shade" });
  await dialog.getByRole("button", { name: "Cari padanan" }).click();
  await expect(dialog.getByTestId("hasil-padanan").locator("li")).toHaveCount(3);
});

test("tanpa env AI: tombol Advisor dan chip tafsiran tidak tampil, kuis, rutinitas, dan pencarian biasa tetap jalan", async ({ page }) => {
  await page.goto(`${NO_AI}/`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("tombol-advisor")).toHaveCount(0);
  const status = await page.request.get(`${NO_AI}/api/ai/advisor`);
  expect(status.status()).toBe(404);

  await page.goto(`${NO_AI}/cari?q=${encodeURIComponent("lipstik yang ga bikin bibir kering buat kondangan")}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hasil untuk");
  await expect(page.getByTestId("chip-tafsiran")).toHaveCount(0);
  await page.goto(`${NO_AI}/cari?q=cushion`);
  await expect(page.getByText(/^\d+ produk/).first()).toBeVisible();

  await page.goto(`${NO_AI}/kuis-kulit`);
  const quiz = page.getByTestId("kuis-kulit");
  await quiz.getByTestId("kulit-kering").click();
  for (const id of [null, null, "sensitif-sedang", "budget-75000"]) {
    if (id) await quiz.getByTestId(id).click();
    await quiz.getByRole("button", { name: /Lanjut|Lewati/ }).click();
  }
  await quiz.getByTestId("kedalaman-2").click();
  await quiz.getByTestId("undertone-cool").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("rutin-belum").click();
  await quiz.getByRole("button", { name: "Lihat rutinitasku" }).click();
  await page.waitForURL(/\/rutinitas$/);
  await expect(page.getByTestId("langkah-rutinitas").first()).toBeVisible();
  await expect(page.getByTestId("penjelasan-ai")).toHaveCount(0);

  await page.goto(`${NO_AI}/padanan-shade`);
  await page.getByRole("button", { name: "Cari padanan" }).click();
  await expect(page.getByTestId("hasil-padanan").locator("li")).toHaveCount(3);
  await expect(page.getByLabel("Ceritakan shade yang kamu pakai")).toHaveCount(0);
});
