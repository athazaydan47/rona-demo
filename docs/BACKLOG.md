# Backlog

Pekerjaan yang sengaja ditunda, dengan alasannya. Butir yang sudah selesai ada di CHANGELOG.md. Dibersihkan di Fase 8B (rilis 1.0.0-demo).

- **Untuk toko sungguhan**: wajib atau sangat disarankan sebelum kode ini dipakai toko dengan pembeli, uang, dan katalog nyata. Tidak dikerjakan sekarang karena demo tidak membutuhkannya atau karena bergantung pada akun pihak ketiga milik klien.
- **Nanti**: perbaikan yang berguna tetapi tidak menghambat demo maupun toko sungguhan.

Tambahkan butir baru di kelompok yang sesuai, satu butir per baris, dengan fase saat ditemukan dan alasan penundaan.

## Untuk toko sungguhan

### Pembayaran, WhatsApp, dan email

- **Payment gateway resmi.** Pembayaran masih simulasi. Pintu `confirmPayment` dan webhook bertanda tangan sudah ada, adapter gateway belum (langkah di docs/RESKIN.md). Alasan: butuh akun gateway milik klien. (Fase 4)
- **WhatsApp Business Platform resmi untuk OTP dan notifikasi.** Di luar mode demo, masuk pembeli dinonaktifkan dan notifikasi WA hanya pratinjau. Antarmuka `OtpSender` dan `WhatsAppSender` sudah disiapkan. Alasan: butuh verifikasi bisnis Meta milik klien. (Fase 5)
- **Pintu WA Asisten Admin dan Kabar Harian ke WA owner.** Penerjemah pesan sudah ada (`src/lib/asisten/pintu/wa.ts`), pemetaan nomor ke staf dan penyedia belum. Alasan: sama dengan butir di atas. (Fase 7B)
- **Status email dari Resend (terpantul, spam).** Status Terkirim berarti diterima Resend, belum tentu sampai. Alasan: butuh webhook Resend dan domain klien. (Fase 6C)
- **Antrean notifikasi diproses lebih sering.** Notifikasi yang dibuat saat halaman dibuka (kedaluwarsa bayar, Selesai otomatis) baru terkirim pada aksi berikutnya atau cron harian. Alasan: cukup untuk demo; toko dengan WA sungguhan butuh antrean per menit. (Fase 6C)

### Skala katalog dan data

- **Filter, facet, urutan, dan paginasi katalog di SQL.** Saat ini dihitung di memori dari seluruh produk dalam cakupan (`buildCatalogResult`). Pertahankan `filters.test.ts` dan `facets.test.ts` sebagai spesifikasi. Alasan: cepat dan sederhana untuk 79 produk, tidak untuk ribuan. (Fase 2)
- **Kartu produk tanpa daftar varian lengkap.** Kartu mengirim semua varian untuk tambah cepat (sekitar 30 KB di beranda, lebih untuk cushion 10 shade). Muat varian saat tambah cepat dibuka. Alasan: dikerjakan bersama pemindahan katalog ke SQL. (Fase 2, Fase 8A)
- **Matriks stok dan opname di SQL.** Seluruh varian dimuat lalu disaring di memori. Alasan: cukup untuk 228 varian demo. (Fase 6A)
- **Agregasi laporan dan segmen pelanggan di SQL.** Laporan memuat semua pesanan periode ke memori, segmen dihitung saat daftar dibuka. Pertahankan `reports.test.ts` sebagai spesifikasi. Alasan: cukup untuk ribuan pesanan per tahun. (Fase 6C)
- **Data kecamatan di luar Jawa Timur dan validasi kode pos.** Provinsi lain mengisi kecamatan bebas. Alasan: toko demo di Malang. (Fase 4)
- **Seed minimal untuk toko sungguhan** (kategori, lokasi, pengaturan, Owner) tanpa data demo. Alasan: dibuat sekali di proyek klien pertama (docs/RESKIN.md langkah 4). (Fase 8B)

### Operasional dan keamanan

