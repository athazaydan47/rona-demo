# Backlog polish Fase 8

Temuan visual dan teknis yang sengaja ditunda ke fase polish. Tambahkan temuan baru di bawah, satu baris per butir, sebutkan fase saat ditemukan.

## ProductArt

- Tube sunscreen tampak detail (rebah dengan krim keluar) masih mirip permen bungkus; perlu bentuk mulut tube dan lipatan ujung yang lebih meyakinkan. (ditemukan Fase 1.5)
- Tutup jar krim yang terbuka tampak melayang; perlu bayangan kontak dan sudut sandaran yang jelas. (Fase 1.5)
- Cek performa filter feTurbulence (ShadeSwatchArt dan pan palet) di Safari HP lama; bila berat, ganti dengan tekstur raster kecil atau matikan grain di layar sempit. (Fase 1.5)

## Beranda

- Produk di hero desktop belum benar-benar berdiri di podium; butuh bayangan kontak di podium dan penyesuaian posisi per packshot. (Fase 1.5)

## Katalog dan pencarian

- WAJIB sebelum dipakai toko sungguhan dengan ribuan produk: filter, facet, urutan, dan paginasi katalog saat ini dihitung di memori dari seluruh produk dalam cakupan (`src/lib/catalog/catalog-queries.ts`, `buildCatalogResult`). Pindahkan ke SQL (kondisi WHERE per filter, agregasi facet dengan GROUP BY, LIMIT dan OFFSET) sambil mempertahankan uji di `filters.test.ts` dan `facets.test.ts` sebagai spesifikasi perilaku. (Fase 2, ditegaskan Fase 2.1)
- Infinite scroll berhenti otomatis setelah 3 kali muat, lalu memakai tombol; cek apakah angka ini terasa pas saat katalog lebih panjang. (Fase 2)
- Saran pencarian memakai word_similarity ambang 0,35; kata sangat pendek (2 huruf) bisa menghasilkan saran yang terlalu luas. (Fase 2)
- Kartu produk di beranda dan katalog memuat seluruh daftar varian untuk tambah cepat; untuk cushion 10 shade payload per kartu agak besar. (Fase 2)

## Halaman produk

- Tombol "Membantu" di ulasan: belum ada kolom di skema, jumlah awal deterministik dari id ulasan dan suara tersimpan lokal. Belum dikerjakan di Fase 5 (tidak ada di prompt); tambahkan kolom helpful_count dan tabel suara per pembeli bersama moderasi ulasan Fase 6. (Fase 3, dicek ulang Fase 5)
- HTML halaman produk sekitar 850 KB karena banyak SVG ProductArt inline (galeri, 4 tampilan, produk serupa, paket). Pertimbangkan gambar PNG dari route og untuk kartu rekomendasi atau lazy render di Fase 8. (Fase 3)
- Route gambar OG memakai @resvg/resvg-js dengan font sistem; di Vercel font sistem terbatas, sematkan berkas font di Fase 8. (Fase 3)

## Keranjang, checkout, pesanan

- Data wilayah dari cahyadsn/wilayah (MIT, lihat `src/data/wilayah.LICENSE.txt`): kecamatan hanya Jawa Timur, provinsi lain kecamatan diisi bebas; kode pos diketik pembeli tanpa validasi silang ke kecamatan. Lengkapi bila toko sungguhan mengirim ke luar Jawa Timur. (Fase 4)
- Peta alamat memakai ubin tile.openstreetmap.org langsung dari browser; untuk produksi dengan trafik nyata, pakai penyedia ubin dengan kunci atau server ubin sendiri sesuai kebijakan OSM. (Fase 4)
- Keranjang membatasi jumlah per item dengan stok terbanyak di satu lokasi; pesanan kirim tetap butuh stok Gudang Online. Fitur Transfer Stok dari cabang ke gudang hadir di panel admin Fase 6. (Fase 4)
- Next 16 dengan Cache Components menyimpan halaman sebelumnya di DOM (React Activity, tersembunyi). Uji Playwright harus memilih elemen yang terlihat (`filter({ visible: true })`). (Fase 4)
- Uji E2E memakai build produksi di port 3210 dengan satu worker karena uji kedaluwarsa memajukan jam server lewat `/api/demo/jam` (hanya hidup saat DEMO_MODE=true dan ALLOW_CLOCK_OVERRIDE=true). (Fase 4)

