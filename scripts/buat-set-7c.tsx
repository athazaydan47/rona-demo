// Set uji sintetis Fase 7C, tanpa foto orang sungguhan dan tanpa gambar merek nyata:
// - "screenshot" produk Rona dari ProductArt sendiri dengan latar dan caption buatan;
// - produk generik tanpa merek (jalur "tidak dijual, ini yang mirip");
// - wajah ilustrasi sederhana (bukan foto orang) dan versi gelap untuk jalur foto kuis.
//   npx tsx scripts/buat-set-7c.tsx
// Hasil: evals/7c/gambar/*.jpg (dipakai npm run eval:ai dan uji Playwright) dan evals/7c/sidik.json: sidik
// thumbnail warna tiap screenshot plus kunci jawabannya, dipakai model mock untuk "mengenali" screenshot sintetis.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { ProductArtInline as ProductArt } from "@/components/product-art/inline";
import { imageSignature } from "@/lib/ai/mock-vision";
import type { Packaging } from "@/db/schema/enums";

const OUT = path.join(process.cwd(), "evals/7c/gambar");
const W = 540;
const H = 900;

type Shot = { file: string; jawaban: Record<string, unknown>; packaging: Packaging; shade: string; brandColor: string; brandName: string; caption: string[]; user: string; bg: [string, string] };