- **Perlindungan bot di tepi** (Vercel Firewall atau Cloudflare). Batas laju untuk hitung ulang checkout, saran pencarian, katalog JSON, dan laporan CSP ada di memori per instance. Alasan: titik yang rawan ditebak sudah dibatasi di Postgres; sisanya cukup untuk demo. (Fase 8B)
- **Cadangan Neon dengan masa simpan cukup dan latihan pemulihan.** Paket gratis hanya menyimpan riwayat singkat. Alasan: data demo bisa dibuat ulang dengan reset. (Fase 8B)
- **Dua faktor untuk staf.** Alasan: akun demo sengaja bisa dimasuki semua pengunjung. (Fase 8B)
- **Pesan galat bawaan kerangka bisa memuat parameter query** (misal nomor WA) di log Vercel. Log aplikasi dan Sentry sudah disamarkan. Bungkus galat database supaya parameternya tidak ikut. Alasan: data demo fiktif. (Fase 5, Fase 8B)
- **Pantau batas koneksi Neon.** Pool aplikasi 5 koneksi per instance. Alasan: trafik demo kecil. (Fase 4.1)
- **Penguncian optimistis per baris di formulir admin.** Saat dua staf mengubah produk atau pengaturan bersamaan, yang terakhir menang. Alasan: demo jarang dipakai bersamaan. (Fase 6B)
- **Pembersihan berkala foto yatim di Blob** (foto ulasan batal dikirim, foto produk yang diganti atau dihapus). Alasan: reset demo menghapusnya tiap malam. (Fase 5, Fase 6B)
- **Penyedia ubin peta dengan kunci** atau server ubin sendiri, sesuai kebijakan OpenStreetMap untuk trafik nyata. Alasan: trafik demo kecil. (Fase 4)
- **Log Cloudflare AI Gateway tanpa isi percakapan teks.** Permintaan berisi gambar sudah tanpa isi. Matikan payload log di pengaturan gateway. Alasan: berguna untuk memantau gangguan saat demo. (Fase 7C)
- **Pembaca video YouTube Gemini masih pratinjau.** Bila berubah atau berbayar, ekstraksi jatuh ke judul saja. Alasan: fitur pratinjau pihak ketiga. (Fase 7C)
- **Laju jual cabang dari data kasir.** Saran transfer memakai lokasi pesanan sebagai lokasi penjualan. Alasan: belum ada kasir di toko. (Fase 7B)
- **Label kirim dengan font TTF.** Font standar PDF membuang karakter di luar Latin-1. Alasan: nama dan alamat demo berhuruf Latin. (Fase 6A)

## Nanti

### Kecepatan

- **Lighthouse HP katalog 86 di simulasi lokal** (HTTP/1.1, target 91). Penyebab: gambar LCP ada di grid yang dialirkan, dan simulasi Lighthouse menghitung semua JS di head dengan batas 6 koneksi HTTP/1.1. Dengan HTTP/2 dan throttling devtools skornya 90 ke atas. Alasan: ukur ulang dari Vercel (HTTP/2) sebelum mengubah struktur grid. (Fase 8B)
- **JS awal sekitar 580 KB mentah di beranda**, terbesar react-dom dan runtime Next, lalu Radix. Alasan: sisa pengurangan butuh mengganti komponen Radix, risikonya lebih besar dari manfaatnya. (Fase 8A, Fase 8B)
- **HTML beranda sekitar 790 KB** karena payload RSC menyalin pohon komponen server. Pindahkan bagian yang jarang berubah (MegaMenu unggulan, etalase merek) ke komponen klien dengan data ringkas. (Fase 8A)
- **Ukur dari Vercel**: cold start Neon (lewat `/api/sehat`), durasi reset demo ke Neon (`npm run demo:ukur-reset`), dan latensi teks pertama Advisor dari region Singapura. Alasan: hanya bisa diukur setelah deploy. (Fase 6A, Fase 7C, Fase 8A)
- **Filter feTurbulence ProductArt di Safari HP lama.** Bila berat, ganti dengan tekstur raster kecil. Alasan: belum ada perangkat lama untuk diuji. (Fase 1.5)
- **Build membaca database.** Build gagal bila Neon tidak terjangkau. Pertimbangkan prarender sebagian produk saja. Alasan: deploy yang tayang tidak terdampak, dan Neon jarang tidak terjangkau. (Fase 4.1)
- **Cabang database Neon per preview.** Build preview tidak memigrasi, jadi preview dengan migrasi baru bisa galat. Alasan: belum memakai preview dengan migrasi. (Fase 6B)

### Tampilan dan pengalaman

