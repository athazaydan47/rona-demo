// Membaca jenis dan dimensi gambar dari byte awal (tanpa pustaka), untuk validasi unggahan di server.
export type ImageInfo = { type: "image/webp" | "image/jpeg" | "image/png"; width: number; height: number };

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_MIN_SIDE = 160;

export function imageInfo(b: Uint8Array): ImageInfo | null {
  if (b.length < 30) return null;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  const u16le = (o: number) => b[o] | (b[o + 1] << 8);
  const u24le = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const u16be = (o: number) => (b[o] << 8) | b[o + 1];
  const u32be = (o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 " && b.length >= 30) return { type: "image/webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X" && b.length >= 30) return { type: "image/webp", width: u24le(24) + 1, height: u24le(27) + 1 };
    return null;
  }
  if (b[0] === 0x89 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") return { type: "image/png", width: u32be(16), height: u32be(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1];
      const len = u16be(o + 2);
      // SOF0 sampai SOF15 kecuali DHT (C4), JPG (C8), DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "image/jpeg", height: u16be(o + 5), width: u16be(o + 7) };
      }
      o += 2 + len;
    }
    return null;
  }
  return null;
}

export type PhotoCheck = { ok: true; info: ImageInfo; ext: "webp" | "jpg" | "png" } | { ok: false; message: string };

// Aturan unggah foto ulasan: WebP, JPEG, atau PNG; maksimal 2 MB; sisi terpanjang maksimal 1600 px.
export function checkPhoto(bytes: Uint8Array, declaredType?: string): PhotoCheck {
  if (bytes.length === 0) return { ok: false, message: "File kosong." };
  if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, message: "Foto terlalu besar. Maksimal 2 MB." };
  const info = imageInfo(bytes);
  if (!info) return { ok: false, message: "Format foto tidak dikenali. Pakai JPG, PNG, atau WebP." };
  if (declaredType && declaredType !== info.type) return { ok: false, message: "Jenis file tidak cocok dengan isinya." };
  if (Math.max(info.width, info.height) > PHOTO_MAX_SIDE) return { ok: false, message: `Foto maksimal ${PHOTO_MAX_SIDE} px di sisi terpanjang.` };
  if (Math.min(info.width, info.height) < PHOTO_MIN_SIDE) return { ok: false, message: "Foto terlalu kecil." };
  return { ok: true, info, ext: info.type === "image/webp" ? "webp" : info.type === "image/png" ? "png" : "jpg" };
}