## Akun, poin, ulasan

- Belum ada adapter WhatsApp Business sungguhan untuk OTP; di luar DEMO_MODE halaman masuk menampilkan "Masuk belum tersedia". Adapter tinggal mengimplementasikan `OtpSender` di `src/lib/auth/otp.ts`. (Fase 5)
- Rate limit OTP per IP memakai header x-forwarded-for (diisi Vercel). Di lokal tanpa header itu, batas per IP tidak berlaku; batas per nomor tetap berlaku. (Fase 5)
- Bila query database gagal, pesan error Drizzle bisa memuat parameter (misal nomor WA) di log server. Aplikasi sendiri tidak mencatat OTP, token, atau nomor; pertimbangkan pembungkus error yang menyamarkan parameter di Fase 8. (Fase 5)
- Foto ulasan yang sudah diunggah tapi ulasannya batal dikirim tetap tersimpan (yatim). Tambahkan pembersihan berkala atau unggah sementara di Fase 8. (Fase 5)
- Foto ulasan di Vercel Blob bersifat publik dengan nama acak; moderasi (sembunyikan ulasan dan fotonya) hadir di panel admin Fase 6. (Fase 5)
- Status moderasi ulasan di skema bernama "tampil" (prompt menyebut "tayang"); artinya sama, enum tidak diubah supaya migrasi tetap aditif. (Fase 5)
- Ikon hati baru ada di halaman produk dan header (tautan ke wishlist); kartu produk di katalog belum punya tombol hati. (Fase 5)
- Belum ada daftar perangkat yang sedang masuk; yang tersedia "Keluar" dan "Keluar dari semua perangkat". (Fase 5)
- Pembeli yang masuk memakai nomor WA akun sebagai kontak pesanan; nomor penerima di alamat bisa berbeda. Pesanan tamu hanya bisa dikonfirmasi diterima oleh pemilik yang masuk; tamu mengandalkan Selesai otomatis 3 hari. (Fase 5)
- Tautan footer ke halaman bantuan (cara belanja, cek ongkir, FAQ, hubungi, kebijakan) masih 404 dan ikut diprefetch; halaman pendukung dijadwalkan Fase 8. (Fase 5)

## Panel admin

- Panel admin memakai root layout yang sama dengan toko; kerangka toko disembunyikan dengan CSS `:has([data-admin-root])`. Header toko tetap dirender (tersembunyi) dan komponen kliennya (jumlah keranjang, status akun) ikut memanggil server di halaman admin. Pisahkan ke route group dengan root layout sendiri setelah `global-not-found` Next stabil. (Fase 6A)
- Matriks stok dan opname memuat seluruh varian lalu menyaring dan memaginasi di memori (cukup untuk 228 varian demo). Pindahkan ke SQL bila katalog ribuan varian. (Fase 6A)
- Kanban memuat 30 kartu terbaru per kolom aktif. Kolom Selesai, Dibatalkan, dan Diretur kini sempit dan terlipat: hanya jumlah 14 hari terakhir dan tautan ke tabel. (Fase 6A, diubah Fase 6B)
- Seret kartu kanban memakai drag and drop HTML5 yang tidak jalan di layar sentuh; di HP kanban sengaja jadi tab status dan aksi ada di halaman detail. (Fase 6A)
- Saat DEMO_MODE, akun staf demo dikunci lebih ketat dari prompt: selain tidak bisa dinonaktifkan atau diganti kata sandinya, peran, izin, dan lokasinya juga tidak bisa diubah (supaya Owner demo tidak terkunci). Pengunjung bebas membuat akun baru untuk mencoba. (Fase 6A)
- Label kirim memakai font standar PDF (WinAnsi); karakter di luar Latin-1 di nama atau alamat dibuang. Sematkan font TTF bila toko sungguhan mengirim ke nama beraksara lain. (Fase 6A)
- Reset demo memakai jalur seed yang sama. Sejak 6B ditambah riwayat 90 hari yang disisipkan massal: 445 kueri, sekitar 2 detik lokal, 22 detik dengan latensi tiruan 10 ms per arah. Sebagian besar kueri tetap dari pesanan Pembeli Demo lewat layanan pesanan sungguhan; bila reset ke Neon terasa lambat, pesanan demo itu juga bisa disisipkan massal. Durasi ke Neon belum diukur langsung (`npm run demo:ukur-reset`). (Fase 6A, diperbarui 6B)
- Foto produk dari admin tampil sebagai gambar terakhir di galeri halaman produk; kartu produk, keranjang, dan gambar OG tetap memakai ProductArt. Foto produk yatim (diganti atau produk dihapus) belum dibersihkan dari Blob, kecuali saat reset demo. (Fase 6B)
- Pohon kategori: seret-lepas memakai HTML5 drag and drop (tidak jalan di layar sentuh); di HP urutan diubah dengan tombol naik dan turun. Memindah sub kategori ke induk lain di HP lewat formulir Ubah (pilih induk). (Fase 6B)
- Peringatan nama mirip memakai trigram dan Levenshtein di aplikasi terhadap seluruh nama kategori atau merek, bukan pg_trgm di database; cukup untuk puluhan nama. (Fase 6B)
- Kalender flash sale menampilkan satu minggu; slot otomatis yang ditimpa slot admin tetap terlihat sebagai Nonaktif. Belum ada salin slot ke minggu berikutnya. (Fase 6B)
- Ambang stok menipis di Pengaturan dipakai Dashboard dan matriks stok admin. Label "Stok terbatas" di toko masih memakai angka tetap 5. (Fase 6B)
- Email pengirim di kotak Notifikasi pembeli masih teks tetap `halo@rona.demo`, belum membaca email di Profil toko. (Fase 6B)
- Formulir produk dan pengaturan memuat ulang data dari server setelah simpan; perubahan yang dibuat staf lain di saat bersamaan menang terakhir (belum ada penguncian optimistis per baris). (Fase 6B)

