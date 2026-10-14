// Gambar dari pembeli (foto wajah untuk kuis, screenshot untuk cari dupe). Hanya ada di memori selama satu
// permintaan: tidak ditulis ke disk, Blob, database, cache, atau log. Jenis berkas dicek dari isi (magic bytes),
// bukan dari nama atau tipe yang dikirim browser.

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // browser sudah memperkecil ke 1024 px, jadi biasanya di bawah 300 KB
export type ImageInput = { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string }; // data = base64

export function sniffImageType(bytes: Uint8Array): ImageInput["mimeType"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type ImageReadResult = { ok: true; images: ImageInput[] } | { ok: false; message: string };

// Ambil 1 sampai max berkas gambar dari FormData (nama kolom `field`).
export async function readImages(form: FormData, field: string, max: number): Promise<ImageReadResult> {
  const files = form.getAll(field).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return { ok: false, message: "Pilih foto dulu, ya." };
  if (files.length > max) return { ok: false, message: max === 1 ? "Cukup satu foto, ya." : `Maksimal ${max} gambar, ya.` };
  const images: ImageInput[] = [];
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) return { ok: false, message: "Ukuran foto terlalu besar. Coba foto lain, ya." };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mimeType = sniffImageType(bytes);
    if (!mimeType) return { ok: false, message: "Berkas ini bukan foto JPG, PNG, atau WebP." };
    images.push({ mimeType, data: Buffer.from(bytes).toString("base64") });
  }
  return { ok: true, images };
}
