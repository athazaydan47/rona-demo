import { describe, expect, it } from "vitest";
import { checkPhoto, imageInfo } from "./image-info";
import { isSafeKey, photoKeyFromUrl, storageKind } from "./storage";

function png(w: number, h: number) {
  const b = new Uint8Array(40);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
function webpX(w: number, h: number) {
  const b = new Uint8Array(40);
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), ...Buffer.from("VP8X")]);
  const put24 = (o: number, v: number) => b.set([v & 255, (v >> 8) & 255, (v >> 16) & 255], o);
  put24(24, w - 1);
  put24(27, h - 1);
  return b;
}
function jpeg(w: number, h: number) {
  // SOI, APP0 (panjang 16), SOF0 dengan tinggi dan lebar.
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, ...new Array(9).fill(0)];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
}

describe("validasi foto ulasan di server", () => {
  it("membaca jenis dan dimensi dari isi file", () => {
    expect(imageInfo(png(800, 600))).toEqual({ type: "image/png", width: 800, height: 600 });
    expect(imageInfo(webpX(1600, 1200))).toEqual({ type: "image/webp", width: 1600, height: 1200 });
    expect(imageInfo(jpeg(1024, 768))).toEqual({ type: "image/jpeg", width: 1024, height: 768 });
    expect(imageInfo(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>                "))).toBeNull();
  });
  it("menolak file terlalu besar, terlalu lebar, terlalu kecil, atau jenis yang tidak cocok", () => {
    expect(checkPhoto(webpX(1600, 900), "image/webp")).toMatchObject({ ok: true, ext: "webp" });
    expect(checkPhoto(webpX(1601, 900))).toMatchObject({ ok: false });
    expect(checkPhoto(png(100, 100))).toMatchObject({ ok: false, message: "Foto terlalu kecil." });
    expect(checkPhoto(png(800, 600), "image/webp")).toMatchObject({ ok: false });
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(png(800, 600));
    expect(checkPhoto(big)).toMatchObject({ ok: false, message: expect.stringContaining("2 MB") });
  });
});

describe("adapter penyimpanan foto", () => {
  it("memilih Blob bila token ada, nonaktif di Vercel tanpa token, disk lokal saat dev", () => {
    expect(storageKind({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" })).toBe("blob");
    expect(storageKind({ VERCEL: "1" })).toBe("nonaktif");
    expect(storageKind({})).toBe("lokal");
  });
  it("hanya menerima URL foto hasil unggahan pembeli itu sendiri", () => {
    expect(isSafeKey("ulasan/12/abcdef0123456789.webp")).toBe(true);
    expect(isSafeKey("ulasan/12/../../etc/passwd")).toBe(false);
    expect(photoKeyFromUrl("/api/media/ulasan/12/abcdef0123456789.webp", 12)).toBe("ulasan/12/abcdef0123456789.webp");
    expect(photoKeyFromUrl("/api/media/ulasan/13/abcdef0123456789.webp", 12)).toBeNull();
    expect(photoKeyFromUrl("https://abc.public.blob.vercel-storage.com/ulasan/12/abcdef0123456789.webp", 12)).toBe("ulasan/12/abcdef0123456789.webp");
    expect(photoKeyFromUrl("https://jahat.example/ulasan/12/abcdef0123456789.webp", 12)).toBeNull();
  });
});
