// Perkecil foto di browser sebelum dikirim: sisi terpanjang maksimal 1024 px, disimpan ulang sebagai JPEG lewat
// canvas sehingga metadata EXIF (lokasi, waktu, perangkat) ikut terbuang. Arah foto dari EXIF diterapkan dulu.
export const MAX_SIDE = 1024;

export async function shrinkImage(file: File, maxSide = MAX_SIDE, quality = 0.86): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Berkas ini bukan foto.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("Format foto ini belum didukung. Coba foto JPG atau PNG, ya.");
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser ini belum bisa memproses foto.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Foto gagal diproses. Coba lagi, ya.");
  return blob;
}
