// "Penglihatan" model mock (AI_PROVIDER=mock) untuk uji, Playwright, dan cuplik. Deterministik dan tanpa internet:
// - foto wajah: kecerahan dan warna rata-rata bagian tengah foto (gelap atau cukup, kedalaman terdekat);
// - screenshot produk: mengenali screenshot sintetis dari set uji (evals/7c) lewat sidik thumbnail warna; bukan
//   pengenalan sungguhan, cukup untuk menguji alur dengan gambar dari ProductArt sendiri.
// Hanya dipakai saat mock. Gambar tetap hanya di memori.
import { depthLabels } from "@/lib/shade";
import { deltaE, hexToLab, type Lab } from "@/lib/skin/shade";
import type { ImageInput } from "./images";

type Pixels = { labs: Lab[]; mean: { r: number; g: number; b: number }; luminance: number };

async function readPixels(img: ImageInput, size = 160, center = false): Promise<Pixels> {
  const sharp = (await import("sharp")).default;
  let pipe = sharp(Buffer.from(img.data, "base64")).removeAlpha();
  if (center) {
    const meta = await sharp(Buffer.from(img.data, "base64")).metadata();
    const w = meta.width ?? size;
    const h = meta.height ?? size;
    pipe = pipe.extract({ left: Math.round(w * 0.3), top: Math.round(h * 0.3), width: Math.max(1, Math.round(w * 0.4)), height: Math.max(1, Math.round(h * 0.4)) });
  }
  const { data } = await pipe.resize(size, size, { fit: "inside", kernel: "nearest" }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();
  let r = 0;
  let g = 0;
  let b = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    const key = `#${[data[i], data[i + 1], data[i + 2]].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const labs: Lab[] = [];
  for (const [hex, c] of counts) {
    const lab = hexToLab(hex);
    for (let k = 0; k < c; k++) labs.push(lab);
  }
  const mean = { r: r / n, g: g / n, b: b / n };
  return { labs, mean, luminance: 0.2126 * mean.r + 0.7152 * mean.g + 0.0722 * mean.b };
}

const toHex = (c: { r: number; g: number; b: number }) => `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

export async function mockSkinReading(img: ImageInput) {
  const px = await readPixels(img, 96, true);
  const low = (nilai: unknown) => ({ nilai, keyakinan: "rendah" });
  if (px.luminance < 50) return { kualitas: "gelap", kilap: low("tidak"), kering: low("tidak"), kemerahan: low("tidak"), noda: low("tidak"), kedalaman: low(3), undertone: low("neutral") };
  const lab = hexToLab(toHex(px.mean));
  const depth = [...depthLabels].sort((a, b) => deltaE(lab, hexToLab(a.hex)) - deltaE(lab, hexToLab(b.hex)))[0].depth;
  // Nilai tetap supaya alur bisa diuji: undertone sengaja berkeyakinan rendah (tidak diisi otomatis).
  return {
    kualitas: "cukup",
    kilap: { nilai: "jelas", keyakinan: "tinggi" },
    kering: { nilai: "tidak", keyakinan: "sedang" },
    kemerahan: { nilai: "sedikit", keyakinan: "rendah" },
    noda: { nilai: "ada", keyakinan: "sedang" },
    kedalaman: { nilai: depth, keyakinan: "sedang" },
    undertone: { nilai: "warm", keyakinan: "rendah" },
  };
}

// Sidik gambar: thumbnail warna 16x16 (768 byte, hex). Tahan kompresi ulang JPEG dan pengecilan di browser.
export async function imageSignature(data: string): Promise<string> {
  const sharp = (await import("sharp")).default;
  const raw = await sharp(Buffer.from(data, "base64")).removeAlpha().resize(16, 16, { fit: "fill" }).raw().toBuffer();
  return raw.toString("hex");
}

// Rata-rata selisih absolut per kanal (0 sampai 255).
export function signatureDistance(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  if (x.length !== y.length) return 255;
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  return sum / x.length;
}

export const SIGNATURE_MATCH = 3;

export type VisionFixture = { berkas: string; sidik: string; jawaban: Record<string, unknown> };

// Screenshot sintetis yang dikenal (evals/7c/sidik.json, dibuat scripts/buat-set-7c.tsx) dijawab sesuai kunci
// jawabannya. Gambar lain dianggap tidak dikenali (keyakinan rendah).
export async function mockDupeFromImages(images: ImageInput[], fixtures: VisionFixture[]) {
  for (const img of images) {
    const sig = await imageSignature(img.data);
    const hit = fixtures.map((f) => ({ f, d: signatureDistance(f.sidik, sig) })).sort((a, b) => a.d - b.d)[0];
    if (hit && hit.d <= SIGNATURE_MATCH) return hit.f.jawaban;
  }
  return { kategori: null, jenisProduk: "", warnaHex: null, finish: null, merek: null, namaProduk: null, kataKunci: [], keyakinan: "rendah" };
}
