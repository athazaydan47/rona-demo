import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { sql } from "./helpers";

// Fase 8C: Tanya Rona satu pintu di lebar 375 px. Server utama memakai AI_PROVIDER=mock (oEmbed tiruan), server kedua
// tanpa env AI. Kartu harus muat tanpa geser ke samping.
const NO_AI = "http://localhost:3212";
const gambar = (f: string) => path.join(process.cwd(), "evals/7c/gambar", f);

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

async function bukaChat(page: Page, base = "") {
  await page.goto(`${base}/`);
  await page.getByTestId("tombol-advisor").click();
  const panel = page.getByTestId("panel-advisor");
  await expect(panel.getByTestId("layar-pembuka")).toBeVisible();
  return panel;
}

async function tanpaGeserSamping(page: Page) {
  const lebar = await page.getByTestId("panel-advisor").evaluate((el) => {
    const list = el.querySelector("[aria-live]") as HTMLElement;
    return { scroll: list.scrollWidth, client: list.clientWidth, panel: el.scrollWidth, layar: window.innerWidth };
  });
  expect(lebar.scroll).toBeLessThanOrEqual(lebar.client + 1);
  expect(lebar.panel).toBeLessThanOrEqual(lebar.layar + 1);
}

const kirim = async (panel: ReturnType<Page["getByTestId"]>, text: string) => {
  await panel.getByLabel(/Pesan untuk/).fill(text);
  await panel.getByRole("button", { name: "Kirim" }).click();
};

test("kuis di chat sampai rutinitas, lalu Tambah semua dan ringkasan keranjang", async ({ page }) => {
  const panel = await bukaChat(page);
  await panel.getByRole("button", { name: "Rekomendasi sesuai kulitku" }).click();
  const kuis = panel.getByTestId("kuis-chat");
  await expect(kuis).toBeVisible();
  await kuis.getByTestId("kuis-skinType-berminyak").click();
  await kuis.getByTestId("kuis-concerns-jerawat").click();
  await kuis.getByTestId("kuis-lanjut").click();
  await kuis.getByTestId("kuis-sensitivity-sedang").click();
  // Pertanyaan boleh dilewati.
  await kuis.getByTestId("kuis-lewati").click();
  await kuis.getByTestId("kuis-depth-3").click();
  await kuis.getByTestId("kuis-undertone-neutral").click();
  await kuis.getByTestId("kuis-routine-dasar").click();
  await kuis.getByTestId("kuis-simpan").click();
  const rutinitas = panel.getByTestId("kartu-rutinitas");
  await expect(rutinitas).toBeVisible();
  await expect(rutinitas.getByTestId("subtotal-pagi")).toContainText("Rp");
  await rutinitas.getByTestId("mode-inti").click();
  await expect(rutinitas.getByTestId("langkah-rutinitas")).toHaveCount(3);
  await rutinitas.getByTestId("tambah-semua").click();
  await expect(rutinitas.getByRole("status")).toContainText(/keranjang/i);
  await expect(panel.getByTestId("ringkasan-keranjang")).toContainText("3 produk");
  await tanpaGeserSamping(page);
  // Profil tersimpan sama dengan Kuis Kulit: halaman rutinitas langsung tersusun.
  await page.goto("/rutinitas");
  await expect(page.getByTestId("total-rutinitas")).toBeVisible();
});

