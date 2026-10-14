// Lembar review visual: potret halaman di 375 px dan 1440 px lalu gabungkan jadi 1 sampai beberapa JPEG.
//
//   npm run cuplik -- --nama=fase1 --halaman=/,/design --aksi=menu
//   --lebar=375 atau --lebar=1440   potret satu lebar saja
//   --penuh                         perilaku lama: dengan footer, ribbon, promo bar, dan tanpa batas tinggi
//
// Bawaan mode ringkas: footer, BottomNav, DemoRibbon, PromoBar disembunyikan, tinggi dibatasi
// 2400 px (375) dan 1800 px (1440), dan lembar disusun beberapa baris supaya sesedikit mungkin.
//
// Server harus sudah jalan di http://localhost:3000 (ubah lewat env CUPLIK_URL).
// Hasil: _review/cuplik-<nama>-<YYYYMMDD-HHmm>-<nomor>.jpg
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { capturePage, formatBytes, labelWib, launchBrowser, screenshotHtmlToJpeg, stampWib } from "./screenshot.mjs";
import { captureAdminFlow } from "./cuplik-admin.mjs";
import { captureAdmin6bFlow } from "./cuplik-admin-6b.mjs";
import { captureAdmin6cFlow } from "./cuplik-admin-6c.mjs";
import { captureAiBuyerFlow } from "./cuplik-ai-pembeli.mjs";
import { captureAccountFlow } from "./cuplik-akun.mjs";
import { captureBuyFlow } from "./cuplik-alur-beli.mjs";

const BASE_URL = (process.env.CUPLIK_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = path.resolve("_review");

const SHEET_WIDTH = 2400; // lebar maksimal JPEG
const PAD = 24;
const GAP = 16;
const CAPTION_H = 30;
const HEADER_H = 56;
const MAX_SEGMENT_H = 3600; // tinggi maksimal satu potongan di lembar (px tampilan), mode penuh
const MAX_SHEET_H = 6200; // tinggi maksimal satu lembar (px), beberapa baris per lembar
const ROW_GAP = 20;
const DISPLAY_WIDTH = { 375: 375, 1440: 960 }; // lebar tampil di lembar

const VIEWS = [
  { width: 375, deviceScaleFactor: 2 },
  { width: 1440, deviceScaleFactor: 1 },
];

const ACTIONS = {
  menu: { width: 375, deviceScaleFactor: 2, label: "menu HP terbuka" },
  megamenu: { width: 1440, deviceScaleFactor: 1, label: "MegaMenu terbuka" },
  filter: { width: 375, deviceScaleFactor: 2, label: "bottom sheet filter terbuka", target: "catalog" },
  shade: { width: 375, deviceScaleFactor: 2, label: "Shade Finder terbuka", target: "product" },
  habis: { width: 375, deviceScaleFactor: 2, label: "shade habis dipilih, Kabari aku", target: "product" },
  // Alur bertahap: tambah 2 produk lalu potret laci, keranjang, checkout, bayar, sukses, pesanan di 375 dan 1440 px.
  "alur-beli": { flow: true, label: "alur beli", capture: captureBuyFlow },
  // Alur akun: masuk dengan OTP demo, halaman /akun, formulir ulasan, checkout dengan poin. Halaman /akun di --halaman
  // tidak dipotret terpisah (tanpa sesi isinya hanya pengalihan ke /masuk).
  akun: { flow: true, label: "alur akun", capture: captureAccountFlow, covers: ["/akun"] },
  // Alur admin: masuk staf, dashboard, pesanan, label, stok, transfer, opname, staf, log, dashboard Staf Dinoyo di HP.
  admin: { flow: true, label: "alur admin", capture: captureAdminFlow, covers: ["/admin"] },
  // Alur admin Fase 6B: produk, kategori, promo, banner, pengaturan, kanban baru, opname di HP.
  "admin-6b": { flow: true, label: "alur admin 6B", capture: captureAdmin6bFlow, covers: ["/admin"] },
  // Alur admin Fase 6C: laporan, pelanggan, moderasi ulasan, notifikasi keluar, laporan di HP.
  "admin-6c": { flow: true, label: "alur admin 6C", capture: captureAdmin6cFlow, covers: ["/admin"] },
  // Alur AI pembeli Fase 7A (server dengan AI_PROVIDER=mock): Advisor, tafsiran, kuis, rutinitas, padanan, ringkasan.
  "ai-pembeli": { flow: true, label: "alur AI pembeli", capture: captureAiBuyerFlow, covers: ["/"] },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) args[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[a.slice(2)] = argv[++i];
    else args[a.slice(2)] = "true";
  }
  return args;
}

