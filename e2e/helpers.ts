import { config } from "dotenv";
import postgres from "postgres";
import { expect, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });
// DATABASE_URL di sini sudah diarahkan ke <database kerja>_e2e oleh playwright.config.ts (Fase 8B).
if (!/_e2e(\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("Uji E2E harus memakai database _e2e. Jalankan lewat npx playwright test.");

// Satu koneksi bersama untuk semua berkas uji di worker yang sama; ditutup otomatis saat menganggur
// (jangan panggil sql.end() di afterAll, karena berkas uji berikutnya masih memakainya).
export const sql = postgres(process.env.DATABASE_URL ?? "", { max: 2, idle_timeout: 2, onnotice: () => {} });

export type Pick = { productSlug: string; shadeSlug: string; variantId: number };

// Varian aktif dengan stok tersedia minimal `min` di lokasi tertentu.
export async function pickVariants(locationSlug: string, productSlugs: string[] | null, min: number, count = 1): Promise<Pick[]> {
  const rows = await sql<{ product_slug: string; shade_slug: string; variant_id: number }[]>`
    select p.slug as product_slug, v.shade_slug, v.id as variant_id
    from variants v
    join products p on p.id = v.product_id
    join inventory i on i.variant_id = v.id
    join locations l on l.id = i.location_id
    where l.slug = ${locationSlug} and v.is_active and p.status = 'aktif'
      and i.on_hand - i.reserved >= ${min}
      ${productSlugs ? sql`and p.slug in ${sql(productSlugs)}` : sql``}
    order by p.slug, v.sort_order`;
  const out: Pick[] = [];
  for (const r of rows) {
    if (out.some((o) => o.productSlug === r.product_slug)) continue;
    out.push({ productSlug: r.product_slug, shadeSlug: r.shade_slug, variantId: r.variant_id });
    if (out.length >= count) break;
  }
  if (out.length < count) throw new Error(`Tidak cukup varian dengan stok di ${locationSlug}`);
  return out;
}

export async function stockOf(variantId: number, locationSlug: string) {
  const [r] = await sql<{ on_hand: number; reserved: number }[]>`
    select i.on_hand, i.reserved from inventory i join locations l on l.id = i.location_id
    where i.variant_id = ${variantId} and l.slug = ${locationSlug}`;
  return { onHand: r.on_hand, reserved: r.reserved };
}

export async function orderRow(number: string) {
  const [r] = await sql<{ status: string; voucher_code: string | null; total: number; method: string }[]>`
    select status, voucher_code, total, method from orders where number = ${number}`;
  return r;
}

export function uniquePhone() {
  return `0813${String(Date.now()).slice(-8)}`;
}

export async function addToCart(page: Page, pick: Pick) {
  await page.goto(`/p/${pick.productSlug}?shade=${pick.shadeSlug}`);
  // WebKit: tombol sudah ada sebelum hidrasi; tunggu jaringan tenang supaya klik tidak hilang.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah ke Keranjang", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: /Keranjang/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Checkout" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
}

export async function fillRecipient(page: Page, phone: string) {
  await page.getByLabel("Nama penerima").fill("Pembeli Uji E2E");
  await page.getByLabel("Nomor WhatsApp").fill(phone);
}

export async function fillMalangAddress(page: Page) {
  await page.getByLabel("Provinsi").selectOption("35");
  await page.getByLabel("Kota atau kabupaten").selectOption("35.73");
  await page.getByLabel("Kecamatan").selectOption({ label: "Lowokwaru" });
  await page.getByLabel("Kode pos").fill("65145");
  await page.getByLabel("Alamat lengkap").fill("Jl. Sumbersari Gg. 4 No. 12, RT 03 RW 05");
}

export function orderNumberFromUrl(url: string) {
  const m = /(RONA-\d{4}-\d{6})/.exec(url);
  if (!m) throw new Error(`Nomor pesanan tidak ada di URL ${url}`);
  return m[1];
}

export const DEMO_PHONE = "080000000001";

export async function demoCustomer() {
  const [c] = await sql<{ id: number; points: number }[]>`select id, points from customers where phone = ${DEMO_PHONE}`;
  return c;
}

// Fixture uji: Pembeli Demo belum pernah mengulas (ulasan dan bonus ulasan pertama dari putaran uji sebelumnya dihapus,
// saldo poin dikurangi sebesar bonus yang dihapus supaya tetap sama dengan ledger, rating produk dihitung ulang).
export async function resetDemoReviews() {
  const c = await demoCustomer();
  await sql.begin(async (tx) => {
    const products = await tx<{ product_id: number }[]>`delete from reviews where customer_id = ${c.id} returning product_id`;
    const bonus = await tx<{ amount: number }[]>`delete from points_ledger where idempotency_key = ${`bonus-ulasan-pertama:${c.id}`} returning amount`;
    const total = bonus.reduce((s, b) => s + b.amount, 0);
    if (total) await tx`update customers set points = points - ${total} where id = ${c.id}`;
    for (const pid of new Set(products.map((p) => p.product_id))) {
      await tx`update products set rating_avg = coalesce((select round(avg(rating)::numeric, 1) from reviews where product_id = ${pid} and status = 'tampil'), 0), review_count = (select count(*) from reviews where product_id = ${pid} and status = 'tampil') where id = ${pid}`;
    }
  });
}

export async function loginAsDemo(page: Page, kembali = "/akun") {
  await page.goto(`/masuk?kembali=${encodeURIComponent(kembali)}`);
  await page.getByRole("button", { name: "Masuk sebagai Pembeli Demo" }).click();
  await page.waitForURL((url) => url.pathname === kembali.split("?")[0]);
  await page.waitForLoadState("load");
}

export async function loginStaff(page: Page, label: "Owner" | "Admin Online" | "Staf Cabang Dinoyo" | "Gudang", kembali = "/admin") {
  await page.goto(`/admin/masuk?kembali=${encodeURIComponent(kembali)}`);
  await page.getByRole("button", { name: label, exact: true }).click();
  // WebKit kadang melaporkan "Frame load interrupted" saat location.assign menyusul navigasi aksi server; tunggu sekali lagi.
  const target = (u: URL) => u.pathname === kembali.split("?")[0];
  try {
    await page.waitForURL(target);
  } catch {
    await page.waitForURL(target);
  }
  // Pengalihan penuh masih berjalan saat URL berubah; tunggu selesai supaya goto berikutnya tidak terputus.
  await page.waitForLoadState("load");
}
