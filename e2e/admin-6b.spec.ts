import { expect, test, type Browser, type Page } from "@playwright/test";
import { addToCart, DEMO_PHONE, fillMalangAddress, fillRecipient, loginAsDemo, loginStaff, pickVariants, sql, uniquePhone } from "./helpers";

const rupiah = (n: number) => new RegExp(`Rp\\s${n.toLocaleString("id-ID").replace(/\./g, "\\.")}(?!\\d)`);
const uid = () => Date.now().toString(36).toUpperCase().slice(-6);

async function staffPage(browser: Browser, label: Parameters<typeof loginStaff>[1], kembali: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginStaff(page, label, kembali);
  return page;
}

async function goToPayment(page: Page) {
  await page.goto("/checkout");
  await fillRecipient(page, uniquePhone());
  await fillMalangAddress(page);
  await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
  await page.getByRole("radio", { name: "JNE REG" }).click();
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
  await page.getByRole("radio", { name: "QRIS" }).click();
}

test("Admin Online membuat produk 2 shade: habis di toko; pembeli minta dikabari; Gudang stok masuk; pembeli dapat notifikasi", async ({ page, browser }) => {
  const id = uid();
  const name = `Lip Tint Uji ${id}`;
  const slug = `lip-tint-uji-${id.toLowerCase()}`;
  const [leaf] = await sql<{ name: string }[]>`select c.name from categories c join categories p on p.id = c.parent_id order by c.sort_order limit 1`;

  const admin = await staffPage(browser, "Admin Online", "/admin/produk/baru");
  await admin.getByLabel("Nama produk").fill(name);
  await admin.getByLabel(/^Kategori/).selectOption({ label: leaf.name });
  await admin.getByRole("tab", { name: "Varian" }).click();
  if (!(await admin.getByLabel("Nama shade varian 1").isVisible())) await admin.getByRole("button", { name: "Tambah varian" }).click();
  await admin.getByLabel("Nama shade varian 1").fill("Merah Bata");
  await admin.getByLabel("Kode hex varian 1").fill("#B5523B");
  await admin.getByLabel("SKU varian 1").fill(`UJI-${id}-01`);
  await admin.getByLabel("Harga normal varian 1").fill("89000");
  await admin.getByLabel("Harga jual varian 1").fill("79000");
  await admin.getByRole("button", { name: "Tambah varian" }).click();
  await admin.getByLabel("Nama shade varian 2").fill("Mawar Pudar");
  await admin.getByLabel("Kode hex varian 2").fill("#C7697A");
  await admin.getByLabel("SKU varian 2").fill(`UJI-${id}-02`);
  await admin.getByLabel("Harga normal varian 2").fill("89000");
  await admin.getByLabel("Harga jual varian 2").fill("89000");
  await expect(admin.getByTestId("pratinjau-productart")).toBeVisible();
  await admin.getByRole("tab", { name: /SEO/ }).click();
  await admin.getByRole("radio", { name: /^aktif/i }).click();
  await admin.getByRole("button", { name: "Simpan produk" }).click();
  await admin.waitForURL(/\/admin\/produk\/\d+/);

  const [p] = await sql<{ id: number; slug: string }[]>`select id, slug from products where name = ${name}`;
  expect(p.slug).toBe(slug);
  const variants = await sql<{ id: number; sku: string }[]>`select id, sku from variants where product_id = ${p.id} order by sort_order`;
  expect(variants.map((v) => v.sku)).toEqual([`UJI-${id}-01`, `UJI-${id}-02`]);
  const [{ n, total }] = await sql<{ n: number; total: number }[]>`select count(*)::int as n, coalesce(sum(on_hand), 0)::int as total from inventory where variant_id in ${sql(variants.map((v) => v.id))}`;
  expect(n).toBeGreaterThanOrEqual(8);
  expect(total).toBe(0);

  // Pembeli melihat produk habis dan minta dikabari.
  await loginAsDemo(page, `/p/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: "Kabari aku saat tersedia" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Kabari aku", exact: true }).click();
  await expect(page.getByText("Siap, kami kabari")).toBeVisible();

  // Gudang mencatat stok masuk di Gudang Online.
  const gudang = await staffPage(browser, "Gudang", "/admin/stok/masuk");
  await gudang.getByLabel("Lokasi tujuan").selectOption({ label: "Gudang Online" });
  await gudang.getByLabel("Varian baris 1").fill(`UJI-${id}-01`);
  await gudang.getByRole("option", { name: new RegExp(`UJI-${id}-01`) }).click();
  await gudang.getByLabel("Jumlah baris 1").fill("6");
  await gudang.getByRole("button", { name: "Lanjut ke ringkasan" }).click();
  await gudang.getByRole("button", { name: "Simpan" }).click();
  await expect(gudang.getByTestId("referensi-stok")).toHaveText(/^MSK-|^IN-|\S+/);

  const [notif] = await sql<{ n: number }[]>`select count(*)::int as n from notifications nt join customers c on c.id = nt.customer_id where c.phone = ${DEMO_PHONE} and nt.body like ${`%${name}%`}`;
  expect(notif.n).toBeGreaterThanOrEqual(1);
  await page.goto("/akun/notifikasi");
  await expect(page.getByText(new RegExp(name)).first()).toBeVisible();
});

test("Owner membuat slot flash; dengan jam dimajukan, harga flash tampil di halaman produk dan checkout", async ({ page, browser, request }) => {
  await sql`delete from flash_sale_items where flash_sale_id in (select id from flash_sales where name = 'Flash Uji E2E')`;
  await sql`delete from flash_sales where name = 'Flash Uji E2E'`;
  const [v] = await sql<{ id: number; sku: string; sale_price: number; product_slug: string; shade_slug: string }[]>`
    select v.id, v.sku, v.sale_price, p.slug as product_slug, v.shade_slug
    from variants v join products p on p.id = v.product_id join inventory i on i.variant_id = v.id join locations l on l.id = i.location_id
    where l.slug = 'gudang-online' and i.on_hand - i.reserved >= 5 and v.is_active and p.status = 'aktif' and v.promo_price is null and v.sale_price >= 60000
      and not exists (select 1 from flash_sale_items fi where fi.variant_id = v.id)
    order by v.id limit 1`;
  const flashPrice = Math.floor((v.sale_price * 0.7) / 1000) * 1000;

  const owner = await staffPage(browser, "Owner", "/admin/promo");
  await owner.getByLabel("Nama slot").fill("Flash Uji E2E");
  await owner.getByRole("button", { name: "Atur sendiri" }).click();
  await owner.getByLabel("Jam mulai").fill("09:00");
  await owner.getByLabel("Jam selesai").fill("10:30");
  await owner.getByRole("button", { name: "Buat slot" }).click();
  await expect(owner.getByText("Slot dibuat.")).toBeVisible();
  const detail = owner.getByTestId("detail-slot");
  await expect(detail).toContainText("Flash Uji E2E");
  await detail.getByLabel("Cari varian promo").fill(v.sku);
  await owner.getByRole("option").filter({ hasText: /./ }).first().click();
  await detail.getByLabel("Harga flash").fill(String(flashPrice));
  await expect(owner.getByTestId("pratinjau-flash")).toContainText(/-\d+%/);
  await owner.getByRole("button", { name: "Simpan item" }).click();
  await expect(owner.getByText(/Item slot tersimpan/)).toBeVisible();

  const [slot] = await sql<{ starts_at: Date }[]>`select starts_at from flash_sales where name = 'Flash Uji E2E' and source = 'admin'`;
  const minutes = Math.ceil((slot.starts_at.getTime() - Date.now()) / 60_000) + 5;
  try {
    expect((await request.post("/api/demo/jam", { data: { menit: minutes } })).ok()).toBe(true);
    await page.goto(`/p/${v.product_slug}?shade=${v.shade_slug}`);
    await expect(page.getByTestId("harga-produk").first()).toContainText(rupiah(flashPrice));
    await addToCart(page, { productSlug: v.product_slug, shadeSlug: v.shade_slug, variantId: v.id });
    await goToPayment(page);
    await expect(page.getByText(rupiah(flashPrice)).first()).toBeVisible();
  } finally {
    await request.post("/api/demo/jam", { data: { menit: 0 } });
  }
});

test("Owner membuat voucher, pembeli memakainya di checkout", async ({ page, browser }) => {
  const code = `UJI${uid()}`;
  const owner = await staffPage(browser, "Owner", "/admin/promo?tab=voucher");
  await owner.getByRole("button", { name: "Buat voucher" }).click();
  await owner.getByLabel("Kode voucher").fill(code);
  await owner.getByLabel("Judul voucher").fill("Voucher uji E2E");
  await owner.getByLabel("Nilai voucher").fill("15000");
  await owner.getByLabel("Minimal belanja").fill("50000");
  await owner.getByRole("button", { name: "Simpan voucher" }).click();
  await expect(owner.getByTestId("tabel-voucher")).toContainText(code);

  const [pick] = await pickVariants("gudang-online", null, 3, 1);
  await addToCart(page, pick);
  await goToPayment(page);
  await page.getByLabel("Kode voucher").fill(code);
  await page.getByRole("button", { name: "Pakai" }).click();
  await expect(page.getByText(/Voucher terpasang, hemat Rp\s15\.000/)).toBeVisible();
});

test("Owner mengubah batas gratis ongkir, bilah progres di keranjang ikut berubah", async ({ page, browser }) => {
  const [v] = await sql<{ id: number; product_slug: string; shade_slug: string; sale_price: number }[]>`
    select v.id, p.slug as product_slug, v.shade_slug, v.sale_price
    from variants v join products p on p.id = v.product_id join inventory i on i.variant_id = v.id join locations l on l.id = i.location_id
    where l.slug = 'gudang-online' and i.on_hand - i.reserved >= 3 and v.is_active and p.status = 'aktif' and v.promo_price is null
      and v.sale_price between 40000 and 120000
      and not exists (select 1 from flash_sale_items fi join flash_sales f on f.id = fi.flash_sale_id where fi.variant_id = v.id and f.is_active and f.starts_at <= now() and f.ends_at > now())
    order by v.id limit 1`;
  await addToCart(page, { productSlug: v.product_slug, shadeSlug: v.shade_slug, variantId: v.id });
  await page.goto("/keranjang");
  const bar = page.getByTestId("bilah-gratis-ongkir");
  await expect(bar).toContainText(rupiah(150_000 - v.sale_price));

  const owner = await staffPage(browser, "Owner", "/admin/pengaturan");
  const setThreshold = async (value: number) => {
    await owner.getByLabel("Batas gratis ongkir").fill(String(value));
    await owner.getByRole("button", { name: "Simpan pengaturan" }).click();
    await expect(owner.getByText(/Pengaturan tersimpan/)).toBeVisible();
  };
  try {
    await setThreshold(300_000);
    await page.reload();
    await expect(bar).toContainText(rupiah(300_000 - v.sale_price));
    await expect(page.getByRole("progressbar", { name: "Progres gratis ongkir" })).toHaveAttribute("aria-valuenow", String(Math.round((v.sale_price / 300_000) * 100)));
  } finally {
    await owner.reload();
    await setThreshold(150_000);
  }
  await page.reload();
  await expect(bar).toContainText(rupiah(150_000 - v.sale_price));
});
