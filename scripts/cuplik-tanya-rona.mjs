// Alur Tanya Rona Fase 8C untuk lembar cuplik (server dengan AI_PROVIDER=mock), di 375 px: layar pembuka dengan chip,
// kuis di chat, kartu rutinitas, kartu dupe dari link TikTok tiruan, kartu lacak pesanan, dan kartu ongkir.
import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";
import { shootPage } from "./screenshot.mjs";

config({ path: ".env.local", quiet: true });

async function pesananTamu() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [o] = await sql`select number, guest_phone from orders where customer_id is null and guest_phone is not null and status in ('dikirim', 'diproses', 'selesai') order by created_at desc limit 1`;
    return o ?? null;
  } finally {
    await sql.end();
  }
}

/**
 * @param {import("@playwright/test").Browser} browser
 */
export async function captureTanyaRonaFlow(browser, baseUrl, { width, deviceScaleFactor, outDir, slug, mode = "ringkas" }) {
  const height = 812;
  const shots = [];
  const order = await pesananTamu();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", baseURL: baseUrl, isMobile: true, hasTouch: true });
  // Batas waktu per aksi supaya satu elemen yang tidak muncul tidak membuat cuplik menunggu selamanya.
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  const panel = page.getByTestId("panel-advisor");
  // Potret layar (panel chat menutupi layar di HP), setelah pesan terakhir digulir ke atas daftar.
  const snap = async (name) => {
    await page.evaluate(() => {
      const list = document.querySelector('[data-testid="panel-advisor"] [aria-live]');
      const last = list?.querySelectorAll('[data-testid="jawaban-advisor"]');
      const target = last?.length ? last[last.length - 1] : null;
      if (list && target) list.scrollTop = Math.max(0, target.offsetTop - list.offsetTop - 56);
    });
    await page.waitForTimeout(250);
    const out = path.join(outDir, `${slug}-${width}-${shots.length + 1}.png`);
    const shot = await shootPage(page, out, { width, height, deviceScaleFactor, fullPage: false, mode });
    shots.push({ ...shot, path: name, width });
  };
  const bukaBaru = async () => {
    await page.goto("/", { waitUntil: "load" });
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: "load" });
    await page.getByTestId("tombol-advisor").click();
    await panel.getByTestId("layar-pembuka").waitFor();
    await page.waitForTimeout(300);
  };
  const kirim = async (text) => {
    await panel.getByLabel(/Pesan untuk/).fill(text);
    await panel.getByRole("button", { name: "Kirim" }).click();
  };
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      console.error(`  (${label} gagal: ${e instanceof Error ? e.message.split("\n")[0] : e})`);
    }
  };

  try {
    await step("pembuka", async () => {
      await bukaBaru();
      await snap("Tanya Rona: layar pembuka dengan chip");
    });
    await step("kuis", async () => {
      await panel.getByRole("button", { name: "Rekomendasi sesuai kulitku" }).click();
      const kuis = panel.getByTestId("kuis-chat");
      await kuis.getByTestId("kuis-skinType-berminyak").click();
      await kuis.getByTestId("kuis-concerns-jerawat").click();
      await snap("Kuis kulit di chat");
      await kuis.getByTestId("kuis-lanjut").click();
      await kuis.getByTestId("kuis-sensitivity-sedang").click();
      await kuis.getByTestId("kuis-budget-150000").click();
      await kuis.getByTestId("kuis-depth-3").click();
      await kuis.getByTestId("kuis-undertone-neutral").click();
      await kuis.getByTestId("kuis-routine-dasar").click();
      await kuis.getByTestId("kuis-simpan").click();
      await panel.getByTestId("kartu-rutinitas").waitFor({ timeout: 15_000 });
      await snap("Kartu rutinitas");
    });
    await step("dupe", async () => {
      await bukaBaru();
      await kirim("Ada yang mirip ini? https://vt.tiktok.com/ZSdemo0001/ buat kondangan");
      await panel.getByTestId("hasil-dupe").waitFor({ timeout: 20_000 });
      await snap("Kartu dupe dari link TikTok");
    });
    if (order) {
      await step("lacak", async () => {
        await bukaBaru();
        await panel.getByRole("button", { name: "Lacak pesananku" }).click();
        const form = panel.getByTestId("form-lacak-chat").last();
        await form.getByLabel("Nomor pesanan").fill(order.number);
        await form.getByLabel(/Nomor WhatsApp saat memesan/).fill(order.guest_phone);
        await form.getByTestId("kirim-lacak").click();
        await panel.getByTestId("kartu-pesanan").waitFor({ timeout: 15_000 });
        await snap("Kartu lacak pesanan");
      });
    }
    await step("ongkir", async () => {
      await bukaBaru();
      await kirim("Ongkir ke Bandung berapa?");
      await panel.getByTestId("kartu-ongkir").waitFor({ timeout: 15_000 });
      await snap("Kartu ongkir");
    });
  } finally {
    await context.close();
  }
  return shots;
}
