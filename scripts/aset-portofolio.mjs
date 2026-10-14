// npm run aset:portofolio  (Fase 8B)
// Gambar bersih resolusi tinggi untuk situs portofolio: beranda desktop, halaman produk, checkout di HP, panel Advisor
// di HP, dashboard admin, Laporan, Kesehatan AI, dan Asisten Admin. Tanpa pita demo (elemen [data-tanda-demo]
// disembunyikan saat memotret), dibingkai perangkat sederhana buatan sendiri (HTML dan CSS, tanpa logo atau mockup
// bermerek), latar transparan. Hasil: _portofolio/<nama>.png dan versi tanpa bingkai di _portofolio/mentah/.
//
// Syarat: database bersih dari data uji (dicek scripts/cek-data-uji.ts) dan server sudah jalan.
//   ASET_URL=http://localhost:3211 npm run aset:portofolio        (bawaan CUPLIK_URL, lalu http://localhost:3000)
//   npm run aset:portofolio -- --hanya=beranda-desktop,admin-laporan
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertNoTestData, formatBytes, launchBrowser, scrollToTopAndSettle } from "./screenshot.mjs";

const BASE = (process.env.ASET_URL ?? process.env.CUPLIK_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve("_portofolio");
const MENTAH = path.join(OUT, "mentah");
const hanya = (process.argv.find((a) => a.startsWith("--hanya="))?.slice(8) ?? "").split(",").filter(Boolean);

const SEMBUNYI = `
  [data-tanda-demo], nextjs-portal { display: none !important; }
  html { scroll-behavior: auto !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const HP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const PRODUK = "pualam-velvet-matte-cushion-spf-50";
const PRODUK_KEDUA = "lumi-velvet-matte-lipstick";

async function siapkan(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}

async function potret(page, nama) {
  await assertNoTestData(page, nama);
  await page.addStyleTag({ content: SEMBUNYI });
  await page.waitForTimeout(400);
  // Pastikan pita demo, panduan, dan lencana demo admin benar-benar tidak tampil (build lama tanpa penanda ditolak).
  const tampak = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tanda-demo], [aria-label="Pemberitahuan toko demo"], [aria-label="Panduan demo"]')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    }),
  );
  if (tampak) throw new Error("Penanda demo masih terlihat. Jalankan npm run build lalu ulangi.");
  const out = path.join(MENTAH, `${nama}.png`);
  await page.screenshot({ path: out, animations: "disabled" });
  return out;
}

async function masukOwner(page) {
  await siapkan(page, "/admin/masuk?kembali=%2Fadmin");
  await page.getByRole("button", { name: "Owner", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/admin", { timeout: 30_000 });
  await page.waitForLoadState("load");
}

async function tambahKeKeranjang(page, slug) {
  await siapkan(page, `/p/${slug}`);
  await page.getByRole("button", { name: "Tambah ke Keranjang", exact: true }).click();
  const laci = page.getByRole("dialog", { name: /Keranjang/ });
  await laci.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await laci.waitFor({ state: "hidden" });
}

// Setiap entri: konteks perangkat, bingkai, dan langkah sampai keadaan yang dipotret.
const DAFTAR = [
  {
    nama: "beranda-desktop",
    perangkat: DESKTOP,
    bingkai: "browser",
    alamat: "/",
    jalan: async (page) => siapkan(page, "/"),
  },
  {
    nama: "produk-desktop",
    perangkat: DESKTOP,
    bingkai: "browser",
    alamat: `/p/${PRODUK}`,
    jalan: async (page) => siapkan(page, `/p/${PRODUK}`),
  },
  {
    nama: "checkout-hp",
    perangkat: HP,
    bingkai: "hp",
    jalan: async (page) => {
      await tambahKeKeranjang(page, PRODUK);
      await tambahKeKeranjang(page, PRODUK_KEDUA);
      await siapkan(page, "/checkout");
      await page.getByLabel("Nama penerima").fill("Nadia Larasati");
      await page.getByLabel("Nomor WhatsApp").fill("081234567890");
      await page.getByLabel("Provinsi").selectOption("35");
      await page.getByLabel("Kota atau kabupaten").selectOption("35.73");
      await page.getByLabel("Kecamatan").selectOption({ label: "Lowokwaru" });
      await page.getByLabel("Kode pos").fill("65145");
      await page.getByLabel("Alamat lengkap").fill("Jl. Kertoleksono No. 21, RT 02 RW 04");
      await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
      const jne = page.getByRole("radio", { name: "JNE REG" });
      await jne.click();
      await jne.getByText(/Estimasi tiba/).waitFor();
      await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
      await page.getByRole("radio", { name: "QRIS" }).click();
      await scrollToTopAndSettle(page);
    },
  },
  {
    nama: "advisor-hp",
    perangkat: HP,
    bingkai: "hp",
    jalan: async (page) => {
      await siapkan(page, "/");
      await page.getByTestId("tombol-advisor").click();
      const panel = page.getByTestId("panel-advisor");
      await panel.getByRole("textbox").first().fill("Sunscreen ringan untuk kulit berminyak, di bawah 100 ribu");
      await panel.getByRole("button", { name: "Kirim" }).click();
      await panel.getByTestId("kartu-advisor").first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
    },
  },
  {
    nama: "admin-dashboard",
    perangkat: DESKTOP,
    bingkai: "browser",
    alamat: "/admin",
    masuk: true,
    jalan: async (page) => siapkan(page, "/admin"),
  },
  {
    nama: "admin-laporan",
    perangkat: DESKTOP,
    bingkai: "browser",
    alamat: "/admin/laporan",
    masuk: true,
    jalan: async (page) => siapkan(page, "/admin/laporan"),
  },
  {
    nama: "admin-kesehatan-ai",
    perangkat: DESKTOP,
    bingkai: "browser",
    alamat: "/admin/laporan?tab=ai",
    masuk: true,
    jalan: async (page) => siapkan(page, "/admin/laporan?tab=ai"),
  },
  {
    nama: "admin-asisten",
    perangkat: DESKTOP,
    bingkai: "browser",
    alamat: "/admin",
    masuk: true,
    jalan: async (page) => {
      await siapkan(page, "/admin");
      await page.getByTestId("asisten-sidebar").click();
      const panel = page.getByTestId("panel-asisten");
      await panel.getByLabel("Pertanyaan untuk Asisten Admin").fill("Omzet minggu ini dibanding minggu lalu");
      await panel.getByRole("button", { name: "Kirim pertanyaan" }).click();
      const jawaban = panel.getByTestId("jawaban-asisten").last();
      await jawaban.getByText("Membaca pertanyaanmu").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(1500);
    },
  },
];

// Bingkai buatan sendiri: jendela peramban polos (tiga titik abu-abu dan kolom alamat) atau ponsel polos tanpa tombol
// dan tanpa merek. Gambar mentah ditempel apa adanya; bingkai dipotret dengan latar transparan.
function htmlBingkai(entri, gambar) {
  const css = `
    html, body { margin: 0; background: transparent; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; }
    .panggung { display: inline-block; padding: 56px; }
    .browser { width: ${entri.perangkat.viewport.width}px; border-radius: 14px; overflow: hidden; background: #fff;
      box-shadow: 0 30px 60px -20px rgba(43, 33, 29, .35), 0 0 0 1px rgba(43, 33, 29, .08); }
    .bilah { height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: #F3EEEA; border-bottom: 1px solid #E6DED8; }
    .titik { width: 12px; height: 12px; border-radius: 50%; background: #D5CBC4; }
    .alamat { margin-left: 18px; flex: 1; max-width: 560px; height: 26px; border-radius: 13px; background: #fff; color: #8A7B72;
      font-size: 13px; display: flex; align-items: center; padding: 0 14px; letter-spacing: .01em; }
    .browser img, .layar img { display: block; width: 100%; }
    .hp { width: ${entri.perangkat.viewport.width}px; padding: 14px; border-radius: 58px; background: #1E1916;
      box-shadow: 0 40px 70px -25px rgba(43, 33, 29, .45), inset 0 0 0 2px #3A322D; }
    .layar { position: relative; border-radius: 44px; overflow: hidden; background: #fff; }
    .kamera { position: absolute; top: 12px; left: 50%; width: 92px; height: 26px; margin-left: -46px; border-radius: 13px; background: #1E1916; z-index: 2; }
  `;
  const src = pathToFileURL(gambar).href;
  const isi =
    entri.bingkai === "hp"
      ? `<div class="hp"><div class="layar"><div class="kamera"></div><img src="${src}" alt=""></div></div>`
      : `<div class="browser"><div class="bilah"><span class="titik"></span><span class="titik"></span><span class="titik"></span><span class="alamat">${entri.alamat ?? "/"}</span></div><img src="${src}" alt=""></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="panggung">${isi}</div></body></html>`;
}

async function bingkai(browser, entri, gambar) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: entri.perangkat.deviceScaleFactor });
  try {
    const page = await ctx.newPage();
    const htmlPath = path.join(MENTAH, `.${entri.nama}.html`);
    writeFileSync(htmlPath, htmlBingkai(entri, gambar));
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    const out = path.join(OUT, `${entri.nama}.png`);
    await page.locator(".panggung").screenshot({ path: out, omitBackground: true });
    rmSync(htmlPath);
    return out;
  } finally {
    await ctx.close();
  }
}

async function main() {
  try {
    execSync("npx tsx scripts/cek-data-uji.ts", { stdio: "inherit" });
  } catch {
    process.exit(1);
  }
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(8000) });
  } catch {
    console.error(`Server belum jalan di ${BASE}. Jalankan npm run build && npm run start (atau atur ASET_URL), lalu ulangi.`);
    process.exit(1);
  }
  mkdirSync(MENTAH, { recursive: true });
  const daftar = hanya.length ? DAFTAR.filter((d) => hanya.includes(d.nama)) : DAFTAR;
  const browser = await launchBrowser();
  const hasil = [];
  const gagal = [];
  try {
    for (const entri of daftar) {
      process.stdout.write(`Memotret ${entri.nama}... `);
      const ctx = await browser.newContext({ ...entri.perangkat, reducedMotion: "reduce", locale: "id-ID", timezoneId: "Asia/Jakarta" });
      try {
        const page = await ctx.newPage();
        if (entri.masuk) await masukOwner(page);
        await entri.jalan(page);
        const mentah = await potret(page, entri.nama);
        const jadi = await bingkai(browser, entri, mentah);
        hasil.push(jadi, mentah);
        console.log("selesai");
      } catch (e) {
        gagal.push(entri.nama);
        console.log(`GAGAL: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nHasil di ${path.relative(process.cwd(), OUT)}/:`);
  for (const f of hasil) console.log(`  ${path.relative(OUT, f).padEnd(34)} ${formatBytes(statSync(f).size)}`);
  if (gagal.length) {
    console.error(`\nGagal: ${gagal.join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