test("tempel link TikTok tiruan di tengah kalimat: kartu dupe tampil dan bisa ditambah ke keranjang", async ({ page }) => {
  const panel = await bukaChat(page);
  await kirim(panel, "ada yang mirip ini ga https://vt.tiktok.com/ZSdemo0001/ buat kondangan");
  const hasil = panel.getByTestId("hasil-dupe");
  await expect(hasil.getByTestId("judul-hasil-dupe")).toHaveText("Rona tidak menjual Wardah, ini yang paling mirip");
  await expect(hasil.getByTestId("sumber-video")).toContainText("Demo Kreator");
  const cards = hasil.getByTestId("kartu-dupe");
  await expect(cards).toHaveCount(3);
  await cards.first().getByRole("button", { name: "Tambah ke keranjang" }).click();
  await expect(cards.first().getByText("Masuk keranjang")).toBeVisible();
  await expect(panel.getByTestId("ringkasan-keranjang")).toBeVisible();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from cart_items where source = 'cari_video' and created_at > now() - interval '2 minutes'`;
  expect(n).toBeGreaterThanOrEqual(1);
  // Advisor tidak pernah menjawab "tidak bisa membuka link".
  await expect(panel.getByText(/tidak bisa membuka (link|video|tautan)/i)).toHaveCount(0);
  // Link Instagram dijawab dengan ajakan screenshot dan tombol unggah.
  await kirim(panel, "https://www.instagram.com/reel/C0ntoh/ yang ini ada?");
  await expect(panel.getByTestId("kartu-unggah").last()).toContainText(/Instagram/);
  await tanpaGeserSamping(page);
});

test("unggah screenshot di chat: produk yang sama ditemukan", async ({ page }) => {
  const panel = await bukaChat(page);
  await panel.getByTestId("lampiran-screenshot").setInputFiles(gambar("lumi-velvet-merah-ceri.jpg"));
  const hasil = panel.getByTestId("hasil-dupe");
  await expect(hasil.getByTestId("judul-hasil-dupe")).toHaveText("Ada di Rona: Lumi Velvet Matte Lipstick");
  await expect(hasil.getByTestId("kartu-dupe")).toHaveCount(1);
  await expect(panel.getByText("Kirim 1 screenshot")).toBeVisible();
  await tanpaGeserSamping(page);
});

test("lacak pesanan di chat: nomor dan WA harus cocok, nomor WA tidak tampil di gelembung", async ({ page }) => {
  // Batas tebakan lacak (per IP lokal yang sama untuk semua uji) dikosongkan dulu; uji keamanan sengaja menghabiskannya.
  await sql`delete from rate_limits where key like 'lacak:%'`;
  const [o] = await sql<{ number: string; guest_phone: string; status: string }[]>`select number, guest_phone, status from orders where guest_phone is not null and customer_id is null order by id desc limit 1`;
  const panel = await bukaChat(page);
  await panel.getByRole("button", { name: "Lacak pesananku" }).click();
  const form = panel.getByTestId("form-lacak-chat").last();
  await form.getByLabel("Nomor pesanan").fill(o.number);
  await form.getByLabel(/Nomor WhatsApp saat memesan/).fill("089900001111");
  await form.getByTestId("kirim-lacak").click();
  await expect(panel.getByTestId("jawaban-advisor").last()).toContainText("Pesanan tidak ditemukan");
  const form2 = panel.getByTestId("form-lacak-chat").last();
  await form2.getByLabel(/Nomor WhatsApp saat memesan/).fill(o.guest_phone);
  await form2.getByTestId("kirim-lacak").click();
  const kartu = panel.getByTestId("kartu-pesanan");
  await expect(kartu).toBeVisible();
  await expect(kartu).toContainText(o.number);
  await expect(panel).not.toContainText(o.guest_phone);
  await expect(kartu.getByRole("link", { name: "Buka halaman pesanan" })).toHaveAttribute("href", new RegExp(`/pesanan/${o.number}\\?t=`));
  await tanpaGeserSamping(page);
});

test("cek ongkir di chat: kalimat bebas, kota ambigu, dan pilihan kota", async ({ page }) => {
  const panel = await bukaChat(page);
  await kirim(panel, "ongkir ke Bandung berapa?");
  const ongkir = panel.getByTestId("kartu-ongkir");
  await expect(ongkir).toContainText("Kota Bandung");
  expect(await ongkir.getByTestId("opsi-ongkir").count()).toBeGreaterThan(1);
  await kirim(panel, "ongkir ke malang");
  const pilih = panel.getByTestId("pilih-kota").last();
  await pilih.getByRole("button", { name: "Kota Malang" }).click();
  await expect(panel.getByTestId("kartu-ongkir").last()).toContainText("Dalam kota Malang");
  await expect(panel.getByTestId("kartu-ongkir").last()).toContainText("Ambil di Toko");
  await tanpaGeserSamping(page);
});

test("tombol kembali menutup chat tanpa meninggalkan halaman", async ({ page }) => {
  await page.goto("/c/bibir");
  const url = page.url();
  await page.getByTestId("tombol-advisor").click();
  await expect(page.getByTestId("panel-advisor")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("panel-advisor")).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test("tanpa env AI: chip berbasis aturan tetap jalan, pertanyaan bebas diarahkan ke pencarian", async ({ page }) => {
  const panel = await bukaChat(page, NO_AI);
  await expect(panel.getByText("AI sedang tidak tersedia")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Cari yang mirip dari video" })).toHaveCount(0);
  await expect(panel.getByLabel("Lampirkan screenshot produk (1 sampai 3)")).toHaveCount(0);
  await panel.getByRole("button", { name: "Cek ongkir" }).click();
  await panel.getByTestId("pilih-kota").getByRole("button", { name: "Jakarta" }).click();
  await expect(panel.getByTestId("kartu-ongkir")).toContainText("Jakarta");
  await kirim(panel, "Aku pakai Pualam Velvet Matte Cushion 02N, yang setara apa?");
  await expect(panel.getByTestId("kartu-shade").getByTestId("hasil-shade")).toHaveCount(3);
  await kirim(panel, "Sunscreen buat kulit berminyak di bawah 100 ribu");
  await expect(panel.getByTestId("kartu-info").last()).toContainText("Cari");
  await expect(panel.getByTestId("chip-lanjut").first()).toBeVisible();
  await tanpaGeserSamping(page);
});
