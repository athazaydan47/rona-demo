import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAsDemo, loginStaff } from "./helpers";

// Axe (WCAG 2.1 AA) di halaman utama toko dan admin: nol pelanggaran serius atau kritis. Halaman tersembunyi dari
// navigasi sebelumnya (React Activity) dikecualikan karena bukan bagian yang terlihat.
async function noSeriousViolations(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`), label).toEqual([]);
}

const STORE = ["/", "/c/bibir", "/p/pualam-velvet-matte-cushion-spf-50", "/cari?q=cushion", "/keranjang", "/checkout", "/masuk", "/kuis-kulit", "/faq", "/toko", "/tentang-demo", "/halaman-tidak-ada"];
const ADMIN = ["/admin", "/admin/pesanan", "/admin/stok", "/admin/produk", "/admin/laporan", "/admin/pengaturan"];

for (const width of [390, 1440]) {
  test(`axe toko ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of STORE) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noSeriousViolations(page, `${path}@${width}`);
    }
  });
  test(`axe akun ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAsDemo(page);
    for (const path of ["/akun", "/akun/pesanan", "/akun/alamat", "/akun/poin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noSeriousViolations(page, `${path}@${width}`);
    }
  });
  test(`axe admin ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginStaff(page, "Owner");
    for (const path of ADMIN) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noSeriousViolations(page, `${path}@${width}`);
    }
  });
}