// Warna shade dan merek sama persis dengan data seed (lihat src/db/seed).
const SHOTS: Shot[] = [
  { file: "lumi-velvet-merah-ceri.jpg", jawaban: { kategori: "lipstick", jenisProduk: "lipstik matte", warnaHex: "#A91C32", finish: "matte", merek: "Lumi", namaProduk: "Lumi Velvet Matte Lipstick", kataKunci: ["merah ceri"], keyakinan: "tinggi" }, packaging: "lipstick", shade: "#A91C32", brandColor: "#C2416B", brandName: "Lumi", caption: ["Lumi Velvet Matte Lipstick", "shade 06 Merah Ceri, matte banget!"], user: "@kak.rona.demo", bg: ["#F6E9E4", "#EBD3CB"] },
  { file: "lumi-juicy-mangga.jpg", jawaban: { kategori: "lip-tint", jenisProduk: "lip tint", warnaHex: "#E58358", finish: "glowy", merek: "Lumi", namaProduk: null, kataKunci: ["tint"], keyakinan: "sedang" }, packaging: "lip_tint", shade: "#E58358", brandColor: "#C2416B", brandName: "Lumi", caption: ["tint jeruk segar buat sehari-hari"], user: "@review.lokal.demo", bg: ["#FFF4E6", "#F7DCC2"] },
  { file: "pualam-blush-berry.jpg", jawaban: { kategori: "blush", jenisProduk: "blush krim", warnaHex: "#B2516E", finish: null, merek: "Pualam", namaProduk: "Pualam Cream Blush", kataKunci: ["berry"], keyakinan: "tinggi" }, packaging: "cream_jar", shade: "#B2516E", brandColor: "#B98A6A", brandName: "Pualam", caption: ["Pualam Cream Blush warna Berry", "dipakai tipis-tipis aja"], user: "@pipi.merona.demo", bg: ["#F3ECF5", "#E2D3E8"] },
  { file: "kirana-niacinamide.jpg", jawaban: { kategori: "serum-dan-essence", jenisProduk: "serum", warnaHex: null, finish: null, merek: "Kirana Lab", namaProduk: "Kirana Lab Niacinamide 10% Serum", kataKunci: ["niacinamide"], keyakinan: "tinggi" }, packaging: "serum_dropper", shade: "#D9EBE7", brandColor: "#2F5D62", brandName: "Kirana Lab", caption: ["Kirana Lab Niacinamide 10% Serum", "rutin pagi aku"], user: "@skincare.demo", bg: ["#EEF5F3", "#D6E7E2"] },
  { file: "surya-gel-sunscreen.jpg", jawaban: { kategori: "sunscreen-wajah", jenisProduk: "sunscreen gel", warnaHex: null, finish: null, merek: null, namaProduk: null, kataKunci: ["sunscreen", "gel"], keyakinan: "sedang" }, packaging: "sunscreen_tube", shade: "#FBE7B8", brandColor: "#E0A227", brandName: "Surya Shield", caption: ["sunscreen gel ringan SPF 50"], user: "@anti.gosong.demo", bg: ["#FFF8E8", "#F5E3B8"] },
  // Produk generik tanpa merek: tidak dijual Rona, harus diarahkan ke yang paling mirip.
  { file: "generik-lipstik-merah.jpg", jawaban: { kategori: "lipstick", jenisProduk: "lipstik matte", warnaHex: "#B0302E", finish: "matte", merek: null, namaProduk: null, kataKunci: ["merah bata"], keyakinan: "sedang" }, packaging: "lipstick", shade: "#B0302E", brandColor: "#8C8C8C", brandName: "", caption: ["lipstik merah bata favorit,", "matte dan tahan lama"], user: "@random.demo", bg: ["#F2EEEC", "#E0D8D4"] },
  { file: "generik-cushion.jpg", jawaban: { kategori: "cushion", jenisProduk: "cushion", warnaHex: "#D9A77E", finish: "glowy", merek: null, namaProduk: null, kataKunci: ["cushion"], keyakinan: "sedang" }, packaging: "cushion", shade: "#D9A77E", brandColor: "#9A9A9A", brandName: "", caption: ["cushion viral hasil glowing", "buat kulit kuning langsat"], user: "@random.demo", bg: ["#F7F1EA", "#E9DCCD"] },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function screenshotSvg(s: Shot) {
  const art = renderToStaticMarkup(<ProductArt packaging={s.packaging} shade={s.shade} brandColor={s.brandColor} brandName={s.brandName} background="none" width={360} />)
    .replace(/^<svg /, '<svg x="90" y="150" ')
    .replace(/ class="[^"]*"/, "")
    .replace(/ style="[^"]*"/, "");
  const lines = s.caption.map((c, i) => `<text x="36" y="${640 + i * 40}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#2A1F1D">${esc(c)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.bg[0]}"/><stop offset="1" stop-color="${s.bg[1]}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="64" fill="#FFFFFF" opacity="0.85"/>
  <circle cx="40" cy="32" r="16" fill="#D8CFCB"/>
  <text x="66" y="40" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#2A1F1D">${esc(s.user)}</text>
  ${art}
  ${lines}
  <text x="36" y="${H - 40}" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#6E615D">♡ 12,4 rb   💬 318   ↗ bagikan</text>
</svg>`;
}

// Wajah ilustrasi (bukan foto orang): oval warna kulit, rambut, mata, alis, bibir, sedikit kilap di dahi dan hidung.
function faceSvg(dark: boolean) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#E9E4DF"/>
  <ellipse cx="300" cy="300" rx="230" ry="250" fill="#3B2A24"/>
  <rect x="235" y="600" width="130" height="200" fill="#C9966C"/>
  <ellipse cx="300" cy="420" rx="190" ry="250" fill="#CFA077"/>
  <path d="M110 330 C140 170 460 170 490 330 C430 250 170 250 110 330Z" fill="#3B2A24"/>
  <ellipse cx="300" cy="300" rx="60" ry="18" fill="#FFFFFF" opacity="0.35"/>
  <ellipse cx="300" cy="460" rx="14" ry="40" fill="#FFFFFF" opacity="0.28"/>
  <path d="M205 375 q30 -16 60 0" stroke="#3B2A24" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M335 375 q30 -16 60 0" stroke="#3B2A24" stroke-width="7" fill="none" stroke-linecap="round"/>
  <ellipse cx="235" cy="410" rx="22" ry="12" fill="#FFFFFF"/><circle cx="235" cy="410" r="9" fill="#3B2A24"/>
  <ellipse cx="365" cy="410" rx="22" ry="12" fill="#FFFFFF"/><circle cx="365" cy="410" r="9" fill="#3B2A24"/>
  <circle cx="230" cy="520" r="6" fill="#B5704F" opacity="0.7"/><circle cx="380" cy="505" r="5" fill="#B5704F" opacity="0.7"/>
  <path d="M255 580 q45 26 90 0 q-45 -10 -90 0Z" fill="#A9545A"/>
  ${dark ? '<rect width="600" height="800" fill="#000000" opacity="0.82"/>' : ""}
</svg>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const gambar: { berkas: string; sidik: string; jawaban: Record<string, unknown> }[] = [];
  for (const s of SHOTS) {
    const buf = await sharp(Buffer.from(screenshotSvg(s))).jpeg({ quality: 90 }).toBuffer();
    writeFileSync(path.join(OUT, s.file), buf);
    gambar.push({ berkas: s.file, sidik: await imageSignature(buf.toString("base64")), jawaban: s.jawaban });
    console.log(`${s.file} ${(buf.length / 1024).toFixed(0)} KB`);
  }
  writeFileSync(path.join(OUT, "../sidik.json"), `${JSON.stringify({ keterangan: "Sidik thumbnail warna screenshot sintetis dan kunci jawabannya (dibuat scripts/buat-set-7c.tsx). Dipakai model mock.", gambar }, null, 2)}\n`);
  for (const [file, dark] of [["wajah-ilustrasi.jpg", false], ["wajah-gelap.jpg", true]] as const) {
    const buf = await sharp(Buffer.from(faceSvg(dark))).jpeg({ quality: 88 }).toBuffer();
    writeFileSync(path.join(OUT, file), buf);
    console.log(`${file} ${(buf.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
