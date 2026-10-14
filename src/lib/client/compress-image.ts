// Kompres foto di browser: sisi terpanjang 1600 px, WebP (JPEG bila browser tidak bisa membuat WebP).
export async function compressImage(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  const webp = await toBlob("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg", 0.85);
  if (!jpeg) throw new Error("Foto tidak bisa diproses.");
  return jpeg;
}

// Unggah ke route admin; mengembalikan URL atau pesan galat.
export async function uploadAdminPhoto(file: File, jenis: "produk" | "banner"): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const blob = await compressImage(file);
    const fd = new FormData();
    fd.append("foto", new File([blob], blob.type === "image/webp" ? "foto.webp" : "foto.jpg", { type: blob.type }));
    const res = await fetch(`/api/admin/foto?jenis=${jenis}`, { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string };
    return data.ok && data.url ? { ok: true, url: data.url } : { ok: false, message: data.message ?? "Foto gagal diunggah." };
  } catch {
    return { ok: false, message: "Foto tidak bisa diproses. Coba foto lain." };
  }
}
