// Penjaga tebak kode voucher (Fase 8B). Checkout memberi tahu apakah sebuah kode ada, jadi tanpa batas kode voucher
// bisa ditebak beruntun. Yang dihitung adalah kode berbeda yang salah per IP (kode salah yang sama dihitung sekali,
// supaya pembeli yang mengganti kurir tidak ikut terkena). Setelah batas, semua kode diperlakukan sebagai tidak bisa
// diperiksa sampai jendela berakhir.
import type { AnyDb } from "@/lib/db-types";
import { BATAS, hashKey, hitSaatIni, rateLimit } from "@/lib/security/rate-limit";

export const PESAN_VOUCHER_TERBATAS = "Terlalu banyak kode voucher yang salah. Coba lagi dalam 10 menit, ya.";

const kunci = (ipKey: string) => `voucher-salah:${ipKey}`;

export async function voucherTerblokir(db: AnyDb, ipKey: string, now = new Date()) {
  const b = BATAS.voucherSalahPerIp;
  return (await hitSaatIni(db, kunci(ipKey), b.windowMs, now)) >= b.limit;
}

export async function catatVoucherSalah(db: AnyDb, ipKey: string, code: string, now = new Date()) {
  const b = BATAS.voucherSalahPerIp;
  const sekali = await rateLimit(db, `voucher-coba:${ipKey}:${hashKey(code.trim().toUpperCase())}`, 1, b.windowMs, now);
  if (sekali.hits === 1) await rateLimit(db, kunci(ipKey), b.limit, b.windowMs, now);
}
