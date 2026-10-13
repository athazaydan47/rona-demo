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

- Produk tidak ditemukan mengembalikan status HTTP 200 (bukan 404) karena notFound() dipanggil di dalam Suspense setelah shell statis terkirim (perilaku Partial Prerender). Untuk SEO, pertimbangkan generateStaticParams untuk slug yang ada atau pengecekan slug di proxy. (Fase 3)
- Tombol "Membantu" di ulasan: belum ada kolom di skema, jumlah awal deterministik dari id ulasan dan suara tersimpan lokal. Tambahkan kolom helpful_count dan tabel suara di Fase 5. (Fase 3)
- HTML halaman produk sekitar 850 KB karena banyak SVG ProductArt inline (galeri, 4 tampilan, produk serupa, paket). Pertimbangkan gambar PNG dari route og untuk kartu rekomendasi atau lazy render di Fase 8. (Fase 3)
- Foto ulasan masih pengganti (ShadeSwatchArt) untuk data seed; unggah foto sungguhan hadir di Fase 5. (Fase 3)
- Route gambar OG memakai @resvg/resvg-js dengan font sistem; di Vercel font sistem terbatas, sematkan berkas font di Fase 8. (Fase 3)

## Aturan cache

- Pastikan semua modul admin (Fase 6) memanggil revalidateTag sesuai `src/lib/cache-tags.ts`; audit ulang setelah Fase 6 selesai. (Fase 2)
- `getBrands` di-cache dengan tag brands dan products karena memuat jumlah produk dan produk terlaris per merek; perubahan status produk di admin harus merevalidasi tag products. (Fase 2.1)

## Selesai

- Jumlah produk per merek selalu 0: subquery berkorelasi di dalam sql`` merender kolom tanpa nama tabel. Diganti agregasi GROUP BY dan ditutup uji integrasi. (Fase 2.1)
- Beranda HP terlalu panjang: Terlaris, Baru datang, jenis kulit, jurnal, etalase merek, cabang, dan ajakan jadi baris geser. (Fase 2.1)
- Flash sale bisa hilang 3 hari setelah reset: `ensureFlashSaleSlots` menambah slot otomatis saat DEMO_MODE. (Fase 2.1)
