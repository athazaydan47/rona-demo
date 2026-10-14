import { expect, test, type Page } from "@playwright/test";
import { loginStaff, sql } from "./helpers";

// Fase 7B dengan AI_PROVIDER=mock: Asisten Admin, saran transfer menjadi draf, penulis deskripsi, dan Kabar Harian.

async function ask(page: Page, question: string) {
  await page.getByTestId("asisten-sidebar").click();
  const panel = page.getByTestId("panel-asisten");
  await expect(panel).toBeVisible();
  await panel.getByLabel("Pertanyaan untuk Asisten Admin").fill(question);
  await panel.getByRole("button", { name: "Kirim pertanyaan" }).click();
  const answer = panel.getByTestId("jawaban-asisten").last();
  await expect(answer).not.toContainText("Membaca pertanyaanmu", { timeout: 20_000 });
  await expect(answer.locator("p").first()).not.toBeEmpty();
  return { panel, answer };
}

test("Owner bertanya omzet minggu ini, angkanya sama dengan Laporan untuk periode yang sama", async ({ page }) => {
  await loginStaff(page, "Owner");
  const { answer } = await ask(page, "Omzet minggu ini dibanding minggu lalu");
  const text = (await answer.textContent()) ?? "";
  const rupiah = /Omzet minggu ini[^:]*:\s*(Rp\s?[\d.]+)/.exec(text)?.[1];
  expect(rupiah).toBeTruthy();
  await expect(answer).toContainText("sementara");
  await answer.getByTestId("tautan-asisten").filter({ hasText: "Lihat di Laporan" }).click();
  await page.waitForURL(/\/admin\/laporan\?.*periode=kustom/);
  const report = ((await page.getByTestId("laporan-omzet").textContent()) ?? "").replace(/\s/g, "");
  expect(report).toBe(rupiah!.replace(/\s/g, ""));
});

test("Staf Dinoyo: omzet ditolak dengan sopan, stok Dinoyo dijawab", async ({ page }) => {
  await loginStaff(page, "Staf Cabang Dinoyo");
  const { panel, answer } = await ask(page, "Omzet Dinoyo minggu ini berapa?");
  await expect(answer).toContainText(/izin/);
  await expect(answer.getByTestId("tabel-asisten")).toHaveCount(0);
  await panel.getByLabel("Pertanyaan untuk Asisten Admin").fill("Stok Lumi Velvet Matte Lipstick 05 Mawar Tua di sini");
  await panel.getByRole("button", { name: "Kirim pertanyaan" }).click();
  const stock = panel.getByTestId("jawaban-asisten").last();
  const table = stock.getByTestId("tabel-asisten");
  await expect(table).toBeVisible({ timeout: 20_000 });
  await expect(table).toContainText("Rona Dinoyo");
  await expect(table).not.toContainText("Gudang Online");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from ai_logs where door = 'panel' and 'stok_varian' = any(tools) and created_at > now() - interval '2 minutes'`;
  expect(n).toBeGreaterThanOrEqual(1);
});

test("Gudang membuka saran transfer, membuat draf, lalu menyimpan: buku stok bertambah", async ({ page }) => {
  await loginStaff(page, "Gudang");
  await page.goto("/admin/stok");
  const section = page.getByTestId("saran-transfer");
  await expect(section).toBeVisible();
  await section.getByTestId("buat-draf-transfer").first().click();
  await page.waitForURL(/\/admin\/stok\/transfer\?.*draf=/);
  const url = new URL(page.url());
  const [variantId, qty] = (url.searchParams.get("draf") ?? "").split(",")[0].split(":").map(Number);
  await expect(page.getByTestId("draf-transfer")).toContainText("Draf dari saran transfer");
  await expect(page.getByLabel("Jumlah baris 1")).toHaveValue(String(qty));
  const before = await sql<{ n: number }[]>`select count(*)::int as n from stock_movements where variant_id = ${variantId} and type = 'transfer'`;
  await page.getByRole("button", { name: "Lanjut ke ringkasan" }).click();
  await page.getByRole("button", { name: "Simpan" }).click();
  const reference = ((await page.getByTestId("referensi-stok").textContent()) ?? "").trim();
  expect(reference).toMatch(/^TRF-/);
  const rows = await sql<{ quantity: number }[]>`select quantity from stock_movements where reference = ${reference} order by quantity`;
  expect(rows.map((r) => r.quantity)).toEqual([-qty, qty]);
  const after = await sql<{ n: number }[]>`select count(*)::int as n from stock_movements where variant_id = ${variantId} and type = 'transfer'`;
  expect(after[0].n).toBe(before[0].n + 2);
});

test("Admin memakai penulis deskripsi, menerima satu kolom, lalu menyimpan", async ({ page }) => {
  const [p] = await sql<{ id: number; short: string }[]>`select id, short_description as short from products where slug = 'teduh-calming-centella-toner'`;
  await loginStaff(page, "Admin Online");
  await page.goto(`/admin/produk/${p.id}`);
  await page.getByRole("tab", { name: "Deskripsi" }).click();
  const writer = page.getByTestId("penulis-ai");
  await writer.getByRole("button", { name: /Bantu tulis dengan AI/ }).click();
  await writer.getByLabel("Poin acuan").fill("- menenangkan kulit yang mudah merah\n- tanpa alkohol");
  await writer.getByTestId("buat-usulan").click();
  const proposal = writer.getByTestId("usulan-ringkas");
  await expect(proposal).toBeVisible({ timeout: 20_000 });
  const proposed = ((await proposal.getByTestId("teks-usulan").textContent()) ?? "").trim();
  expect(proposed.length).toBeGreaterThan(20);
  await writer.getByTestId("terima-ringkas").click();
  await expect(writer.getByTestId("terima-ringkas")).toContainText("Diterima");
  await page.getByRole("button", { name: "Simpan produk" }).click();
  await expect(page.getByText("Produk tersimpan.")).toBeVisible({ timeout: 15_000 });
  const [after] = await sql<{ short: string }[]>`select short_description as short from products where id = ${p.id}`;
  expect(after.short).toBe(proposed);
  await sql`update products set short_description = ${p.short} where id = ${p.id}`;
});

test("Kabar Harian tampil di halaman Owner dengan pratinjau WA dan tombol salin", async ({ page }) => {
  await loginStaff(page, "Owner");
  await page.goto("/admin/kabar");
  await expect(page.getByTestId("kabar-hari")).toHaveCount(14);
  const bubble = page.getByTestId("gelembung-wa");
  await expect(bubble).toContainText("Kabar Harian Rona Beauty");
  await expect(bubble).toContainText("Omzet:");
  await expect(page.getByTestId("salin-wa")).toBeVisible();
});
