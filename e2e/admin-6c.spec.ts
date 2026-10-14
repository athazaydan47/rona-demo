import path from "node:path";
import ExcelJS from "exceljs";
import { expect, test, type Browser } from "@playwright/test";
import { loginStaff, sql } from "./helpers";

async function staffPage(browser: Browser, label: Parameters<typeof loginStaff>[1], kembali: string) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await loginStaff(page, label, kembali);
  return page;
}

const ratingLabel = (avg: number, count: number) => `${avg.toFixed(1).replace(".", ",")} dari 5, ${count} ulasan`;

test("Admin Online menyembunyikan ulasan dan rating produk berubah; Owner membalas ulasan lain dan balasannya tampil", async ({ page, browser }) => {
  // Produk dengan beberapa ulasan tayang dan rating yang pasti berubah bila satu ulasan bintang tertinggi disembunyikan.
  const [p] = await sql<{ id: number; slug: string; name: string }[]>`
    select p.id, p.slug, p.name from products p
    where p.status = 'aktif' and (select count(*) from reviews r where r.product_id = p.id and r.status = 'tampil' and r.store_reply is null) >= 2
      and (select count(distinct rating) from reviews r where r.product_id = p.id and r.status = 'tampil') >= 2
    order by p.id limit 1`;
  const reviews = await sql<{ id: number; rating: number }[]>`select id, rating from reviews where product_id = ${p.id} and status = 'tampil' and store_reply is null order by rating desc, id`;
  const [target, other] = reviews;
  const [{ avg, n }] = await sql<{ avg: number; n: number }[]>`select rating_avg as avg, review_count as n from products where id = ${p.id}`;

  await page.goto(`/p/${p.slug}`);
  await expect(page.getByRole("img", { name: ratingLabel(Number(avg), Number(n)) }).first()).toBeVisible();

  const admin = await staffPage(browser, "Admin Online", `/admin/ulasan`);
  await admin.goto(`/admin/ulasan?produk=${encodeURIComponent(p.name)}`);
  const card = admin.locator(`[data-ulasan="${target.id}"]`);
  await card.getByRole("button", { name: "Sembunyikan" }).click();
  const dialog = admin.getByRole("alertdialog").or(admin.getByRole("dialog"));
  await dialog.getByLabel("Alasan").fill("Berisi informasi yang menyesatkan");
  await dialog.getByRole("button", { name: "Sembunyikan" }).click();
  await expect(admin.getByText(/1 ulasan disembunyikan/)).toBeVisible();

  const [{ avg: avg2, n: n2 }] = await sql<{ avg: number; n: number }[]>`select rating_avg as avg, review_count as n from products where id = ${p.id}`;
  expect(Number(n2)).toBe(Number(n) - 1);
  await page.reload();
  await expect(page.getByRole("img", { name: ratingLabel(Number(avg2), Number(n2)) }).first()).toBeVisible();

  const owner = await staffPage(browser, "Owner", `/admin/ulasan`);
  await owner.goto(`/admin/ulasan?produk=${encodeURIComponent(p.name)}`);
  await owner.locator(`[data-ulasan="${other.id}"]`).getByRole("button", { name: "Balas" }).click();
  const reply = `Terima kasih sudah berbagi, Kak. Balasan uji ${Date.now()}.`;
  await owner.getByTestId("dialog-balas").getByLabel("Isi balasan").fill(reply);
  await owner.getByRole("button", { name: "Simpan balasan" }).click();
  await expect(owner.getByText(/Balasan tersimpan/)).toBeVisible();

  await page.reload();
  await expect(page.getByText("Balasan Rona Beauty").first()).toBeVisible();
  await expect(page.getByText(reply)).toBeVisible();
});

test("Owner membuka Laporan 30 hari lalu mengunduh Excel dengan sheet yang benar", async ({ browser }, testInfo) => {
  const owner = await staffPage(browser, "Owner", "/admin/laporan");
  await owner.goto("/admin/laporan?periode=30_hari");
  await expect(owner.getByTestId("ringkasan-laporan")).toBeVisible();
  const shown = (await owner.getByTestId("laporan-omzet").textContent())?.replace(/\D/g, "") ?? "";
  const [download] = await Promise.all([owner.waitForEvent("download"), owner.getByTestId("unduh-excel").click()]);
  expect(download.suggestedFilename()).toMatch(/^laporan-rona-\d{8}-\d{8}\.xlsx$/);
  const file = path.join(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Harian", "Per Merek", "Per Kategori", "Per Cabang", "Per Kanal", "Produk", "Voucher", "Detail Pesanan", "Detail Item"]);
  const ringkasan = wb.getWorksheet("Ringkasan")!;
  let omzet: unknown = null;
  ringkasan.eachRow((row) => {
    if (row.getCell(1).value === "Omzet") omzet = row.getCell(2).value;
  });
  expect(typeof omzet).toBe("number");
  expect(String(omzet)).toBe(shown);
});

test("dari detail pesanan buka detail pelanggan; staf tanpa izin kontak melihat nomor tersamar", async ({ browser }) => {
  const [o] = await sql<{ number: string; customer_id: number; phone: string }[]>`
    select o.number, o.customer_id, c.phone from orders o join customers c on c.id = o.customer_id
    where o.method = 'kirim' order by o.id desc limit 1`;
  const [admin] = await sql<{ id: number }[]>`select id from staff where email = 'admin@rona.demo'`;
  await sql`delete from permissions where staff_id = ${admin.id} and key = 'pelanggan.kontak'`;
  await sql`insert into permissions (staff_id, key, allowed) values (${admin.id}, 'pelanggan.kontak', false)`;
  try {
    const page = await staffPage(browser, "Admin Online", `/admin/pesanan/${o.number}`);
    await page.getByTestId("tautan-pelanggan").click();
    await page.waitForURL(new RegExp(`/admin/pelanggan/${o.customer_id}$`));
    const shown = page.getByTestId("kontak-wa");
    await expect(shown).toContainText("••••");
    await expect(shown).not.toContainText(o.phone);
    await expect(page.getByRole("link", { name: /Hubungi via WA/ })).toHaveCount(0);

    const owner = await staffPage(browser, "Owner", `/admin/pelanggan/${o.customer_id}`);
    await expect(owner.getByTestId("kontak-wa")).toHaveText(o.phone);
    await expect(owner.getByRole("link", { name: /Hubungi via WA/ })).toBeVisible();
  } finally {
    await sql`delete from permissions where staff_id = ${admin.id} and key = 'pelanggan.kontak'`;
  }
});