- Laporan memuat seluruh pesanan dan item periode ke memori lalu diagregasi di aplikasi (satu sumber angka untuk layar dan Excel). Cukup untuk ribuan pesanan per tahun; untuk toko besar, pindahkan agregasi ke SQL dengan uji `reports.test.ts` sebagai spesifikasi. (Fase 6C)
- Segmen pelanggan dihitung saat daftar dibuka (agregasi pesanan per pelanggan), belum disimpan. Untuk ribuan pelanggan, simpan segmen di kolom yang diperbarui berkala. (Fase 6C)
- Nomor WA dan email di detail pesanan admin tetap utuh untuk semua staf yang boleh melihat pesanan (dibutuhkan untuk mengurus kiriman dan pengambilan); penyamaran hanya di halaman Pelanggan. (Fase 6C)
- Ulasan seed tidak terhubung ke akun pembeli, jadi membalasnya tidak membuat notifikasi; hanya ulasan dari pembeli sungguhan yang memberi tahu. (Fase 6C)
- Email: belum ada webhook status dari Resend (terpantul, ditandai spam). Status Terkirim berarti diterima Resend, belum tentu sampai kotak masuk. (Fase 6C)
- Notifikasi yang dibuat saat halaman dibuka (kedaluwarsa bayar dan Selesai otomatis) baru terkirim pada aksi berikutnya atau cron harian. (Fase 6C)

## Deploy

- Build membaca database (slug dan detail produk, kategori, cabang, PromoBar, merek, artikel) karena data katalog di-cache dan diprarender; build gagal bila Neon tidak terjangkau. Bila ini mengganggu, pertimbangkan prarender sebagian produk saja atau fallback saat build. (Fase 4.1)
- Header keamanan baru dasar: belum ada Content-Security-Policy lengkap (script-src, img-src) karena peta memakai ubin OSM dan gambar inline; susun CSP penuh di Fase 8. (Fase 4.1)
- Pool koneksi aplikasi 5 per instance di Vercel; pantau batas koneksi Neon paket gratis saat demo ramai. (Fase 4.1)
- Migrasi otomatis jalan di setiap build produksi (`src/db/build-migrate.ts`); build preview tidak memigrasi, jadi preview dengan migrasi baru bisa error sampai produksi ikut di-deploy. Pertimbangkan cabang database Neon per preview. (Fase 6B)
- Halaman produk memakai `export const instant = false`: dengan partialPrefetching, kedaluwarsanya tag products membuat Next merender ulang shell umum `/p/[slug]` yang membaca params di luar Suspense, dan tanpa izin memblokir semua halaman produk error 500. Bila nanti ingin shell instan untuk slug baru, pindahkan pembacaan params ke dalam Suspense dan andalkan proxy untuk 404. (Fase 6B)

## Aturan cache

