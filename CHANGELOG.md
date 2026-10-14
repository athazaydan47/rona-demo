# Catatan perubahan

Semua perubahan penting Rona per fase. Versi mengikuti `package.json`. Data toko di semua versi fiktif.

## 1.0.0-demo (Fase 8B), 15 Okt 2026

Pengerasan, reskin, dan dokumentasi untuk rilis demo publik.

**Data uji tidak bocor lagi**
- Vitest memakai database `<nama>_uji` dan Playwright memakai `<nama>_e2e`, keduanya disiapkan ulang setiap kali uji jalan. Database kerja hanya berisi seed.
- `cek:data`, `cuplik`, dan `aset:portofolio` menolak jalan bila ada data bernama uji. `/api/sehat` melaporkan jumlahnya.

**Keamanan**
- Content Security Policy lengkap, ditegakkan setelah audit mode laporan tanpa pelanggaran.
- Uji otorisasi menyeluruh: semua aksi admin dan akun dipanggil tanpa sesi dan dengan staf tanpa izin.
- Skema zod di semua batas server action.
- Batas laju di Postgres untuk lacak pesanan, unggah foto, dan tafsiran shade (sekaligus memperbaiki galat serialisasi tanggal yang membuat fitur itu gagal). Penjaga tebak kode voucher di checkout.
- Dimensi gambar AI diperiksa dari isi berkas. Atribut cookie seragam. `X-Powered-By` dimatikan. `security.txt`.
- Pemindai rahasia riwayat git (`npm run cek:rahasia`). `npm audit` produksi nol temuan.

**Keandalan**
- `/api/sehat` untuk pemantau uptime. Log terstruktur dengan penyamaran nomor WA dan email. Pelacakan galat opsional lewat `SENTRY_DSN`.
- Peringatan di Dashboard Owner bila cron harian gagal atau tidak berjalan lebih dari 26 jam.
- Log aktivitas menampilkan nama lokasi, varian, staf, dan pelanggan, bukan id.
- Asisten Admin selalu bertanya balik bila pertanyaan menyebut hari raya tanpa tanggal, tanpa bergantung pada model.

**Mesin reskin**
- `src/config/merek.ts` (nama, palet, kontak, studio, teks demo), `src/config/font.ts`, dan uji yang menolak nama merek di kode lain.
- Sakelar fitur untuk AI pembeli, AI foto dan link, Asisten Admin, flash sale, poin, Ambil di Toko, dan banyak cabang.
- Konten toko dipisah ke `src/lib/content`.
- `npm run impor:katalog` dari CSV dengan pemeriksaan tanpa menulis, laporan baris gagal, dan stok awal lewat modul inventory.

**Kecepatan**
- Motion lewat `LazyMotion` dan animasi sederhana dengan CSS. Panel Advisor, laci keranjang, menu HP, tambah cepat, dan MegaMenu dimuat saat dibutuhkan.
- Kerangka halaman produk statis dengan judul dan gambar. Lighthouse HP halaman produk naik dari 79 ke lebih dari 90.

**Alat dan dokumen**
- `npm run uji:produksi` (uji asap hanya-baca), `npm run test:cakupan`, `npm run aset:portofolio`.
- Dokumen baru: README, ARSITEKTUR, KEAMANAN, OPERASIONAL, RESKIN, KEPUTUSAN, STUDI-KASUS, dan catatan perubahan ini.

## Fase 8A, 14 Okt 2026

Poles pengalaman, gerak, kecepatan, dan konten.

- Audit 400 pemeriksaan: kontras AA, label aksesibilitas, keyboard untuk pemilih shade dan kanban, sasaran sentuh minimal 32 px.
- Token gerak dan animasi: terbang ke keranjang, badge berdenyut, laci dan sheet usap, flip hitung mundur, kanban terangkat, angka naik bertahap. Semua menghormati gerak dikurangi.
- `ProductArt` sebagai gambar `/art`: HTML beranda turun dari 2.458 KB ke sekitar 790 KB.
- Halaman 404 dan galat bermerek, delapan halaman bantuan, perayap tautan internal, etalase Tentang demo, panduan demo 5 menit.
- WebKit dan axe di Playwright.