- **ProductArt**: tube sunscreen tampak detail masih mirip permen bungkus, tutup jar terbuka tampak melayang, produk di hero desktop belum berdiri di podium. Alasan: ilustrasi tetap terbaca; perbaikan bentuk butuh waktu desain khusus. (Fase 1.5)
- **Gambar OG memakai font sistem** (`@resvg/resvg-js`), dan font sistem di Vercel terbatas. Sematkan berkas font. Alasan: pratinjau tautan tetap tampil dengan font cadangan. (Fase 3)
- **Animasi layout kartu katalog saat filter berganti.** Filter berganti lewat navigasi server, jadi kartu dipasang ulang. Alasan: butuh LayoutGroup dan id stabil, biayanya tidak sebanding untuk 24 kartu. (Fase 8A)
- **Axe moderate**: `heading-order` (h3 setelah h1 di kartu beranda dan checkout) dan `region` (promo bar di luar landmark). Alasan: tidak menghambat pembaca layar. (Fase 8A)
- **Tombol "Membantu" di ulasan** dengan kolom jumlah dan suara per pembeli. Alasan: tidak ada di prompt fase mana pun. (Fase 3)
- **Tombol hati di kartu katalog.** Saat ini hanya di halaman produk dan header. (Fase 5)
- **Daftar perangkat yang sedang masuk.** Saat ini ada Keluar dan Keluar dari semua perangkat. (Fase 5)
- **Konfirmasi diterima untuk tamu** lewat tautan pesanan. Saat ini tamu mengandalkan Selesai otomatis 3 hari. (Fase 5)
- **Infinite scroll berhenti setelah 3 kali muat** lalu memakai tombol. Cek apakah pas untuk katalog yang lebih panjang. (Fase 2)
- **Saran pencarian untuk kata 2 huruf** bisa terlalu luas (ambang `word_similarity` 0,35). (Fase 2)
- **Facet di pencarian hasil tafsiran** dihitung dengan filter wajib saja, jadi jumlahnya tidak berubah saat chip lunak dihapus. (Fase 7C)
- **Kalender flash sale**: salin slot ke minggu berikutnya. (Fase 6B)
- **Label "Stok terbatas" di toko** masih memakai angka tetap 5, belum ambang stok menipis dari Pengaturan. (Fase 6B)
- **Email pengirim di Kotak Notifikasi** memakai email konfigurasi merek, belum email di Profil toko. (Fase 6B)
- **Peringatan nama mirip** untuk kategori dan merek memakai trigram di aplikasi, bukan `pg_trgm`. Alasan: cukup untuk puluhan nama. (Fase 6B)

### AI

- **Riwayat chat Asisten Admin** hanya di sesi browser, pertanyaan lanjutan memahami 8 giliran terakhir. (Fase 7B)
- **Deteksi nama produk karangan model** hanya mengenali nama katalog. Alasan: kartu hanya dari id hasil tool, jadi produk karangan tidak pernah bisa dibeli. (Fase 7A)
- **Uji penjaga hanya-baca Asisten Admin** memeriksa pemanggilan insert, update, dan delete langsung, bukan fungsi baca yang dibungkus. (Fase 7B)
- **Tarif AI diisi manual** di `src/lib/ai/pricing.ts` dengan kurs asumsi Rp 16.500 per US$1. Perbarui saat Google mengubah tarif (kenaikan 1 Jan 2027 sudah tercatat). (Fase 7B)

### Kode dan uji

- **CSP dengan hash, bukan `'unsafe-inline'`**, setelah Next mendukung hash untuk payload prarender sebagian. (Fase 8B)
- **Panel admin dengan root layout sendiri.** Saat ini kerangka toko disembunyikan dengan CSS di halaman admin, dan komponen klien header toko ikut memanggil server. Alasan: menunggu `global-not-found` Next stabil. (Fase 6A)
- **Cakupan uji modul AI dan pesanan di bawah 85%.** Yang belum tercakup terutama pembungkus server action dan query halaman, yang diuji lewat Playwright. Logika uang dan stok sudah di atas 85%. (Fase 8B)
- **Temuan high `npm audit` di alat pengembangan** (`braces` lewat `eslint-config-next`). Alasan: belum ada versi yang diperbaiki, dan celahnya tidak terjangkau dari luar (docs/KEAMANAN.md). (Fase 8B)
