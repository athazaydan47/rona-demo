import path from "node:path";
import { expect, test } from "@playwright/test";
import { sql } from "./helpers";

// Fase 7C dengan AI_PROVIDER=mock: kuis dibantu foto, kuis isi sendiri, cari dupe dari link TikTok tiruan (oEmbed
// mock) dan dari screenshot ProductArt. Gambar uji dari evals/7c/gambar (sintetis, bukan foto orang sungguhan).
const NO_AI = "http://localhost:3212";
const gambar = (f: string) => path.join(process.cwd(), "evals/7c/gambar", f);

test("kuis: Bantu isi dari foto, jawaban terisi bertanda, konfirmasi tiap langkah, lalu rutinitas", async ({ page }) => {
  await page.goto("/kuis-kulit");
  const quiz = page.getByTestId("kuis-kulit");
  const choice = quiz.getByTestId("pilihan-isi-kuis");
  await expect(choice.getByRole("button", { name: /Isi sendiri/ })).toHaveAttribute("aria-pressed", "true");
  await expect(choice).toContainText("Bantu isi dari foto (opsional)");
  await quiz.getByTestId("bantu-foto").click();

  const consent = quiz.getByTestId("persetujuan-foto");
  await expect(consent).toContainText("Foto tidak disimpan dan langsung dibuang setelah diproses.");
  await expect(consent).toContainText("Ini bukan pemeriksaan medis.");
  await expect(consent.getByRole("link", { name: /kebijakan privasi/ })).toHaveAttribute("href", "/kebijakan/privasi#foto");
  const next = consent.getByRole("button", { name: "Lanjut pilih foto" });
  await expect(next).toBeDisabled();
  await consent.getByTestId("setuju-foto").check();
  await next.click();

  await quiz.getByTestId("input-galeri").setInputFiles(gambar("wajah-ilustrasi.jpg"));
  await expect(quiz.getByTestId("info-dari-foto")).toBeVisible();
  // Jawaban usulan bertanda "dari foto"; pembeli tetap menekan Lanjut di setiap langkah.
  await expect(quiz.getByTestId("kulit-berminyak")).toHaveAttribute("aria-pressed", "true");
  await expect(quiz.getByTestId("kulit-berminyak").getByTestId("dari-foto")).toBeVisible();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await expect(quiz.getByTestId("masalah-jerawat")).toHaveAttribute("aria-pressed", "true");
  await expect(quiz.getByTestId("masalah-jerawat").getByTestId("dari-foto")).toBeVisible();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("sensitif-rendah").click(); // sensitivitas tidak pernah diisi dari foto
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("budget-150000").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await expect(quiz.getByTestId("kedalaman-4")).toHaveAttribute("aria-pressed", "true");
  // Undertone berkeyakinan rendah di foto: tidak diisi otomatis, pembeli memilih sendiri.
  for (const u of ["warm", "neutral", "cool"]) await expect(quiz.getByTestId(`undertone-${u}`)).toHaveAttribute("aria-pressed", "false");
  await expect(quiz.getByRole("button", { name: /Lanjut/ })).toBeDisabled();
  await quiz.getByTestId("undertone-warm").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("rutin-dasar").click();
  await quiz.getByRole("button", { name: "Lihat rutinitasku" }).click();
  await page.waitForURL(/\/rutinitas$/);
  await expect(page.getByText(/Untuk kulit berminyak, fokus jerawat/)).toBeVisible();
  await expect(page.getByTestId("langkah-rutinitas").first()).toBeVisible();
  // Profil dari foto berbentuk sama dengan hasil kuis manual (cookie tamu).
  const cookie = (await page.context().cookies()).find((c) => c.name === "rona_profil_kulit");
  const profile = JSON.parse(Buffer.from(cookie!.value, "base64url").toString("utf8"));
  expect(profile).toMatchObject({ skinType: "berminyak", concerns: ["jerawat"], sensitivity: "rendah", budget: 150000, depth: 4, undertone: "warm", routine: "dasar", source: "kuis" });
});

test("kuis: Isi sendiri tetap jalan seperti sebelumnya tanpa menyentuh foto", async ({ page }) => {
  let photoCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/ai/foto-kulit")) photoCalls++;
  });
  await page.goto("/kuis-kulit");
  const quiz = page.getByTestId("kuis-kulit");
  await quiz.getByTestId("kulit-kering").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByRole("button", { name: /Lewati/ }).click();
  await quiz.getByTestId("sensitif-sedang").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("budget-75000").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("kedalaman-2").click();
  await quiz.getByTestId("undertone-cool").click();
  await quiz.getByRole("button", { name: /Lanjut/ }).click();
  await quiz.getByTestId("rutin-belum").click();
  await quiz.getByRole("button", { name: "Lihat rutinitasku" }).click();
  await page.waitForURL(/\/rutinitas$/);
  // Pemula langsung melihat 3 langkah inti, dengan pilihan rutinitas lengkap.
  await expect(page.getByTestId("mode-inti")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("langkah-rutinitas")).toHaveCount(3);
  await page.getByTestId("mode-lengkap").click();
  await expect(page.getByTestId("subtotal-pagi")).toContainText("Rp");
  await expect(page.getByTestId("subtotal-malam")).toContainText("Rp");
  expect(photoCalls).toBe(0);
});