## Fase 7B, 14 Okt 2026

Asisten AI untuk owner dan staf.

- Asisten Admin dengan tool baca yang disaring izin, penerjemah periode WIB, dan penjaga angka.
- Saran transfer stok dan flash sale menjadi draf. Penulis deskripsi dengan pemeriksa klaim. Draf balasan ulasan.
- Kabar Harian, tab Rona Advisor dan Kesehatan AI di Laporan, tarif AI di satu konfigurasi.

## Fase 7C, 14 Okt 2026

AI dari foto dan link.

- Bantu isi kuis kulit dari foto dengan persetujuan. Cari produk mirip dari link TikTok atau YouTube dan dari screenshot.
- Halaman kebijakan privasi. Set uji sintetis dan evaluasi 7C.
- Advisor dengan alasan per kartu, penjaga harga, dan teks dialirkan per kalimat. Pencarian kalimat tidak lagi menyaring habis.

## Fase 7A, 14 Okt 2026

AI untuk pembeli.

- Rona Advisor dengan tool katalog dan validasi server. Pencarian kalimat dengan chip tafsiran.
- Padanan shade, kuis kulit, rutinitas berbasis aturan, ringkasan ulasan AI, dan evaluasi Advisor.

## Fase 6C, 14 Okt 2026

Ulasan, pelanggan, laporan, email.

- Modul laporan sebagai satu sumber angka untuk Dashboard, halaman Laporan, dan Excel.
- Moderasi ulasan dengan balasan toko. Pelanggan dengan segmen, penyesuaian poin, dan penyamaran kontak.
- Adapter email (pratinjau atau Resend) dengan allowlist demo dan kunci idempoten.

## Fase 6B, 14 Okt 2026

Katalog, promo, pengaturan, data riwayat.

- Formulir produk dengan pratinjau `ProductArt`, pohon kategori dan merek, promo (kalender flash sale, harga promo, voucher, banner, PromoBar).
- Pengaturan toko dan cabang yang dibaca logika. Riwayat penjualan 90 hari. Migrasi otomatis saat build produksi.

## Fase 6A, 14 Okt 2026

Panel admin inti.

- Masuk staf dengan scrypt dan kunci sementara. Izin berbasis kunci dengan empat peran templat dan cakupan lokasi.
- Dashboard, kanban pesanan sesuai aturan status, label kirim dan daftar ambil PDF, matriks stok, stok masuk, transfer, opname, log aktivitas.
- Reset harian demo.

## Fase 5, 14 Okt 2026

Akun pembeli, poin, ulasan.

- Masuk dengan nomor WA dan OTP. Sesi dengan token yang disimpan sebagai hash.
- Akun: pesanan, alamat, wishlist, poin, profil kulit, Kotak Notifikasi, Kabari aku.
- Poin dengan buku besar idempoten. Ulasan terverifikasi dengan foto.

## Fase 4, 14 Okt 2026

Keranjang, checkout, pembayaran, pesanan.

- Keranjang di server, mesin harga murni, voucher dengan pesan per alasan, ongkir per zona.
- Checkout kirim dan Ambil di Toko, peta alamat, pembayaran simulasi, webhook bertanda tangan.
- Halaman pesanan dengan status, kedaluwarsa bayar, cron harian. Panduan deploy Vercel dan Neon.

## Fase 3, 13 Okt 2026

Halaman produk: galeri `ProductArt`, pemilih shade dengan perbandingan, stok per cabang, flash sale, ulasan, produk serupa, 404 sungguhan.

## Fase 2, 13 Okt 2026

Etalase, katalog, dan pencarian: beranda lengkap, katalog berfacet, pencarian tahan salah ketik, merek, jurnal.

## Fase 1, 13 Okt 2026

Fondasi: Next.js, Tailwind, skema Drizzle, migrasi dengan `pg_trgm`, seed deterministik 12 merek fiktif dan 79 produk, komponen `ProductArt`, Vitest dan Playwright.
