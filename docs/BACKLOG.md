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
- Reset harian data demo (termasuk mengembalikan akun Pembeli Demo ke keadaan seed) belum dijadwalkan; saat ini lewat `db:reset` manual. Uji E2E membersihkan ulasan Pembeli Demo sendiri sebelum berjalan. (Fase 5)
- Status moderasi ulasan di skema bernama "tampil" (prompt menyebut "tayang"); artinya sama, enum tidak diubah supaya migrasi tetap aditif. (Fase 5)
- Ikon hati baru ada di halaman produk dan header (tautan ke wishlist); kartu produk di katalog belum punya tombol hati. (Fase 5)
- Belum ada daftar perangkat yang sedang masuk; yang tersedia "Keluar" dan "Keluar dari semua perangkat". (Fase 5)
- Pembeli yang masuk memakai nomor WA akun sebagai kontak pesanan; nomor penerima di alamat bisa berbeda. Pesanan tamu hanya bisa dikonfirmasi diterima oleh pemilik yang masuk; tamu mengandalkan Selesai otomatis 3 hari. (Fase 5)
- Tautan footer ke halaman bantuan (cara belanja, cek ongkir, FAQ, hubungi, kebijakan) masih 404 dan ikut diprefetch; halaman pendukung dijadwalkan Fase 8. (Fase 5)

## Deploy

- Build membaca database (slug dan detail produk, kategori, cabang, PromoBar, merek, artikel) karena data katalog di-cache dan diprarender; build gagal bila Neon tidak terjangkau. Bila ini mengganggu, pertimbangkan prarender sebagian produk saja atau fallback saat build. (Fase 4.1)
- Header keamanan baru dasar: belum ada Content-Security-Policy lengkap (script-src, img-src) karena peta memakai ubin OSM dan gambar inline; susun CSP penuh di Fase 8. (Fase 4.1)
- Pool koneksi aplikasi 5 per instance di Vercel; pantau batas koneksi Neon paket gratis saat demo ramai. (Fase 4.1)

## Aturan cache

- Pastikan semua modul admin (Fase 6) memanggil revalidateTag sesuai `src/lib/cache-tags.ts`; audit ulang setelah Fase 6 selesai. (Fase 2)
- `getBrands` di-cache dengan tag brands dan products karena memuat jumlah produk dan produk terlaris per merek; perubahan status produk di admin harus merevalidasi tag products. (Fase 2.1)

## Selesai

- Jumlah produk per merek selalu 0: subquery berkorelasi di dalam sql`` merender kolom tanpa nama tabel. Diganti agregasi GROUP BY dan ditutup uji integrasi. (Fase 2.1)
- Beranda HP terlalu panjang: Terlaris, Baru datang, jenis kulit, jurnal, etalase merek, cabang, dan ajakan jadi baris geser. (Fase 2.1)
- Flash sale bisa hilang 3 hari setelah reset: `ensureFlashSaleSlots` menambah slot otomatis saat DEMO_MODE. (Fase 2.1)
- Route cron kedaluwarsa dijadwalkan harian lewat `vercel.json` (03.00 WIB) dan menerima header Authorization: Bearer CRON_SECRET dari Vercel Cron. (Fase 4.1)
- Header situs tampak di tengah formulir checkout pada lembar cuplik: artefak skrip (potretan satu halaman penuh diambil saat halaman sudah tergulir), bukan bug header. Skrip kini menggulir ke atas dan menunggu header kembali sebelum memotret. (Fase 4.1)
- Kotak Notifikasi membaca outbox notifications per pembeli, dengan penanda belum dibaca dan tandai semua dibaca. (Fase 5)
- Unggah foto ulasan sungguhan: dikompresi di browser ke WebP 1600 px, divalidasi ulang di server, disimpan di disk lokal atau Vercel Blob. Ulasan seed tetap memakai foto pengganti. (Fase 5)
- Pemeriksa konsistensi poin sempat salah karena subkueri berkorelasi di sql`` (masalah yang sama dengan Fase 2.1); diganti LEFT JOIN + GROUP BY dan ditutup uji. (Fase 5)
- Produk tidak ditemukan kini mengembalikan HTTP 404 sungguhan: `generateStaticParams` plus pengecekan produk di luar Suspense; dicek lewat `npm run cek:404`. (Fase 3.1)
