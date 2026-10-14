// Pengenal niat berbasis aturan untuk chat asisten (Fase 8C). Fungsi murni: dijalankan sebelum model, sehingga link
// video, nomor pesanan, ongkir, kuis, rutinitas, padanan shade, info cabang, promo, dan bantuan selalu ditangani
// tanpa AI (tetap jalan saat AI mati atau kuota habis). Nomor pesanan dan nomor WA tidak pernah dikirim ke model.
import { POLA_NOMOR_PESANAN_DI_TEKS } from "@/config/merek";
import { findLinkInText, type LinkKind } from "@/lib/ai/oembed";
import type { TopikBantuan } from "./kartu";

export type Niat =
  | { jenis: "link"; raw: string; link: LinkKind }
  | { jenis: "lacak"; nomor: string | null; wa: string | null }
  | { jenis: "ongkir"; kota: string | null }
  | { jenis: "kuis" }
  | { jenis: "rutinitas" }
  | { jenis: "shade"; teks: string }
  | { jenis: "cocok"; teks: string }
  | { jenis: "cabang"; teks: string }
  | { jenis: "promo" }
  | { jenis: "bantuan"; topik: TopikBantuan }
  | { jenis: "video" };

const WA = /(?:\+?62|0)\s?8[\d\s-]{7,16}\d/;

export function nomorWaDiTeks(text: string): string | null {
  const m = WA.exec(text);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

// Kota tujuan setelah kata "ke" atau "tujuan", tanpa kata pengisi di ujung kalimat.
export function kotaDiTeks(input: string): string | null {
  const text = input.replace(/\b(kab|kota adm)\.\s*/gi, "$1 ");
  const m = /\b(?:ke|tujuan|kirim ke|sampai)\s+([a-z][a-z.\s]{2,40}?)(?:\s+(?:berapa|brp|dong|ya|kak|kira-kira|kira|sekitar|pakai|lewat|naik)\b|[?.,!]|$)/i.exec(text);
  if (!m) return null;
  const kota = m[1].trim().replace(/\s+/g, " ");
  return /^(rumah|alamat|aku|saya|kamu|sana|sini|mana)$/i.test(kota) ? null : kota;
}

export function kenaliNiat(input: string): Niat | null {
  const text = input.trim().slice(0, 600);
  if (!text) return null;
  const q = text.toLowerCase();

  const link = findLinkInText(text);
  if (link) return { jenis: "link", raw: link.raw, link: link.link };

  const nomor = POLA_NOMOR_PESANAN_DI_TEKS.exec(text)?.[0]?.toUpperCase() ?? null;
  if (nomor) return { jenis: "lacak", nomor, wa: nomorWaDiTeks(text.replace(nomor, " ")) };
  if (/\b(lacak|tracking|resi)\b|status pesanan|pesanan(ku| saya)\b.*\b(di ?mana|sampai mana|kapan|sudah|udah)|cek pesanan/.test(q)) return { jenis: "lacak", nomor: null, wa: nomorWaDiTeks(text) };

  // Produk dari video atau postingan tanpa link: minta link atau screenshot, jangan menebak produknya.
  if (/\b(video|tiktok|reels?|youtube|shorts|postingan|konten)\b/.test(q) && /\b(lupa|namanya|produk apa|yang dipakai|yang dipake|mirip|cari(in|kan)?|ada (ga|gak|nggak|tidak)|bisa (bantu|dicari))\b/.test(q)) return { jenis: "video" };

  if (/\b(ongkir|ongkos kirim|biaya kirim|biaya pengiriman)\b/.test(q)) return { jenis: "ongkir", kota: kotaDiTeks(text) };

  if (/\b(kuis|quiz)\b|kenali kulit|kenalan sama kulit|tes kulit|jenis kulit(ku| saya)? (apa|yang mana)|bantu (aku |saya )?pilih(in)? skincare|bingung (pilih|mulai) skincare/.test(q)) return { jenis: "kuis" };
  if (/\b(rutinitas|routine)\b|urutan skincare|susun(in|kan)? skincare/.test(q)) return { jenis: "rutinitas" };

  if (/\bpadanan|\bsetara|shade.{0,40}\b(sama|mirip|setara|pengganti|padanannya)\b|pindah merek|ganti merek.{0,20}shade/.test(q)) return { jenis: "shade", teks: text };
  if (/\b(cocok|aman|pas)\b.{0,12}\b(buat|untuk|di|sama)\b.{0,6}\bkulit(ku| saya| aku)?\b/.test(q) && !/\b(rekomendasi|carikan|cariin|apa saja|yang mana)\b/.test(q)) return { jenis: "cocok", teks: text };

  if (/jam (buka|tutup|operasional)|buka (jam|sampai|hari)|alamat (toko|cabang)|\bcabang\b|toko (fisik|offline)|lokasi toko|\brute\b|ambil di toko di mana/.test(q)) return { jenis: "cabang", teks: text };
  if (/flash ?sale|\bpromo\b|\bvoucher\b|kode (promo|diskon)/.test(q)) return { jenis: "promo" };

  if (/\b(retur|refund|tukar barang|kembalikan barang|barang (rusak|salah)|salah kirim)\b/.test(q)) return { jenis: "bantuan", topik: "retur" };
  if (/cara (bayar|pembayaran)|metode (bayar|pembayaran)|bisa bayar|bayar (pakai|pake|lewat|di tempat)|\bcod\b|\bqris\b|virtual account/.test(q)) return { jenis: "bantuan", topik: "bayar" };
  if (/kapan dikirim|dikirim kapan|jam (kirim|pengiriman)|\bcut ?off\b|berapa lama (sampai|pengiriman)|estimasi (sampai|tiba)/.test(q)) return { jenis: "bantuan", topik: "kirim" };
  if (/\b(hubungi|kontak|customer service|nomor (wa|whatsapp) (toko|admin|cs))\b|\bcs\b/.test(q)) return { jenis: "bantuan", topik: "kontak" };
  return null;
}