function list(value, fallback) {
  return (value ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeName(s) {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "review";
}

function pageSlug(p) {
  return p === "/" ? "beranda" : safeName(p.replace(/^\//, "").replace(/\//g, "-"));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

async function ensureServer() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    if (res.status >= 500) {
      console.warn(`Peringatan: ${BASE_URL} menjawab ${res.status}. Lembar tetap dibuat, cek error di terminal server.`);
    }
  } catch {
    console.error(
      [
        `Server belum jalan di ${BASE_URL}.`,
        "Jalankan dulu di terminal lain:",
        "  npm run dev",
        "atau untuk hasil yang lebih mirip produksi:",
        "  npm run build && npm run start",
        "Setelah itu ulangi perintah cuplik.",
      ].join("\n"),
    );
    process.exit(1);
  }
}

function gitShortHash() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// Pecah setiap potretan menjadi potongan setinggi maksimal MAX_SEGMENT_H, lalu susun ke lembar.
function buildSegments(shots) {
  const segments = [];
  for (const shot of shots) {
    const displayW = DISPLAY_WIDTH[shot.width] ?? Math.min(960, shot.width);
    const scale = displayW / shot.cssWidth;
    const displayH = Math.round(shot.cssHeight * scale);
    const parts = Math.max(1, Math.ceil(displayH / MAX_SEGMENT_H));
    const partH = Math.ceil(displayH / parts);
    for (let i = 0; i < parts; i++) {
      const offset = i * partH;
      segments.push({
        shot,
        width: displayW,
        height: Math.min(partH, displayH - offset),
        offset,
        scale,
        part: i + 1,
        parts,
      });
    }
  }
  return segments;
}

// Tumpuk potretan berurutan yang lebarnya sama dan pendek (biasanya desktop yang dibatasi 1800 px)
// menjadi satu kolom, selama tingginya tidak melebihi potretan tertinggi di sekitarnya.
function buildBlocks(segments) {
  const tallest = Math.max(...segments.map((s) => s.height));
  const blocks = [];
  for (const seg of segments) {
    const last = blocks[blocks.length - 1];
    const h = seg.height + CAPTION_H;
    if (last && last.width === seg.width && last.height + GAP + h <= tallest + CAPTION_H) {
      last.items.push(seg);
      last.height += GAP + h;
    } else {
      blocks.push({ width: seg.width, height: h, items: [seg] });
    }
  }
  return blocks;
}

// Susun blok ke baris (lebar maksimal lembar), lalu baris ke lembar (tinggi maksimal MAX_SHEET_H).
function packSheets(segments) {
  const inner = SHEET_WIDTH - PAD * 2;
  const rows = [];
  let row = { blocks: [], width: 0, height: 0 };
  for (const block of buildBlocks(segments)) {
    const need = (row.blocks.length ? GAP : 0) + block.width;
    if (row.blocks.length && row.width + need > inner) {
      rows.push(row);
      row = { blocks: [], width: 0, height: 0 };
    }
    row.width += (row.blocks.length ? GAP : 0) + block.width;
    row.height = Math.max(row.height, block.height);
    row.blocks.push(block);
  }
  if (row.blocks.length) rows.push(row);

  const sheets = [];
  let sheet = [];
  let used = 0;
  for (const r of rows) {
    const need = (sheet.length ? ROW_GAP : 0) + r.height;
    if (sheet.length && used + need > MAX_SHEET_H) {
      sheets.push(sheet);
      sheet = [];
      used = 0;
    }
    used += (sheet.length ? ROW_GAP : 0) + r.height;
    sheet.push(r);
  }
  if (sheet.length) sheets.push(sheet);
  return sheets;
}

function segmentHtml(seg) {
  const { shot } = seg;
  const caption = [
    `<b>${escapeHtml(shot.path)}</b>`,
    `${shot.width} px`,
    shot.label ? escapeHtml(shot.label) : "",
    seg.parts > 1 ? `bagian ${seg.part} dari ${seg.parts}` : "",
    shot.truncated ? `<span class="cut">dipotong, tinggi asli ${shot.originalHeight} px</span>` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const imgs = shot.files
    .map((f) => {
      const top = Math.round(f.cssTop * seg.scale) - seg.offset;
      const h = Math.round(f.cssHeight * seg.scale);
      if (top + h <= 0 || top >= seg.height) return "";
      return `<img src="${pathToFileURL(f.path).href}" style="top:${top}px;width:${seg.width}px;height:${h}px" alt="">`;
    })
    .join("");
  const warn = shot.scrollWidth > shot.cssWidth ? `<span class="warn">melebar ${shot.scrollWidth} px</span>` : "";
  return `<figure style="width:${seg.width}px"><figcaption>${caption}${warn}</figcaption><div class="crop" style="height:${seg.height}px">${imgs}</div></figure>`;
}

function sheetHtml({ title, meta, rows }) {
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #EFE8E4; color: #2A1F1D; font-family: "Plus Jakarta Sans", -apple-system, "Helvetica Neue", Arial, sans-serif; }
  .sheet { width: ${SHEET_WIDTH}px; padding: ${PAD}px; }
  header { height: ${HEADER_H - 16}px; margin-bottom: 16px; display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
  h1 { margin: 0; font: 600 24px/1.2 Georgia, "Times New Roman", serif; }
  .meta { font-size: 15px; color: #6E615D; }
  .row { display: flex; gap: ${GAP}px; align-items: flex-start; margin-bottom: ${ROW_GAP}px; }
  .block { display: flex; flex-direction: column; gap: ${GAP}px; flex: none; }
  .cut { color: #C77D1A; font-weight: 600; }
  figure { margin: 0; background: #fff; border: 1px solid #DCD2CD; border-radius: 10px; overflow: hidden; flex: none; }
  figcaption { height: ${CAPTION_H}px; padding: 0 10px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6E615D; border-bottom: 1px solid #EAE2DE; white-space: nowrap; overflow: hidden; }
  figcaption b { color: #2A1F1D; }
  .warn { margin-left: auto; color: #B3261E; font-weight: 600; }
  .crop { position: relative; overflow: hidden; background: #FAF7F5; }
  .crop img { position: absolute; left: 0; display: block; }
</style></head>
<body><div class="sheet">
  <header><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(meta)}</div></header>
  ${rows.map((r) => `<div class="row">${r.blocks.map((b) => `<div class="block">${b.items.map(segmentHtml).join("")}</div>`).join("")}</div>`).join("")}
</div></body></html>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nama = safeName(args.nama ?? "review");
  const halaman = list(args.halaman, "/,/design");
  const aksi = list(args.aksi, "");
  const mode = args.penuh ? "penuh" : "ringkas";
  const lebar = args.lebar ? Number(args.lebar) : null;
  if (lebar != null && !VIEWS.some((v) => v.width === lebar)) {
    console.error(`--lebar hanya bisa ${VIEWS.map((v) => v.width).join(" atau ")}.`);
    process.exit(1);
  }
  const views = lebar ? VIEWS.filter((v) => v.width === lebar) : VIEWS;
  for (const p of halaman) {
    if (!p.startsWith("/")) {
      console.error(`Halaman harus diawali "/": ${p}`);
      process.exit(1);
    }
  }
  for (const a of aksi) {
    if (!ACTIONS[a]) {
      console.error(`Aksi tidak dikenal: ${a}. Pilihan: ${Object.keys(ACTIONS).join(", ")}`);
      process.exit(1);
    }
  }

  await ensureServer();

  const now = new Date();
  const stamp = stampWib(now);
  const tmpDir = path.join(OUT_DIR, `.tmp-${nama}-${stamp}-${process.pid}`);
  mkdirSync(tmpDir, { recursive: true });

  const browser = await launchBrowser();
  const shots = [];
  const outputs = [];
  try {
    // Potretan biasa: per halaman, 375 px lalu 1440 px.
    const covered = new Set(aksi.flatMap((a) => ACTIONS[a].covers ?? []));
    for (const p of halaman) {
      if (covered.has(p)) {
        console.log(`Halaman ${p} dipotret oleh alur aksi (dalam keadaan masuk).`);
        continue;
      }
      for (const v of views) {
        const url = `${BASE_URL}${p}`;
        process.stdout.write(`Memotret ${p} di ${v.width} px... `);
        const out = path.join(tmpDir, `${pageSlug(p)}-${v.width}.png`);
        const shot = await capturePage(browser, url, { width: v.width, deviceScaleFactor: v.deviceScaleFactor, out, mode });
        shots.push({ ...shot, path: p, width: v.width });
        console.log(`tinggi ${shot.originalHeight} px${shot.truncated ? ` (dipotong ke ${shot.cssHeight})` : ""}${shot.scrollWidth > v.width ? `, PERINGATAN: melebar ke ${shot.scrollWidth} px` : ""}`);
      }
    }
    // Keadaan khusus: pada halaman pertama, atau halaman katalog pertama untuk aksi filter.
    for (const a of aksi) {
      const cfg = ACTIONS[a];
      if (cfg.flow) {
        for (const v of views) {
          process.stdout.write(`Menjalankan ${cfg.label} di ${v.width} px... `);
          const flowShots = await cfg.capture(browser, BASE_URL, { width: v.width, deviceScaleFactor: v.deviceScaleFactor, outDir: tmpDir, slug: a, mode });
          shots.push(...flowShots);
          const wide = flowShots.filter((f) => f.scrollWidth > v.width);
          console.log(`${flowShots.length} potretan${wide.length ? `, PERINGATAN melebar: ${wide.map((f) => f.path).join(", ")}` : ""}`);
        }
        continue;
      }
      const p =
        cfg.target === "catalog"
          ? (halaman.find((h) => /^\/(c\/|cari|merek\/|promo)/.test(h)) ?? halaman[0])
          : cfg.target === "product"
            ? (halaman.find((h) => /^\/p\//.test(h)) ?? halaman[0])
            : halaman[0];
      process.stdout.write(`Memotret ${p} di ${cfg.width} px (${cfg.label})... `);
      const out = path.join(tmpDir, `${pageSlug(p)}-${cfg.width}-${a}.png`);
      const shot = await capturePage(browser, `${BASE_URL}${p}`, {
        width: cfg.width,
        deviceScaleFactor: cfg.deviceScaleFactor,
        out,
        action: a,
        mode,
      });
      shots.push({ ...shot, path: p, width: cfg.width, label: cfg.label });
      console.log("selesai");
    }

    const sheets = packSheets(buildSegments(shots));
    const hash = gitShortHash();
    for (const [i, rows] of sheets.entries()) {
      const no = i + 1;
      const title = `Rona Beauty, cuplik ${nama}`;
      const meta = [`lembar ${no} dari ${sheets.length}`, mode === "ringkas" ? "mode ringkas" : "mode penuh", labelWib(now), hash ? `commit ${hash}` : ""].filter(Boolean).join("  ·  ");
      const htmlPath = path.join(tmpDir, `lembar-${no}.html`);
      writeFileSync(htmlPath, sheetHtml({ title, meta, rows }));
      const out = path.join(OUT_DIR, `cuplik-${nama}-${stamp}-${no}.jpg`);
      const { bytes, quality } = await screenshotHtmlToJpeg(browser, htmlPath, out, { width: SHEET_WIDTH });
      outputs.push({ out, bytes, quality });
    }
  } finally {
    await browser.close();
    if (!args["simpan-mentah"]) rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\n${outputs.length} lembar dibuat di _review/:`);
  for (const o of outputs) {
    console.log(`  ${path.relative(process.cwd(), o.out)}  ${formatBytes(o.bytes)}${o.quality !== 80 ? `  (kualitas diturunkan ke ${o.quality})` : ""}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
