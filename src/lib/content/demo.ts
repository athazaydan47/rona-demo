// Teks khusus data demo (Fase 8B): bergantung pada isi seed, jadi diganti bersama seed untuk toko klien.

// Petunjuk kode voucher di kotak voucher keranjang (kode dari seed demo). Kosongkan untuk toko sungguhan.
export const PETUNJUK_VOUCHER = "Coba RONABARU, HEMAT15, ONGKIRRONA, atau LUMI10.";

// Fase 8C: contoh link TikTok publik untuk mencoba Tanya Rona (video lip tint, caption tanpa nama merek). Dicek dengan
// npm run cek:tiktok dan diperiksa ulang npm run uji:produksi lewat /api/sehat/tiktok. Ganti bila videonya dihapus.
export const CONTOH_LINK_TIKTOK = "https://www.tiktok.com/@louiseiya/video/7528744225001704711";

// Lima kalimat siap tekan di panduan demo dan halaman Tentang demo.
export const CONTOH_TANYA: { label: string; kalimat: string }[] = [
  { label: "Sunscreen kulit berminyak", kalimat: "Sunscreen buat kulit berminyak di bawah 100 ribu" },
  { label: "Padanan shade", kalimat: "Aku pakai cushion Pualam Velvet Matte 02N, yang setara apa?" },
  { label: "Link TikTok", kalimat: `Ada yang mirip ini? ${CONTOH_LINK_TIKTOK}` },
  { label: "Ongkir", kalimat: "Ongkir ke Bandung berapa?" },
  { label: "Kenali kulitku", kalimat: "Bantu aku pilih skincare" },
];
