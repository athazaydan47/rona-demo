# Backlog polish Fase 8

Temuan visual dan teknis yang sengaja ditunda ke fase polish. Tambahkan temuan baru di bawah, satu baris per butir, sebutkan fase saat ditemukan.

## ProductArt

- Tube sunscreen tampak detail (rebah dengan krim keluar) masih mirip permen bungkus; perlu bentuk mulut tube dan lipatan ujung yang lebih meyakinkan. (ditemukan Fase 1.5)
- Tutup jar krim yang terbuka tampak melayang; perlu bayangan kontak dan sudut sandaran yang jelas. (Fase 1.5)
- Cek performa filter feTurbulence (ShadeSwatchArt dan pan palet) di Safari HP lama; bila berat, ganti dengan tekstur raster kecil atau matikan grain di layar sempit. (Fase 1.5)

## Beranda

- Produk di hero desktop belum benar-benar berdiri di podium; butuh bayangan kontak di podium dan penyesuaian posisi per packshot. (Fase 1.5)

## Katalog dan pencarian

- Facet dan paginasi dihitung di memori dari seluruh produk dalam cakupan (katalog 79 produk). Bila katalog tumbuh ke ribuan produk, pindahkan ke agregasi SQL. (Fase 2)
- Infinite scroll berhenti otomatis setelah 3 kali muat, lalu memakai tombol; cek apakah angka ini terasa pas saat katalog lebih panjang. (Fase 2)
- Saran pencarian memakai word_similarity ambang 0,35; kata sangat pendek (2 huruf) bisa menghasilkan saran yang terlalu luas. (Fase 2)
- Kartu produk di beranda dan katalog memuat seluruh daftar varian untuk tambah cepat; untuk cushion 10 shade payload per kartu agak besar. (Fase 2)

## Aturan cache

- Pastikan semua modul admin (Fase 6) memanggil revalidateTag sesuai `src/lib/cache-tags.ts`; audit ulang setelah Fase 6 selesai. (Fase 2)
