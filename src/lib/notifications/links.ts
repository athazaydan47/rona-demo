// Isi notifikasi menyimpan tautan relatif (misal /pesanan/RONA-2610-000001?t=...). Alamat situs ditambahkan
// saat pesan ditampilkan atau dikirim, supaya data seed tidak membawa alamat mesin yang membuatnya.
// Data lama yang terlanjur berisi http://localhost:3000 juga ikut dibetulkan.
const LOCAL = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?=\/)/g;
const RELATIVE = /(^|[\s(:])(\/(?:pesanan|bayar|p|akun|lacak)\/[^\s)]*)/g;

export function absoluteLinks(text: string, site: string) {
  const base = site.replace(/\/$/, "");
  return text.replace(LOCAL, "").replace(RELATIVE, (_m, lead: string, path: string) => `${lead}${base}${path}`);
}