- Pastikan semua modul admin (Fase 6) memanggil revalidateTag sesuai `src/lib/cache-tags.ts`; audit ulang setelah Fase 6 selesai. (Fase 2) Modul 6B (produk, kategori, merek, promo, banner, PromoBar, pengaturan, cabang) memakai `updateCatalogNow` di server action supaya admin langsung melihat hasilnya. (Fase 6B)
- Pengaturan toko di-cache dengan tag settings (`getStoreSettings`) dan dipakai keranjang, halaman produk, dan checkout; tag langsung kedaluwarsa saat Pengaturan disimpan. Layanan pesanan dan keranjang di luar Next (uji, seed, cron) membaca langsung dari database (`loadSettings`). (Fase 6B)
- `getBrands` di-cache dengan tag brands dan products karena memuat jumlah produk dan produk terlaris per merek; perubahan status produk di admin harus merevalidasi tag products. (Fase 2.1)

## Selesai

- Kanban di HP membuka tab status aktif pertama yang berisi (urutan Dibayar, Diproses, Menunggu Pembayaran, Siap Diambil, Dikirim) dan mengingat pilihan tab per staf selama sesi; tab kosong berisi kalimat yang membantu. (Fase 6C)
- Pencarian pelanggan di Cmd+K kini membuka detail pelanggan. (Fase 6C)

- Konfirmasi reset demo, nonaktifkan staf, dan atur ulang kata sandi staf memakai dialog (`ConfirmDialog`), bukan lagi `window.prompt`. (Fase 6B)
- Log aktivitas menyembunyikan login secara bawaan (centang "Tampilkan login"); login berulang staf yang sama dalam 10 menit digabung. (Fase 6B)
- Opname di HP berupa kartu dengan input angka besar dan bilah simpan di bawah. (Fase 6B)
- Bilah gratis ongkir di keranjang membaca nilai potongan dari Pengaturan (sebelumnya tertulis Rp 20.000 tetap); tautan WhatsApp di halaman pesanan membaca nomor dari Profil toko. (Fase 6B)

- Jumlah produk per merek selalu 0: subquery berkorelasi di dalam sql`` merender kolom tanpa nama tabel. Diganti agregasi GROUP BY dan ditutup uji integrasi. (Fase 2.1)
- Beranda HP terlalu panjang: Terlaris, Baru datang, jenis kulit, jurnal, etalase merek, cabang, dan ajakan jadi baris geser. (Fase 2.1)
- Flash sale bisa hilang 3 hari setelah reset: `ensureFlashSaleSlots` menambah slot otomatis saat DEMO_MODE. (Fase 2.1)
- Route cron kedaluwarsa dijadwalkan harian lewat `vercel.json` (03.00 WIB) dan menerima header Authorization: Bearer CRON_SECRET dari Vercel Cron. (Fase 4.1)
- Header situs tampak di tengah formulir checkout pada lembar cuplik: artefak skrip (potretan satu halaman penuh diambil saat halaman sudah tergulir), bukan bug header. Skrip kini menggulir ke atas dan menunggu header kembali sebelum memotret. (Fase 4.1)
- Tautan di isi notifikasi kini disimpan relatif dan diberi alamat situs saat ditampilkan; data lama berisi localhost ikut dibetulkan saat tampil. Kotak Notifikasi menampilkan pratinjau 3 baris dengan tombol buka atau tutup dan paginasi 20 per halaman. (Fase 6A, dari review Fase 5)
- Reset harian demo terjadwal bersama cron (DEMO_DAILY_RESET=true) dan tombol Owner. (Fase 6A)
- Kotak Notifikasi membaca outbox notifications per pembeli, dengan penanda belum dibaca dan tandai semua dibaca. (Fase 5)
- Unggah foto ulasan sungguhan: dikompresi di browser ke WebP 1600 px, divalidasi ulang di server, disimpan di disk lokal atau Vercel Blob. Ulasan seed tetap memakai foto pengganti. (Fase 5)
- Pemeriksa konsistensi poin sempat salah karena subkueri berkorelasi di sql`` (masalah yang sama dengan Fase 2.1); diganti LEFT JOIN + GROUP BY dan ditutup uji. (Fase 5)
- Produk tidak ditemukan kini mengembalikan HTTP 404 sungguhan: `generateStaticParams` plus pengecekan produk di luar Suspense; dicek lewat `npm run cek:404`. (Fase 3.1)