test("link TikTok tiruan: Rona tidak menjual merek itu, 3 kartu mirip dengan alasan, tambah ke keranjang", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("ikon-cari-video").first().click();
  await page.waitForURL(/\/cari-dari-video$/);
  await expect(page.getByText("Cari dari video, opsional")).toBeVisible();
  await page.getByTestId("input-link").fill("https://www.tiktok.com/@rona.demo/video/7300000000000000001?is_from_webapp=1");
  await page.getByRole("button", { name: "Cari yang mirip" }).click();
  const result = page.getByTestId("hasil-dupe");
  await expect(result.getByTestId("judul-hasil-dupe")).toHaveText("Rona tidak menjual Wardah, ini yang paling mirip");
  await expect(result.getByTestId("sumber-video")).toContainText("Demo Kreator");
  await expect(result.getByTestId("sumber-video").getByRole("link", { name: /Lihat video asli/ })).toHaveAttribute("href", "https://www.tiktok.com/@rona.demo/video/7300000000000000001");
  const cards = result.getByTestId("kartu-dupe");
  await expect(cards).toHaveCount(3);
  for (const c of await cards.all()) await expect(c.getByTestId("alasan-dupe")).not.toBeEmpty();
  // Merek asli hanya teks dari masukan, tidak pernah sebagai produk yang dijual.
  await expect(cards.filter({ hasText: "Wardah" })).toHaveCount(0);
  await cards.first().getByRole("button", { name: "Tambah ke keranjang" }).click();
  await expect(cards.first().getByText("Masuk keranjang")).toBeVisible();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from cart_items where source = 'cari_video' and created_at > now() - interval '2 minutes'`;
  expect(n).toBeGreaterThanOrEqual(1);

  // Link Instagram diarahkan ke screenshot dengan ramah.
  await page.getByTestId("input-link").fill("https://www.instagram.com/reel/C0ntoh/");
  await page.getByRole("button", { name: "Cari yang mirip" }).click();
  await expect(result).toContainText("Link Instagram belum bisa kami buka. Kirim screenshot produknya saja");
});

test("unggah screenshot ProductArt: produk yang tepat ditemukan dengan shade yang sama", async ({ page }) => {
  await page.goto("/cari-dari-video");
  await page.getByRole("tab", { name: /Unggah screenshot/ }).click();
  await page.getByTestId("input-screenshot").setInputFiles(gambar("lumi-velvet-merah-ceri.jpg"));
  await page.getByRole("button", { name: "Cari yang mirip" }).click();
  const result = page.getByTestId("hasil-dupe");
  await expect(result.getByTestId("judul-hasil-dupe")).toHaveText("Ada di Rona: Lumi Velvet Matte Lipstick");
  const cards = result.getByTestId("kartu-dupe");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Lumi Velvet Matte Lipstick");
  await expect(cards.first().getByRole("combobox")).toHaveValue(String((await sql<{ id: number }[]>`select v.id from variants v join products p on p.id = v.product_id where p.slug = 'lumi-velvet-matte-lipstick' and v.shade_name = '06 Merah Ceri'`)[0].id));
});

test("tanpa env AI: pilihan foto, halaman cari dari video, dan ikon video tidak ada", async ({ page }) => {
  await page.goto(`${NO_AI}/kuis-kulit`);
  await expect(page.getByTestId("kuis-kulit")).toBeVisible();
  await expect(page.getByTestId("pilihan-isi-kuis")).toHaveCount(0);
  await expect(page.getByTestId("bantu-foto")).toHaveCount(0);
  await page.waitForTimeout(600);
  await expect(page.getByTestId("ikon-cari-video")).toHaveCount(0);
  await page.goto(`${NO_AI}/cari-dari-video`);
  await expect(page.getByRole("heading", { name: "Halaman ini belum ada" })).toBeVisible();
  await expect(page.getByTestId("input-link")).toHaveCount(0);
  for (const api of ["/api/ai/foto-kulit", "/api/ai/dupe"]) {
    const r = await page.request.post(`${NO_AI}${api}`, { headers: { origin: NO_AI }, data: { link: "https://www.tiktok.com/@a/video/1" } });
    expect(r.status()).toBe(404);
  }
});
