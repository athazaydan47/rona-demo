# Blueprint Demo Toko Kosmetik

Disusun 13 Oktober 2026. Dokumen pegangan untuk Claude Code: arah visual, detail halaman, dan aturan bisnis.

## Ringkasan

Kita bangun **Rona Beauty**: toko kosmetik demo multi-merek dengan skala dan fitur setara cfbeauty.id, tapi lebih modern dan lebih cerdas. Bedanya ada di tiga hal: satu produk punya banyak shade dalam satu halaman, stok terlihat per cabang, dan ada asisten AI yang merekomendasikan produk dari katalog sendiri.

Demo ini jujur berlabel demo (data fiktif), bisa dibuka dari HP lewat link, dan dibangun di atas mesin yang nanti tinggal diganti tema dan datanya untuk toko temanmu atau klien berikutnya.

| Keputusan | Pilihan | Alasan |
| --- | --- | --- |
| Nama demo | Rona Beauty (nama kerja) | "Rona" itu warna di pipi; pendek, Indonesia, mudah diingat |
| Label | Pita "Demo Store" + halaman Tentang Demo | Jujur, dan justru jadi alat jualan |
| Isi katalog | 12 merek fiktif, sekitar 72 produk, sekitar 200 varian shade | Cukup padat untuk terasa seperti toko sungguhan |
| Gambar produk | Packshot digambar oleh kode (SVG) + 6 sampai 8 foto suasana gratis | Bebas masalah hak cipta, konsisten, tiap shade punya gambar |
| Cabang | Gudang Online + 3 toko fiktif di Malang | Memamerkan stok per cabang dan ambil di toko |
| Stack | Next.js + PostgreSQL + Drizzle, deploy ke Vercel | Satu repo, satu deploy, cepat, standar industri e-commerce |
| Bayar dan ongkir | Simulasi realistis dulu | Siap disambung Midtrans dan Biteship saat jadi toko sungguhan |
| Admin | Panel lengkap: produk, stok cabang, pesanan, promo, laporan | Ini kekuatanmu dari Pawon Ayu dan ISBB |
| AI | Rona Advisor lewat Gemini dan Cloudflare AI Gateway | Pembeda utama dibanding template WordPress |

Perkiraan kerja: 8 prompt Claude Code ditambah deploy. Kalau dikerjakan sambil skripsi, realistisnya 2 sampai 3 minggu sampai siap dipamerkan.

## Bedah cfbeauty.id: yang layak ditiru

cfbeauty.id dibangun di atas WordPress dengan plugin toko jadi, punya 3 toko fisik di Jogja (Kusumanegara, Babarsari, Gejayan), dan katalognya sangat besar: kategori Makeup saja berisi 212 halaman hasil. Fondasi bisnisnya sudah benar; yang kita tiru adalah *apa* yang mereka sediakan, bukan *cara* mereka membangunnya.

| Area | Yang sudah benar di cfbeauty | Kita pertahankan sebagai |
| --- | --- | --- |
| Navigasi | Mega menu kategori 3 tingkat, direktori merek A sampai Z | Mega menu + direktori merek dengan pencarian |
| Jalur cepat | Bestie Deals, New Arrivals, Best Sellers | Promo, Baru, Terlaris di menu utama |
| Promo | Flash sale "Now Live" dengan hitung mundur, harga coret, persen diskon | Flash sale per slot jam dengan kuota |
| Operasional | Jam admin per hari, cut-off kirim 15.00, ambil di toko 16.00 | Pengaturan jam dan cut-off di admin, badge "Dikirim hari ini" |
| Omnichannel | 3 toko fisik + opsi ambil di toko | Stok per cabang + ambil di toko |
| Checkout | Bisa tanpa daftar akun; alamat sampai kecamatan + titik koordinat | Checkout tamu + alamat tersimpan untuk member |
| Kepercayaan | Ulasan hanya dari pesanan selesai; kebijakan retur dengan video unboxing | Ulasan terverifikasi + halaman kebijakan rapi |
| Data produk | BPOM, netto, kandungan, cara pakai, kode barcode, berat | Semua dipertahankan, ditata dalam tab |
| Katalog | Urutkan: terlaris, rating, termurah, termahal, A sampai Z; rentang harga | Dipertahankan + filter yang jauh lebih pintar |
| Kontak | Tombol bantuan WA melayang, share produk ke WA | Dipertahankan |
| Pembayaran | QRIS | QRIS + Virtual Account + bayar di toko |

## Bedah cfbeauty.id: kelemahan dan perbaikannya

Masalah terbesar cfbeauty adalah **data dan struktur**, bukan tampilan: tiap shade jadi produk terpisah dan taksonominya berantakan. Inilah 12 titik di mana demo kita bisa terlihat jelas lebih unggul.

| # | Masalah | Bukti di cfbeauty | Solusi di Rona |
| --- | --- | --- | --- |
| 1 | Satu shade = satu produk terpisah | Cushion "1NC Vanilla" punya halaman sendiri; Makeup sampai 212 halaman | Satu produk, banyak varian; pemilih shade dengan swatch warna; stok per shade |
| 2 | Kategori dobel dan salah ketik | LIP BLAM, FLASE EYELASHES, LIPS ROUDUCT, MAKEUP BRUSHSES, ACNE PACTH, TINTED SUNSCRREN | Taksonomi 2 tingkat yang dikunci; admin diberi peringatan kalau nama mirip |
| 3 | Merek dobel | Alt Parfume dan Alt Perfume, Scarlett dan Scartlett, Pinkflash dan Pinfklash, Next Prime dan Nextprime | Slug merek unik + deteksi kemiripan nama saat input |
| 4 | Filter tidak terpakai | Sekitar 250 kategori dan 300 merek dalam satu daftar datar tanpa kotak cari | Filter kontekstual: hanya sub kategori yang relevan, cari merek, jenis kulit, masalah kulit, finish, SPF, stok di cabang |
| 5 | Produk habis jadi jalan buntu | Tombol berubah jadi "Produk Habis", tidak ada alternatif | "Kabari aku", tampilkan shade lain yang ada, dan stok di cabang lain |
| 6 | Produk terkait tidak nyambung | Lipstik muncul sebagai produk terkait di halaman cushion | Rekomendasi dari kategori, shade mirip, dan "sering dibeli bersama" |
| 7 | Deskripsi satu blok panjang | Manfaat, kandungan, cara pakai, dan aturan komplain ditumpuk dalam satu teks | Tab: Manfaat, Kandungan, Cara Pakai, Detail; kebijakan jadi komponen tersendiri |
| 8 | Ulasan kosong ditonjolkan | "0,0/5 dari 0 ulasan" tampil di halaman | Bintang disembunyikan bila belum ada ulasan; ajakan ulas setelah pesanan selesai |
| 9 | Wishlist wajib login | Muncul dialog "Butuh Login" | Wishlist tamu tersimpan di perangkat, digabung otomatis saat login |
| 10 | Checkout kurang terpandu | Satu halaman panjang; pesan "metode pengiriman tidak tersedia" muncul sebelum alamat diisi | 3 langkah (Alamat, Pengiriman, Pembayaran), ongkir muncul setelah kecamatan dipilih, estimasi tiba |
| 11 | Login ala WordPress | Tautan masuk mengarah ke wp-login.php | Masuk dengan nomor WA + OTP (di demo: OTP simulasi) |
| 12 | SEO lemah | Meta description beranda hanya "Cfbeauty"; meta keyword berisi sisa SEO vendor template | Meta per halaman, data terstruktur Product, sitemap otomatis, tautan rapi |

Catatan kecil lain: blok "Monthly Special" di beranda tampil dua kali, dan stok cabang tidak terlihat sama sekali padahal ada 3 toko fisik.

## Konsep demo

Rona Beauty diposisikan sebagai toko kosmetik multi-merek dengan 3 cabang di Malang plus toko online, dengan janji "cocok dulu, baru beli": pembeli dibantu menemukan shade dan produk yang pas sebelum checkout. Tagline kerja: **Temukan rona terbaikmu.**

Nama alternatif kalau Rona terasa kurang pas: Ayuna, Seri, Nuansa. Sebelum tayang, cek dulu semua nama di bawah lewat Google dan PDKI supaya tidak bentrok dengan merek nyata.

### 12 merek fiktif

| Merek | Fokus | Kisaran harga |
| --- | --- | --- |
| Kirana Lab | Serum, toner, essence | Rp 59.000 sampai 189.000 |
| Embun | Pelembap, face mist, hidrasi | Rp 39.000 sampai 129.000 |
| Teduh | Kulit sensitif: cleanser, barrier cream | Rp 35.000 sampai 99.000 |
| Surya Shield | Sunscreen gel, stick, spray | Rp 39.000 sampai 119.000 |
| Pualam | Complexion: cushion, foundation, bedak | Rp 79.000 sampai 219.000 |
| Lumi | Bibir: lipstick, lip tint, lip cream | Rp 29.000 sampai 99.000 |
| Dayu Cosmetics | Mata: mascara, eyeliner, palet | Rp 39.000 sampai 149.000 |
| Mekar | Body care: lotion, scrub, body serum | Rp 29.000 sampai 89.000 |
| Arunika | Parfum EDP | Rp 89.000 sampai 299.000 |
| Senja | Body mist | Rp 39.000 sampai 99.000 |
| Kalis | Hair care | Rp 35.000 sampai 129.000 |
| Nara Men | Perawatan pria | Rp 35.000 sampai 119.000 |

### Lokasi stok

| Lokasi | Peran | Jam buka |
| --- | --- | --- |
| Gudang Online | Sumber utama pesanan kirim | Proses Senin sampai Sabtu |
| Rona Soekarno-Hatta | Toko + ambil di toko | 09.00 sampai 21.00 |
| Rona Dinoyo | Toko + ambil di toko | 09.00 sampai 21.00 |
| Rona Sawojajar | Toko + ambil di toko | 10.00 sampai 21.00 |

### Cara melabeli demo dengan jujur

- Pita tipis di atas semua halaman: "Ini toko demo. Produk, harga, dan pesanan fiktif." dengan tautan ke /tentang-demo.
- Halaman /tentang-demo menjelaskan: siapa pembuatnya, fitur apa saja yang bisa dicoba, dan tombol "Masuk sebagai Admin Demo".
- Tiga akun demo siap pakai: Pembeli, Admin Online, Staf Cabang Dinoyo.
- Data direset otomatis tiap malam supaya demo selalu bersih untuk calon klien berikutnya.
- Footer: "Dibangun oleh \[nama studio-mu\]" yang bisa diatur dari satu variabel.

## Arsitektur informasi

Kategori dipangkas dari 11 menu utama dengan ratusan cabang menjadi 8 kategori utama, masing-masing paling banyak 8 sub kategori, tanpa duplikat. Sisanya (jenis kulit, masalah kulit, finish, SPF) jadi **filter**, bukan kategori. Ini yang membuat katalog terasa ringan walau produknya ribuan.

| Kategori | Sub kategori |
| --- | --- |
| Skincare | Pembersih, Toner, Serum dan Essence, Pelembap, Masker, Perawatan Mata, Perawatan Jerawat, Paket Skincare |
| Makeup Wajah | Cushion, Foundation, Bedak, Concealer, Blush, Highlighter dan Contour, Primer dan Setting Spray |
| Makeup Mata | Mascara, Eyeliner, Eyeshadow, Alis, Bulu Mata |
| Bibir | Lipstick, Lip Tint, Lip Cream, Lip Gloss, Lip Balm dan Lip Care |
| Sun Care | Sunscreen Wajah, Sunscreen Tubuh, Tinted Sunscreen |
| Body dan Hair | Body Lotion, Body Wash, Scrub, Deodoran, Shampoo, Hair Treatment |
| Fragrance | Eau de Parfum, Body Mist |
| Pria | Skincare Pria, Rambut Pria, Parfum Pria |

Filter yang tersedia: harga, merek, rating, jenis kulit (normal, kering, berminyak, kombinasi, sensitif), masalah kulit (jerawat, kusam, pori, penuaan, dehidrasi), finish (matte, satin, glowy), undertone shade, SPF, tersedia di cabang, sedang promo.

### Daftar halaman

| Rute | Halaman | Siapa |
| --- | --- | --- |
| / | Beranda | Semua |
| /c/\[kategori\] dan /c/\[kategori\]/\[sub\] | Katalog per kategori | Semua |
| /cari?q= | Hasil pencarian | Semua |
| /p/\[produk\] | Halaman produk | Semua |
| /merek dan /merek/\[merek\] | Direktori merek dan etalase merek | Semua |
| /promo dan /flash-sale | Promo dan flash sale | Semua |
| /keranjang | Keranjang lengkap (selain laci keranjang) | Semua |
| /checkout | Checkout 3 langkah | Semua |
| /bayar/\[nomor\] | Instruksi bayar + hitung mundur | Pembeli |
| /pesanan/\[nomor\] | Detail dan pelacakan pesanan | Pembeli |
| /lacak | Lacak pesanan tanpa login (nomor + nomor WA) | Semua |
| /akun/\* | Profil, alamat, pesanan, wishlist, poin, profil kulit, kotak notifikasi | Member |
| /kuis-kulit dan /rutinitas | Kuis kulit dan hasil rutinitas | Semua |
| /toko | Daftar cabang, peta, jam buka | Semua |
| /cek-ongkir | Cek ongkir cepat | Semua |
| /jurnal dan /jurnal/\[artikel\] | Artikel kecantikan | Semua |
| /tentang-demo | Penjelasan demo + akun demo | Semua |
| /admin/\* | Panel admin | Staf |

## Halaman per halaman

Semua halaman dirancang mobile dulu (anggap mayoritas pembeli datang dari HP), lalu dilebarkan untuk desktop. Di HP ada menu bawah: Beranda, Kategori, Cari, Keranjang, Akun.

### Beranda

1. Bar pengumuman bergilir: "Gratis ongkir min. Rp 150.000", "Pesan sebelum 15.00, dikirim hari ini".
2. Hero editorial 2 sampai 3 slide (foto suasana + judul serif besar), bukan banner penuh teks.
3. Pintasan kategori berbentuk lingkaran dengan ProductArt.
4. Flash sale: hitung mundur, kartu produk dengan bilah kuota ("Sisa 12"), slot berikutnya terlihat.
5. "Belum tahu cocok yang mana?" ajakan ke Kuis Kulit dan Rona Advisor.
6. Terlaris minggu ini, Baru datang, Pilihan per jenis kulit (tab).
7. Etalase merek (logo teks merek fiktif) dan Jurnal (3 artikel).
8. Blok cabang: 3 toko + "Ambil hari ini di toko terdekat".
9. Footer: kategori, bantuan, kebijakan, jam operasional, metode bayar, kredit pembuat.

### Katalog dan pencarian

- Judul kategori, jumlah hasil, chip sub kategori yang bisa digeser.
- Filter di kiri (desktop) atau bottom sheet (HP); filter aktif tampil sebagai chip yang bisa dihapus satu per satu.
- Semua filter tersimpan di URL, jadi hasil bisa dibagikan.
- Urutkan: Paling relevan, Terlaris, Terbaru, Rating, Termurah, Termahal.
- Muat bertahap (tombol "Tampilkan lebih banyak" + infinite scroll), bukan 212 halaman.
- Kartu produk: packshot, merek, nama, rating + jumlah ulasan (disembunyikan bila 0), harga jual + harga coret + persen, titik swatch (maks 5, sisanya "+7"), badge (Flash Sale, Baru, Terlaris, Habis), tombol tambah cepat yang membuka pilihan shade.
- Pencarian: saran instan sejak huruf ke-2 (produk, merek, kategori), tahan salah ketik ("lipstik" menemukan "lipstick"), pencarian terakhir dan populer.
- Hasil kosong: saran kata lain dan produk terlaris, bukan halaman kosong.

### Halaman produk

- Galeri: packshot per shade + foto tekstur/swatch; berganti halus saat shade diganti.
- Breadcrumb, merek (tautan ke etalase merek), nama, rating, terjual sekian.
- Harga per varian; bila flash sale aktif: harga flash + hitung mundur + kuota.
- Pemilih shade: swatch bulat dengan nama di bawahnya, filter undertone (warm, neutral, cool), shade habis dicoret tapi tetap bisa dipilih untuk "Kabari aku".
- Tombol "Cari shade-ku" membuka shade finder (lihat bagian AI).
- Ketersediaan: "Dikirim dari Gudang Online" + daftar cabang dengan stok shade itu ("Rona Dinoyo: 4, bisa diambil hari ini").
- Jumlah, Tambah ke Keranjang, Beli Sekarang, Wishlist, Bagikan ke WA.
- Estimasi ongkir cepat berdasarkan kecamatan tersimpan.
- Tab: Manfaat, Kandungan (bahan aktif disorot), Cara Pakai, Detail (BPOM, netto, kode barcode, berat).
- Cocok untuk: chip jenis kulit dan masalah kulit.
- Ulasan: ringkasan AI, distribusi bintang, filter per jenis kulit dan shade, foto pembeli, label "Pembelian terverifikasi".
- Sering dibeli bersama (paket dengan total harga) dan produk serupa.
- Bar beli menempel di bawah layar HP saat menggulir.

### Keranjang

- Laci keranjang dari kanan setelah tambah produk, plus halaman /keranjang.
- Item per varian (shade terlihat), ubah jumlah, hapus, simpan untuk nanti.
- Bilah progres "Tambah Rp 23.000 lagi untuk gratis ongkir".
- Kode voucher, poin yang bisa dipakai, ringkasan biaya.
- Validasi ulang stok dan harga saat dibuka (harga bisa berubah karena flash sale berakhir, dan itu dijelaskan ke pembeli).

### Checkout 3 langkah

1. **Penerima dan alamat**: nama, nomor WA, email (opsional); alamat dari provinsi sampai kecamatan + kode pos + pin peta; member memilih alamat tersimpan. Atau pilih "Ambil di toko" lalu pilih cabang yang stoknya cukup.
2. **Pengiriman**: kurir muncul setelah kecamatan dipilih, dengan harga dan estimasi tiba; badge "Dikirim hari ini" bila sebelum 15.00; catatan untuk penjual.
3. **Pembayaran**: QRIS, Virtual Account (BCA, BNI, BRI, Mandiri), atau Bayar di Toko untuk ambil di toko; voucher dan poin; ringkasan akhir; tombol Buat Pesanan.

Ringkasan pesanan selalu terlihat (kolom kanan di desktop, ringkas di bawah di HP).

### Pembayaran, sukses, dan lacak

- /bayar: QR atau nomor VA, hitung mundur 15 menit, cara bayar per bank (akordeon), tombol salin. Di mode demo ada tombol "Simulasikan pembayaran berhasil".
- Halaman sukses: nomor pesanan, ringkasan, langkah berikutnya, ajakan daftar untuk tamu ("Simpan pesanan ini ke akunmu").
- /pesanan/\[nomor\]: lini masa status, nomor resi, tombol hubungi toko via WA, unggah ulasan setelah Selesai.
- /lacak: masukkan nomor pesanan + nomor WA, tanpa perlu login.

### Akun

Profil, alamat (banyak, satu utama), pesanan (tab per status), wishlist, poin dan riwayatnya, profil kulit (hasil kuis), kotak notifikasi (pratinjau pesan WA dan email yang "terkirim" di mode demo), keluar.

### Halaman pendukung

Toko kami (3 cabang, jam buka, tombol rute Google Maps), Cek Ongkir, Jurnal (artikel dengan produk yang bisa dibeli langsung di dalam artikel), Kebijakan Retur (aturan video unboxing ditulis rapi), Kebijakan Privasi, FAQ, Tentang Demo.

## Logika bisnis

Aturan emas: **semua angka uang dan stok dihitung ulang di server**, tidak pernah dipercaya dari browser. Ini bagian yang membedakan demo kita dari template, dan sebaiknya dipamerkan ke temanmu.

### Produk, varian, harga

- Struktur: Produk induk, lalu Varian (shade atau ukuran), tiap varian punya SKU, kode barcode, berat (gram), kode warna hex, harga normal, harga jual, dan gambarnya sendiri.
- Persen diskon dihitung otomatis dari harga normal dan harga jual, dibulatkan ke bawah. Harga promo dibulatkan ke Rp 500.
- Urutan harga yang berlaku: Flash Sale lebih dulu, lalu Harga Promo produk, lalu Harga Jual. Voucher dihitung setelahnya dari subtotal.

### Flash sale

- Dibagi per slot jam, misalnya 12.00 sampai 14.00 dan 20.00 sampai 22.00.
- Tiap varian di slot punya harga flash, kuota, dan batas beli per pembeli (misal maks 2).
- Kuota berkurang saat pesanan dibuat, kembali bila pesanan batal atau kedaluwarsa.
- Begitu slot berakhir, harga kembali normal otomatis; keranjang yang berisi harga flash diberi tahu dengan jelas.

### Voucher dan poin

- Tipe voucher: potongan nominal, potongan persen dengan batas maksimal, gratis ongkir.
- Syarat: minimal belanja, periode, kuota total, kuota per pembeli, kategori atau merek tertentu, boleh digabung dengan flash sale atau tidak.
- Poin: 1 poin per Rp 1.000 dari pesanan Selesai; 1 poin bernilai Rp 1 saat ditukar, maksimal 50% dari subtotal. Semua gerakan poin dicatat di buku poin.

### Stok per cabang

- Stok disimpan per varian per lokasi: tersedia = stok fisik dikurangi yang sedang dipesan.
- Pesanan dibuat: stok **dipesan** (reserved). Dibayar: stok benar-benar dipotong. Tidak dibayar dalam 15 menit: pesanan batal otomatis dan stok dilepas.
- Ambil di toko memotong stok cabang yang dipilih. Pesanan kirim memotong Gudang Online dulu; kalau kurang, admin bisa memindahkan dari cabang lewat Transfer Stok.
- Setiap perubahan stok tercatat di buku stok (masuk, keluar, transfer, opname, retur) dengan siapa dan kapan, seperti buku stok di Pawon Ayu.
- Stok di bawah ambang (misal 5) masuk daftar "Stok menipis" di dashboard admin.

### Ongkir

- Berat total dari berat varian, dibulatkan ke atas per kg setelah toleransi 300 gram.
- Kurir di demo: JNE REG dan YES, J&T EZ, SiCepat REG, kurir instan (khusus Kota Malang), dan Ambil di Toko (gratis).
- Tarif demo dari tabel zona: dalam kota, Jawa Timur, Jawa lain, luar Jawa. Estimasi tiba ikut zona.
- Cut-off 15.00 untuk kirim dan 16.00 untuk ambil di toko, diatur dari admin. Minggu libur.
- Disiapkan antarmuka (adapter) supaya nanti tinggal disambung ke API ongkir sungguhan.

### Tambahan aturan (Fase 4)

- Gratis ongkir otomatis: bila subtotal setelah diskon voucher minimal Rp 150.000, ongkir dipotong sampai Rp 20.000. Tidak berlaku untuk kurir instan dan tidak relevan untuk Ambil di Toko.
- Nomor pesanan berurutan per bulan: RONA-YYMM-000001 (bulan dalam WIB), dibuat dari penghitung per bulan di database dengan penguncian baris sehingga aman dari tabrakan saat ada pesanan bersamaan.

### Tambahan aturan (Fase 5)

- Rumus pemberian poin: 1 poin per Rp 1.000 dari nilai belanja bersih, yaitu subtotal setelah diskon produk dan voucher, dikurangi poin yang dipakai, tanpa ongkir. Dibulatkan ke bawah dan diberikan saat pesanan menjadi Selesai. Contoh: subtotal Rp 248.000, voucher Rp 20.000, poin dipakai 1.250, maka nilai bersih Rp 226.750 dan poin yang didapat 226.
- Setiap gerakan poin punya kunci unik di buku poin (`dapat:<nomor>`, `tukar:<nomor>`, `kembali-tukar:<nomor>`, `tarik:<nomor>`, `bonus-ulasan-pertama:<id pembeli>`), sehingga satu pesanan hanya sekali memberi poin dan bonus ulasan pertama hanya sekali per pembeli.
- Poin yang ditukar dikurangi di transaksi yang sama dengan pembuatan pesanan (baris pembeli dikunci) dan dikembalikan bila pesanan dibatalkan atau kedaluwarsa. Pesanan Diretur menarik kembali poin yang diberikan; bila saldo tidak cukup, yang ditarik hanya sebanyak saldo dan alasannya dicatat. Saldo di tabel pembeli selalu sama dengan jumlah buku poin.
- Pesanan tamu yang sudah Selesai lalu diklaim ke akun (masuk dengan nomor WA yang sama) langsung mendapat poinnya saat diklaim.
- Pesanan Dikirim otomatis menjadi Selesai 3 hari setelah status Dikirim, lewat cron harian dan pengecekan saat pesanan dibuka.

### Tambahan aturan (Fase 6A)

- Omzet: jumlah total pesanan yang sudah mencapai Dibayar, dikurangi pesanan yang kemudian Dibatalkan atau Diretur. Dikelompokkan per tanggal bayar dalam WIB (hari dimulai pukul 00.00 WIB). Rata-rata nilai pesanan = omzet dibagi jumlah pesanan yang dihitung dalam omzet.
- Angka keuangan (omzet, rata-rata nilai pesanan, total di daftar terbaru dashboard) hanya tampil untuk akun dengan izin `laporan.keuangan`.
- "Perlu tindakan" di dashboard: pesanan Dibayar yang belum diproses lebih dari 2 jam, Bayar di Toko yang kedaluwarsa hari ini, pesanan Siap Diambil lebih dari 3 hari, dan varian habis di Gudang Online yang punya peminat "Kabari aku". Ambang stok menipis bawaan 5 (pengaturan `stok.ambangMenipis`).
- Izin staf berbasis kunci (misal `pesanan.ubah_status`, `stok.transfer`). Empat peran bawaan adalah templat izin; Owner bisa menambah atau mencabut izin per akun. Daftar lokasi yang diampu kosong berarti semua lokasi; Staf Cabang wajib minimal satu lokasi dan hanya melihat data lokasinya.
- Reset harian demo (03.00 WIB, bersama cron kedaluwarsa dan Selesai otomatis) hanya berjalan bila DEMO_MODE=true dan DEMO_DAILY_RESET=true. Semua tabel data dikosongkan lalu diisi ulang dengan seed deterministik yang sama, dan foto ulasan pengunjung ikut dihapus.

### Tambahan aturan (Fase 6B)

- Produk: SKU unik di seluruh katalog, harga jual tidak boleh di atas harga normal, produk hanya ditaruh di sub kategori. Varian baru mendapat baris stok 0 di semua lokasi lewat modul inventory. Produk yang pernah dipesan tidak bisa dihapus, hanya diarsipkan; varian yang pernah dipesan dinonaktifkan, bukan dihapus. Produk draf dan arsip menjawab 404 di toko. Duplikat produk dibuat sebagai draf dengan akhiran `-salinan` pada slug dan `-C1` pada SKU.
- Kategori maksimal 2 tingkat dan 8 sub kategori per induk. Kategori yang punya sub kategori atau produk tidak bisa dihapus; produknya dipindah dulu. Nama baru yang mirip nama lama (kemiripan trigram minimal 0,4 atau beda paling banyak 2 huruf) diperingatkan, admin bisa memilih "Tetap simpan".
- Flash sale: slot buatan admin selalu menang. Slot otomatis yang bertabrakan dinonaktifkan dan tidak dibuat ulang; dua slot admin aktif tidak boleh bertabrakan. Satu slot maksimal 12 jam. Harga flash harus di bawah harga efektif saat slot dimulai, kuota tidak boleh di bawah jumlah terjual, maksimal per pembeli 1 sampai 10, dan kuota di atas stok Gudang Online hanya diperingatkan. Mengubah slot yang sedang berjalan butuh konfirmasi dan dicatat di log.
- Harga promo per varian berlaku dalam periode, dibulatkan ke Rp 500, dan harus di bawah harga jual. Urutan harga tetap: flash, promo, jual.
- Voucher: kode 4 sampai 20 huruf besar atau angka. Kode yang sudah pernah dipakai tidak bisa diganti dan kuota tidak boleh di bawah pemakaian. Voucher persen maksimal 90% dan wajib punya batas potongan. Menonaktifkan voucher tidak menghapus riwayat pemakaian.
- Banner beranda: gambar unggahan atau komposisi ProductArt (maksimal 3 produk), tautan harus halaman di toko ini, tayang bila aktif dan dalam jadwal, berurutan sesuai urutan admin. PromoBar maksimal 6 pesan, 80 karakter per pesan.
- Pengaturan toko (kunci di tabel settings) dibaca logika: cut-off kirim dan ambil, libur Minggu gudang, jam kurir instan, kurir aktif dan tarif per kg per zona, metode bayar aktif, ambang stok menipis, batas dan nilai gratis ongkir. Nilai bawaannya sama dengan aturan di atas. Hari libur cabang dihitung tutup untuk stok cabang dan Ambil di Toko.
- Data riwayat demo: 90 hari terakhir dihitung mundur dari waktu reset, 8 sampai 25 pesanan per hari (lebih ramai akhir pekan dan tanggal 25 sampai 5, puncak di jam slot flash, sepi dini hari), dari 150 pelanggan fiktif bernomor 0800 dan tamu. Harga dihitung dengan rumus yang sama dengan checkout, buku stok sama dengan stok fisik, saldo poin sama dengan buku poin, dan jumlah terjual sama dengan unit dari pesanan yang pernah dibayar (`npm run cek:data`).
- Versi seed (`demo.versiSeed`) disimpan saat reset. Bila versi di kode lebih baru, Dashboard Owner menawarkan reset.
- Migrasi database berjalan otomatis hanya di build produksi Vercel, dengan advisory lock; bila gagal, build gagal dan versi lama tetap tayang.

### Tambahan aturan (Fase 6C)

- Satu sumber angka laporan: Dashboard, halaman Laporan, unduhan Excel, dan asisten AI (Fase 7) memakai fungsi di `src/lib/reports`. Omzet tetap mengikuti definisi Fase 6A, per tanggal bayar WIB.
- Periode laporan: hari ini, 7 hari, 30 hari, bulan ini, bulan lalu, atau kustom (maksimal 366 hari), dengan batas hari WIB. Pembanding = periode dengan panjang sama tepat sebelumnya.
- Tingkat pembatalan = pesanan Dibatalkan dibagi pesanan yang dibuat dalam periode. Tingkat retur = pesanan Diretur dibagi pesanan yang dibayar dalam periode.
- Rincian per merek, kategori, dan produk memakai penjualan barang (harga satuan dikali jumlah, sebelum voucher, ongkir, dan poin). Rincian per cabang dan kanal memakai omzet (total pesanan).
- Pembeli baru: pesanan dalam omzet pertamanya (sepanjang masa) jatuh di periode itu; selain itu pembeli kembali. Tamu dihitung per nomor WA.
- Angka rupiah laporan hanya untuk izin `laporan.keuangan`; tanpa izin itu hanya jumlah. Staf yang mengampu lokasi tertentu hanya melihat lokasinya. Excel tidak memuat nama, nomor, atau email pembeli.
- Segmen pelanggan, dihitung dari waktu sekarang dan tanggal pesanan dibuat (batas inklusif):
  - **Tidak aktif**: tidak ada pesanan (status apa pun) dalam 90 hari terakhir. Menang atas Setia.
  - **Setia**: minimal 3 pesanan Selesai dalam 180 hari terakhir.
  - **Baru**: baru punya 1 pesanan Selesai, dan pesanan itu dalam 30 hari terakhir.
  - **Lainnya**: yang tidak masuk ketiganya.
- Total belanja bersih pelanggan = jumlah nilai belanja bersih (rumus poin Fase 5) dari pesanan yang dibayar dan tidak batal atau retur.
- Penyesuaian poin manual: izin `pelanggan.poin` (bawaan hanya Owner), alasan wajib, ditulis ke buku poin dengan kunci `manual:<acak>`, saldo tidak boleh negatif, tercatat di log.
- Kontak pelanggan (nomor WA, email, alamat lengkap) hanya utuh untuk izin `pelanggan.kontak` (bawaan Owner dan Admin Online); selain itu disamarkan sebagian. Tidak ada ekspor data pelanggan.
- Moderasi ulasan: menyembunyikan wajib alasan (minimal 5 karakter), rating dan jumlah ulasan produk dihitung ulang dari ulasan yang tampil. Balasan toko 5 sampai 1.000 karakter, bisa diubah dan dihapus; hanya balasan pertama yang memberi tahu pembeli. Ulasan bintang 1 atau 2 yang tampil dan belum dibalas masuk "Perlu tindakan".
- Email transaksional: status Menunggu, Terkirim, Gagal, atau Dilewati. Saat DEMO_MODE=true hanya alamat di `EMAIL_ALLOWLIST` yang dikirimi. Dicoba ulang maksimal 3 kali; setiap notifikasi punya kunci idempoten sehingga tidak terkirim dua kali. Tanpa promosi.

### Profil kulit (bentuk data, Fase 5)

Disimpan di `customers.skin_profile` (JSON). Formulir di /akun/profil-kulit mengisi sebagian; kuis kulit Fase 7 boleh mengisi semuanya. Semua kolom opsional:

| Kolom | Nilai |
|---|---|
| skinType | normal, kering, berminyak, kombinasi, sensitif |
| concerns | daftar dari: jerawat, kusam, pori, penuaan, dehidrasi |
| sensitivity | rendah, sedang, tinggi |
| undertone | warm, neutral, cool |
| depth | 1 sampai 6, skala yang sama dengan Shade Finder |
| finish | matte, satin, glowy |
| budget | rupiah per produk (bilangan bulat) |
| routine | teks bebas rutinitas sekarang, maksimal 300 karakter |
| source | formulir atau kuis |
| updatedAt | waktu ISO UTC terakhir diubah |

### Pembayaran

- QRIS dan Virtual Account disimulasikan: nomor dan QR dibuat sistem, masa berlaku 15 menit.
- Konfirmasi pembayaran lewat satu pintu (seperti webhook payment gateway) yang aman dipanggil dua kali tanpa dobel memproses.
- Bayar di Toko: pesanan menunggu sampai staf cabang menandai lunas di admin.

### Status pesanan

Menunggu Pembayaran, Dibayar, Diproses, lalu bercabang: Dikirim atau Siap Diambil, kemudian Selesai. Pesanan bisa Dibatalkan (otomatis bila kedaluwarsa atau oleh admin sebelum dikirim) dan bisa Diretur setelah diterima (wajib video unboxing). Nomor pesanan berformat RONA-2610-000123. Tabel transisinya ada di bawah.

Transisi status yang sah (selain ini ditolak):

| Dari | Ke | Pemicu |
| --- | --- | --- |
| Menunggu Pembayaran | Dibayar | Konfirmasi pembayaran (atau staf menandai lunas untuk Bayar di Toko) |
| Menunggu Pembayaran | Dibatalkan | Lewat 15 menit tanpa pembayaran, atau dibatalkan admin |
| Dibayar | Diproses | Admin mulai menyiapkan pesanan |
| Dibayar | Dibatalkan | Dibatalkan admin (stok dan kuota dilepas, dana dianggap dikembalikan) |
| Diproses | Dikirim | Pesanan kirim: resi diinput |
| Diproses | Siap Diambil | Pesanan ambil di toko: barang sudah disiapkan di cabang |
| Diproses | Dibatalkan | Dibatalkan admin sebelum barang keluar |
| Dikirim | Selesai | Pembeli konfirmasi diterima, atau otomatis 3 hari setelah status kurir terkirim |
| Siap Diambil | Selesai | Staf cabang menandai sudah diambil |
| Selesai | Diretur | Pengajuan retur disetujui (wajib video unboxing) |

Status akhir: Selesai, Dibatalkan, Diretur.

Pengecualian Bayar di Toko: batas waktunya bukan 15 menit, melainkan sampai jam tutup cabang pada hari kerja berikutnya. Stok cabang tetap dipesan selama itu. Saat pembeli datang dan membayar, staf cabang menandai lunas dan sudah diambil dalam satu aksi (Menunggu Pembayaran, lalu Dibayar, lalu Selesai tercatat berurutan).

Pesanan kirim lewat Dikirim, pesanan ambil di toko lewat Siap Diambil; pembatalan hanya mungkin sebelum barang keluar.

### Ulasan dan notifikasi

- Ulasan hanya dari item pesanan Selesai, satu ulasan per item, dengan bintang, teks, foto, jenis kulit, dan shade yang dibeli. Ulasan pertama memberi bonus 50 poin.
- Notifikasi di demo masuk ke Kotak Notifikasi akun dalam bentuk pratinjau WA dan email. Di toko sungguhan nanti memakai WhatsApp Business API resmi, dan sistem tidak pernah memulai chat duluan ke pelanggan yang belum berinteraksi (pelajaran dari WAHA).

## Panel admin

Panel admin adalah bagian yang **tidak bisa didapat dari template murah**, dan di sinilah pengalamanmu dari Pawon Ayu dan ISBB jadi senjata. Saat demo, buka toko di HP dan admin di laptop berdampingan: pesanan masuk, stok berkurang, dashboard bergerak.

### Peran dan izin

Izin diatur per akun oleh Owner (pola dari ISBB), dengan 4 peran bawaan:

| Peran | Bisa apa |
| --- | --- |
| Owner | Semua, termasuk laporan keuangan, pengaturan, dan kelola akun |
| Admin Online | Pesanan online, produk, promo, voucher, ulasan |
| Staf Cabang | Pesanan ambil di toko dan stok cabangnya sendiri |
| Gudang | Stok masuk, transfer, opname |

### Modul

| Modul | Isi |
| --- | --- |
| Dashboard | Omzet hari ini dan 30 hari, jumlah pesanan per status, produk terlaris, stok menipis per cabang, pesanan yang perlu tindakan |
| Pesanan | Papan kanban per status + tabel; aksi massal; cetak label kirim dan daftar ambil; tandai siap diambil; input resi; batalkan dengan alasan |
| Produk | Tambah dan ubah produk + varian shade (pemilih warna hex), gambar, deskripsi per tab, bahan aktif, cocok untuk kulit, SEO, aktif atau draf |
| Kategori dan Merek | Pohon kategori seret-lepas; peringatan nama mirip (cegah "LIP BLAM" terulang) |
| Stok | Matriks varian x lokasi, stok masuk, transfer antar cabang, opname dengan selisih, riwayat buku stok |
| Promo | Slot flash sale dengan kuota, voucher, banner beranda dengan jadwal tayang |
| Ulasan | Moderasi: tampilkan, sembunyikan, balas sebagai toko |
| Pelanggan | Riwayat belanja, poin, profil kulit, segmen sederhana (baru, setia, tidak aktif) |
| Laporan | Penjualan per hari, merek, kategori, cabang, kanal; unduh Excel multi-sheet (seperti fitur Unduh Laporan Pawon Ayu) |
| Pengaturan | Profil toko, cabang dan jam buka, cut-off, kurir aktif, metode bayar, ambang stok menipis |
| Log aktivitas | Siapa mengubah apa dan kapan |

Admin juga harus enak dipakai dari HP, karena staf cabang biasanya hanya pegang HP.

## Fitur pembeda AI

Pembeda paling kuat dibanding cfbeauty adalah **Rona Advisor**: asisten yang hanya merekomendasikan produk yang benar-benar ada di katalog dan stoknya tersedia. Polanya sama dengan asisten AI Pawon Ayu: satu otak, membaca data lewat tool, tidak mengarang.

| Fitur | Untuk siapa | Cara kerja |
| --- | --- | --- |
| Rona Advisor (chat) | Pembeli | "Kulitku berminyak dan gampang jerawat, sunscreen apa?" AI memanggil fungsi cari produk, lalu menjawab dengan kartu produk yang bisa langsung ditambah ke keranjang |
| Kuis Kulit | Pembeli | 6 pertanyaan bergambar (jenis kulit, masalah, sensitivitas, budget, undertone, rutinitas sekarang); hasilnya profil kulit tersimpan di akun |
| Rutinitas Pagi dan Malam | Pembeli | Dari profil kulit, susun 4 sampai 6 langkah dari katalog dengan total harga dan tombol "Tambah semua ke keranjang" |
| Shade Finder | Pembeli | Pilih kedalaman kulit (6 tingkat) dan undertone lewat swatch visual; sistem menyarankan shade yang paling dekat per produk dari data pemetaan shade |
| Ringkasan Ulasan | Pembeli | Ringkasan singkat kelebihan dan keluhan dari ulasan sebuah produk, diperbarui berkala, bukan tiap kunjungan |
| Penulis Deskripsi | Admin | Admin isi poin-poin, AI menyusun deskripsi per tab dalam gaya bahasa toko |
| Kabar Harian | Owner | Ringkasan penjualan, stok menipis, dan pesanan bermasalah setiap malam, seperti laporan WA di Pawon Ayu |

Pagar pengaman:

- AI tidak membuat klaim medis; untuk keluhan kulit serius, sarankan ke dokter kulit.
- Rekomendasi wajib berasal dari hasil fungsi pencarian katalog; nama produk yang tidak ada di data ditolak.
- Label kecil "Jawaban AI bisa keliru" di jendela chat.
- Kalau AI tidak bisa dihubungi, Kuis Kulit dan Shade Finder tetap jalan karena berbasis aturan, bukan AI.

Teknis: Gemini (seri 3.5 flash yang biasa kamu pakai) lewat Cloudflare AI Gateway, sama seperti Civil.co, supaya aman dari penolakan lokasi server dan pemakaiannya tercatat. Batasi jumlah pesan per pengunjung per hari di mode demo supaya biaya tidak bocor.

## Model data

Inti modelnya: **stok melekat pada varian di lokasi**, bukan pada produk. Semua uang disimpan sebagai bilangan bulat rupiah (tanpa desimal), semua waktu disimpan dalam UTC dan ditampilkan dalam WIB.

| Tabel | Isi penting | Terhubung ke |
| --- | --- | --- |
| brands | nama, slug unik, warna brand, deskripsi | products |
| categories | nama, slug, parent\_id (maks 2 tingkat), urutan | products |
| products | nama, slug, brand\_id, category\_id, deskripsi per tab (manfaat, kandungan, cara\_pakai), bahan\_aktif\[\], cocok\_kulit\[\], masalah\_kulit\[\], finish, spf, bpom, netto, kemasan (bentuk untuk ProductArt), status, rating\_rata, jumlah\_ulasan, terjual | variants, reviews |
| variants | product\_id, nama\_shade, kode\_hex, undertone, kedalaman (1 sampai 6), sku, barcode, berat\_gram, harga\_normal, harga\_jual, aktif | inventory, order\_items |
| locations | nama, jenis (gudang atau toko), alamat, koordinat, jam\_buka, bisa\_ambil | inventory |
| inventory | variant\_id, location\_id, stok\_fisik, dipesan | stock\_movements |
| stock\_movements | variant\_id, location\_id, jenis (masuk, keluar, transfer, opname, retur, pesan, lepas), jumlah, referensi, oleh, waktu |  |
| customers | nama, nomor\_wa unik, email, poin, profil\_kulit (json), terdaftar\_pada | addresses, orders |
| addresses | customer\_id, label, penerima, nomor\_wa, provinsi sampai kecamatan, kode\_pos, alamat, lat, lng, utama |  |
| carts dan cart\_items | milik customer atau token tamu; variant\_id, jumlah, disimpan\_untuk\_nanti |  |
| orders | nomor, customer\_id atau data tamu, metode (kirim atau ambil), location\_id asal, alamat (salinan), kurir, layanan, ongkir, subtotal, diskon, poin\_dipakai, total, status, kedaluwarsa\_pada, catatan | order\_items, payments, shipments |
| order\_items | order\_id, variant\_id, salinan nama dan shade, harga\_satuan, jumlah, sumber\_harga (flash, promo, normal) | reviews |
| payments | order\_id, metode, kode\_va atau payload\_qr, jumlah, status, dibayar\_pada, kunci\_idempoten |  |
| shipments | order\_id, kurir, resi, status, riwayat (json) |  |
| flash\_sales dan flash\_sale\_items | slot mulai dan selesai; variant\_id, harga\_flash, kuota, terjual, maks\_per\_pembeli |  |
| vouchers dan voucher\_redemptions | kode, tipe, nilai, maks\_potongan, min\_belanja, periode, kuota, kuota\_per\_pembeli, cakupan; siapa memakai kapan |  |
| reviews | order\_item\_id, product\_id, variant\_id, bintang, teks, foto\[\], jenis\_kulit, status\_moderasi, balasan\_toko |  |
| wishlists | customer\_id, product\_id |  |
| points\_ledger | customer\_id, jumlah (+ atau -), alasan, referensi |  |
| notifications | customer\_id, kanal (wa atau email), isi, status, waktu (outbox, di demo hanya dipratinjau) |  |
| staff, roles, permissions | akun staf, peran, izin per akun, lokasi yang diampu | audit\_logs |
| audit\_logs | staff\_id, aksi, objek, sebelum, sesudah, waktu |  |
| settings, banners, articles | pengaturan toko, banner berjadwal, artikel jurnal dengan produk tertaut |  |

Indeks penting: pencarian teks produk (trigram untuk tahan salah ketik), inventory unik per (variant\_id, location\_id), orders per (status, dibuat\_pada).

## Design system

Arah visualnya **editorial kecantikan yang hangat**: latar porselen, mawar tua sebagai aksen, judul serif yang elegan, dan banyak ruang kosong. Hindari pink terang ala template; kelasnya harus terasa seperti majalah kecantikan, bukan brosur promo.

### Warna

| Token | Hex | Dipakai untuk |
| --- | --- | --- |
| porselen | #FAF7F5 | Latar halaman |
| putih | #FFFFFF | Kartu, laci, dialog |
| kopi | #2A1F1D | Teks utama |
| abu-hangat | #6E615D | Teks sekunder |
| garis | #EAE2DE | Garis pemisah, border |
| rona | #B8475D | Aksen utama: tombol, tautan aktif |
| rona-gelap | #93364A | Tombol saat ditekan |
| blush | #F4DCDF | Latar lembut, chip terpilih |
| sage | #8FA58E | Label "aman untuk kulit sensitif" |
| emas | #C9A35C | Badge flash sale dan Terlaris |
| sukses | #2F7A55 | Status berhasil |
| peringatan | #C77D1A | Stok menipis, batas waktu |
| bahaya | #B3261E | Error, habis |

Pastikan kontras teks memenuhi WCAG AA; teks putih di atas rona sudah aman untuk tombol.

### Huruf dan ukuran

- Judul: **Fraunces** (serif, Google Fonts) untuk hero dan judul bagian.
- Teks: **Plus Jakarta Sans** (Google Fonts, dirancang di Indonesia) untuk semua teks lain; angka harga memakai angka tabular.
- Skala: 12, 14, 16, 18, 22, 28, 36, 48 px. Teks badan 16 px di HP.
- Jarak kelipatan 4 px; sudut kartu 16 px, tombol dan chip berbentuk pil; bayangan sangat lembut.

### Komponen inti

PromoBar, Header + MegaMenu, SearchBox dengan saran instan, ProductArt, ProductCard, SwatchPicker, PriceTag, FlashCountdown, QuotaBar, StockByStore, RatingStars, FilterSheet, ActiveFilterChips, CartDrawer, Stepper checkout, AddressForm, CourierOption, PaymentOption, OrderTimeline, EmptyState, Skeleton, Toast, BottomNav (HP), AdvisorChat, DemoRibbon.

### Gerak

- Motion (Framer Motion): durasi 150 sampai 250 ms, easing lembut.
- Momen andalan: produk "terbang" ke ikon keranjang, pergantian shade dengan crossfade, angka hitung mundur yang berganti halus, kartu muncul bertahap saat digulir.
- Hormati pengaturan "kurangi gerakan" di perangkat.
- Polish animasi dikerjakan di fase terakhir supaya fondasinya rapi dulu (pelajaran dari Civil.co).

### Bahasa

- Bahasa Indonesia, menyapa "kamu", hangat dan singkat. Contoh: "Shade ini habis di gudang, tapi ada 3 di Rona Dinoyo."
- Format: Rp 129.000, 13 Okt 2026, 14.30 WIB.
- **Tidak ada em-dash** di teks mana pun. Pakai koma, titik dua, atau kalimat baru.

## Stack dan infrastruktur

Pilihannya **satu aplikasi Next.js** untuk toko dan admin sekaligus, dengan PostgreSQL. Satu repo, satu deploy, mudah dirawat sendirian, dan SEO-nya kuat karena halaman dirender di server.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Framework | Next.js versi stabil terbaru (App Router, TypeScript) | Standar e-commerce modern, render server untuk SEO dan kecepatan |
| Tampilan | Tailwind CSS + komponen berbasis Radix (gaya shadcn/ui) + Motion | Cepat dibangun, aksesibel, animasi halus |
| Database | PostgreSQL: lokal di laptopmu (127.0.0.1:5432), produksi di Neon | Postgres lokal sudah ada; Neon punya paket gratis untuk demo |
| ORM | Drizzle | Skema di kode TypeScript, migrasi rapi, ringan |
| Pencarian | Full-text search Postgres + pg\_trgm | Tahan salah ketik tanpa layanan tambahan |
| Login | Sesi berbasis cookie; OTP WA disimulasikan di demo | Siap diganti OTP sungguhan |
| Gambar | ProductArt (SVG) + next/image untuk foto | Ringan dan selalu tajam |
| AI | Gemini lewat Cloudflare AI Gateway | Sudah terbukti di Civil.co |
| Hosting | Vercel (paket gratis untuk demo) | Deploy otomatis tiap git push, preview per cabang git |
| Domain | Subdomain brand studio-mu lewat Cloudflare DNS | Sementara cukup alamat vercel.app |
| Uji | Vitest untuk logika harga, stok, voucher; Playwright untuk alur checkout | Logika uang wajib teruji |

Catatan bisnis:

- Untuk toko sungguhan (temanmu), paket hosting perlu dinaikkan ke berbayar atau dipindah ke VPS. Itu masuk biaya bulanan klien.
- Pembayaran dan ongkir sungguhan nanti cukup mengganti adapter: payment gateway (misal Midtrans atau Xendit) dan agregator ongkir (misal Biteship atau RajaOngkir).
- Kalau temanmu ternyata hanya butuh toko sederhana dengan budget kecil, jalur WordPress tetap opsi yang jujur; demo ini untuk menunjukkan kelas custom.

## Strategi gambar produk

Jawaban singkat: **gambar produk tidak perlu kamu unduh**, karena digambar oleh kode; kamu hanya perlu mengunduh 8 foto suasana. Dari chat ini aku tidak bisa menaruh file langsung ke folder di laptopmu, tapi Claude Code di laptopmu bisa membuat semua gambar produk sendiri.

Jangan pakai foto produk dari cfbeauty atau situs merek asli. Fotonya milik orang lain, logonya merek dagang, dan demo akan terkesan menjual produk sungguhan.

### Lapis 1: packshot dari kode (otomatis, untuk semua produk)

Komponen ProductArt menggambar kemasan dalam SVG dari data: bentuk kemasan, warna shade, warna merek, dan nama merek. Ada 14 bentuk: lipstick, lip tint, lip cream, cushion, botol foundation, tube sunscreen, botol serum pipet, botol toner, jar krim, mascara, palet eyeshadow, botol parfum, botol pompa body lotion, dan sachet sheet mask. Hasilnya: tiap shade otomatis punya gambar sendiri, gaya foto studionya seragam, dan tidak ada gambar yang rusak.

### Lapis 2: foto suasana (kamu unduh manual, sekitar 15 menit)

1. Buka pexels.com atau unsplash.com (keduanya gratis dipakai, tidak wajib mencantumkan nama).
2. Cari dengan kata kunci di tabel bawah.
3. Pilih foto **tanpa logo merek yang terbaca** dan sebaiknya tanpa wajah yang jelas.
4. Klik Download, pilih ukuran besar (lebar sekitar 1920 px).
5. Ganti nama file persis seperti kolom Nama file.
6. Taruh di folder `public/images/lifestyle/` di proyek.
7. Catat tautan sumber tiap foto di `public/images/lifestyle/CREDITS.md`.
8. Commit. Kompresi ke WebP dikerjakan Claude Code di Prompt 8.

| Nama file | Dipakai di | Kata kunci |
| --- | --- | --- |
| hero-1.jpg | Slide hero 1 | skincare flatlay neutral |
| hero-2.jpg | Slide hero 2 | makeup products pastel |
| hero-3.jpg | Slide hero 3 | woman applying skincare mirror |
| cat-skincare.jpg | Banner Skincare | serum dropper bottle |
| cat-makeup.jpg | Banner Makeup | lipstick swatches |
| cat-suncare.jpg | Banner Sun Care | sunscreen summer |
| cat-fragrance.jpg | Banner Fragrance | perfume bottle soft light |
| store-interior.jpg | Halaman Toko Kami | cosmetic store interior |

Selama foto belum ada, halaman tetap tampil rapi dengan latar gradien dan ProductArt, jadi kamu tidak perlu menunggu foto untuk mulai.

### Lapis 3 (opsional): gambar AI untuk hero

Kalau ingin hero yang benar-benar unik, buat dengan Grok. Contoh prompt: "Editorial beauty still life, unbranded cosmetic bottles and a lipstick on warm porcelain stone, soft morning window light, rose and cream palette, minimal, no text, no logos, 16:9." Simpan dengan nama file yang sama, menggantikan foto Pexels.

## Persiapan dari nol

Sebelum prompt pertama, siapkan folder berisi dua file pegangan: **CLAUDE.md** (aturan proyek, aku kirimkan di chat) dan **docs/BRIEF.md** (dokumen ini diekspor sebagai Markdown). Claude Code akan membaca keduanya di setiap prompt.

1. Buka Terminal, buat folder proyek:

```bash
mkdir -p ~/Projects/rona-demo/docs
cd ~/Projects/rona-demo
git init -b main
```

2. Buat database lokal (Postgres-mu sudah jalan di 127.0.0.1:5432):

```bash
createdb -h 127.0.0.1 rona_demo
```

Kalau perintah createdb tidak dikenal, pakai: `psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE rona_demo;"`

3. Taruh file **CLAUDE.md** yang aku kirim di akar folder `rona-demo`.
4. Ekspor dokumen ini ke Markdown, simpan sebagai `docs/BRIEF.md`.
5. Commit awal:

```bash
git add -A
git commit -m "chore: brief dan aturan proyek"
```

6. Buat repo GitHub privat dan dorong (kalau GitHub CLI terpasang; kalau belum, buat lewat github.com lalu ikuti petunjuk "push an existing repository"):

```bash
gh repo create rona-demo --private --source=. --remote=origin --push
```

7. Buka di VS Code dengan `code .`, buka terminal VS Code, jalankan `claude`, lalu ketik `/model` untuk memilih model sesuai prompt.
8. **Aturan wajib sebelum setiap prompt** (pelajaran 6 Agustus):

```bash
git add -A && git commit -m "checkpoint: sebelum prompt N"
```

9. Setelah tiap prompt selesai: jalankan `npm run dev`, buka http://localhost:3000 di laptop dan di HP (lewat IP laptop di Wi-Fi yang sama), lalu kirim hasil dan tangkapan layarnya ke aku untuk direview sebelum lanjut.

## Prompt Claude Code per fase

Ada 8 prompt. Jalankan berurutan, satu fase selesai dan direview dulu sebelum lanjut. Mulai setiap fase dengan `/clear` supaya konteks bersih; semua pegangan ada di CLAUDE.md dan docs/BRIEF.md.

| Fase | Isi | Model |
| --- | --- | --- |
| 1 | Fondasi, database, seed, design tokens, ProductArt, layout | Fable 5 |
| 2 | Beranda, katalog, filter, pencarian, merek | Fable 5 |
| 3 | Halaman produk dan shade finder | Fable 5 |
| 4 | Keranjang, checkout, pembayaran, pesanan | Opus 5 |
| 5 | Akun, ulasan, poin, notifikasi | Opus 5 |
| 6 | Panel admin | Opus 5 |
| 7 | Rona Advisor dan fitur AI | Opus 5 |
| 8 | Polish, performa, mode demo | Fable 5 |

Fable 5 untuk fase yang berat di desain dan rasa visual; Opus 5 untuk fase yang berat di logika dan kebenaran data. Untuk perbaikan kecil saat iterasi, Sonnet 5 sudah cukup.

### Prompt 1: Fondasi (Fable 5)

```text
Kamu senior full-stack engineer sekaligus product designer kelas atas. Baca CLAUDE.md dan docs/BRIEF.md sampai habis sebelum menulis kode. Kita membangun "Rona Beauty", toko kosmetik DEMO multi-merek dengan data fiktif, untuk portofolio.

Fase 1, fondasi:
1. Scaffold Next.js versi stabil terbaru (App Router, TypeScript, Tailwind, ESLint, folder src). Folder ini sudah berisi CLAUDE.md dan docs/. JANGAN timpa atau hapus keduanya: scaffold di folder sementara, lalu pindahkan isinya ke sini.
2. Pasang: drizzle-orm, drizzle-kit, driver postgres, zod, motion, komponen berbasis Radix gaya shadcn/ui, lucide-react, clsx, tailwind-merge, vitest.
3. Database: DATABASE_URL ke Postgres lokal 127.0.0.1:5432 database rona_demo di .env.local; buat .env.example tanpa rahasia. Buat skema Drizzle untuk SEMUA tabel di bagian Model data BRIEF, migrasi, dan aktifkan ekstensi pg_trgm.
4. Seed deterministik yang bisa diulang dengan `npm run db:reset`: 12 merek fiktif, 8 kategori + sub kategori, sekitar 72 produk, sekitar 200 varian dengan kode hex, undertone, dan kedalaman yang masuk akal, harga realistis pasar Indonesia, stok per lokasi (Gudang Online + 3 cabang Malang, sebagian sengaja habis atau menipis), sekitar 150 ulasan demo, 2 slot flash sale, 4 voucher, 4 artikel. Deskripsi produk ditulis meyakinkan dalam bahasa Indonesia tapi jelas fiktif.
5. Design tokens di Tailwind sesuai bagian Design system (warna, Fraunces + Plus Jakarta Sans via next/font, skala huruf, radius, bayangan). Buat halaman /design yang memamerkan semua token dan komponen dasar.
6. Komponen ProductArt: SVG packshot yang digambar dari data (bentuk kemasan, warna shade, warna merek, nama merek) untuk 14 bentuk kemasan di BRIEF. Gayanya foto studio minimalis: bayangan lembut, highlight kaca atau plastik, latar warna lembut. Harus terlihat premium, bukan ikon kartun. Tampilkan semua bentuk dengan beberapa shade di /design.
7. Layout global: PromoBar, DemoRibbon (bisa ditutup, tautan /tentang-demo tetap ada di footer), header dengan logo teks Rona, SearchBox (tampilan dulu), ikon akun, wishlist, keranjang dengan badge, MegaMenu dari database, footer lengkap (kategori, bantuan, kebijakan, cabang dan jam buka, metode bayar, kredit "Dibangun oleh" dari env STUDIO_NAME). BottomNav untuk HP.
Aturan: semua teks UI bahasa Indonesia dengan sapaan "kamu", format Rp 129.000, dan TIDAK ADA em-dash di mana pun.
Selesai: jalankan lint, typecheck, dan build sampai bersih. Laporkan struktur folder, cara menjalankan, keputusan yang kamu ambil sendiri, dan apa yang belum.
```

### Prompt 2: Etalase (Fable 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Arsitektur informasi, Halaman per halaman (Beranda, Katalog dan pencarian), dan Design system. Fondasi fase 1 sudah ada.

Fase 2, etalase:
1. Beranda sesuai BRIEF: PromoBar bergilir, hero editorial (pakai foto di public/images/lifestyle bila ada; bila tidak, komposisi ProductArt di atas gradien porselen ke blush), pintasan kategori, Flash Sale dengan FlashCountdown dan QuotaBar (slot aktif, atau slot berikutnya bila belum ada yang aktif), ajakan Kuis Kulit, Terlaris, Baru, Pilihan per jenis kulit dalam tab, etalase merek, Jurnal, blok cabang.
2. Katalog /c/[kategori] dan /c/[kategori]/[sub]: chip sub kategori, FilterSheet (harga, merek dengan kotak cari, rating, jenis kulit, masalah kulit, finish, undertone, SPF, tersedia di cabang, sedang promo), chip filter aktif, urutan, jumlah hasil, muat bertahap 24 produk. Semua state filter di URL. Facet hanya menampilkan opsi yang punya hasil, lengkap dengan jumlahnya.
3. ProductCard sesuai BRIEF, termasuk tambah cepat yang membuka pemilih shade (popover di desktop, bottom sheet di HP).
4. Pencarian: saran instan (debounce 200 ms) untuk produk, merek, kategori; pg_trgm agar tahan salah ketik; /cari dengan filter yang sama; pencarian terakhir; hasil kosong yang tetap membantu.
5. /merek (direktori A sampai Z dengan pencarian) dan /merek/[merek] (header bernuansa warna merek).
6. /promo dan /flash-sale.
Kualitas: skeleton saat memuat, tanpa pergeseran layout, bisa dipakai dengan keyboard. Cek di lebar 375 px dan 1440 px.
Selesai: lint, typecheck, build. Laporkan yang dibuat, keputusan desainmu, dan yang belum.
```

### Prompt 3: Halaman produk (Fable 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Halaman produk, Logika bisnis (Produk, varian, harga; Stok per cabang; Ongkir), dan Shade Finder di Fitur pembeda AI.

Fase 3, halaman produk /p/[slug], halaman andalan demo:
1. Galeri: ProductArt per shade + 2 tampilan tambahan yang digambar kode (swatch tekstur, kemasan dari samping). Ganti shade = crossfade, URL ikut berubah (?shade=slug).
2. Info: breadcrumb, merek, nama, rating (sembunyikan bila 0 ulasan), terjual, PriceTag per varian, harga flash + hitung mundur bila sedang flash sale.
3. SwatchPicker dengan filter undertone; shade habis dicoret tapi bisa dipilih untuk "Kabari aku" (buat tabel restock_requests).
4. Shade Finder berbasis aturan: pilih kedalaman kulit 1 sampai 6 dan undertone lewat swatch kulit visual, sarankan shade terdekat; simpan ke localStorage dan ke profil kulit bila login.
5. StockByStore: stok di Gudang Online dan tiap cabang, label "Bisa diambil hari ini" bila sebelum cut-off 16.00 WIB dan cabang buka.
6. Jumlah, Tambah ke Keranjang (animasi produk terbang ke ikon keranjang), Beli Sekarang, Wishlist (tamu disimpan lokal), Bagikan ke WA.
7. Estimasi ongkir cepat. Buat modul ongkir sekarang di src/lib/shipping (tabel zona dan aturan berat dari BRIEF) karena nanti dipakai checkout.
8. Tab Manfaat, Kandungan (bahan aktif disorot), Cara Pakai, Detail. Chip Cocok untuk.
9. Ulasan: distribusi bintang, filter jenis kulit dan shade, foto, label Pembelian terverifikasi, paginasi.
10. Sering dibeli bersama (3 produk, total harga, tambah semua) dan Produk serupa.
11. Bar beli menempel di bawah layar HP.
12. SEO: metadata per produk, JSON-LD Product, gambar og dari ProductArt.
Selesai: uji unit Vitest untuk harga efektif varian, saran shade, dan hitung ongkir; lint, typecheck, build. Laporkan.
```

### Prompt 4: Keranjang sampai pesanan (Opus 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Keranjang, Checkout 3 langkah, Pembayaran sukses dan lacak, seluruh Logika bisnis, dan Model data.

Fase 4, dari keranjang sampai pesanan. Ini logika uang: kebenaran di atas segalanya.
1. Keranjang: CartDrawer + /keranjang; tamu memakai token cookie, digabung ke akun saat login; simpan untuk nanti; bilah gratis ongkir; voucher; validasi ulang harga dan stok setiap dibuka dan jelaskan ke pembeli bila ada yang berubah.
2. Mesin harga di server (src/lib/pricing) sebagai fungsi murni: harga efektif, subtotal, voucher (semua tipe dan syarat di BRIEF), poin (maks 50% subtotal), ongkir, total. Minimal 20 uji Vitest termasuk kasus tepi: flash sale berakhir di tengah checkout, kuota voucher habis, voucher yang tidak boleh digabung flash sale, poin melebihi batas.
3. Checkout 3 langkah sesuai BRIEF. Data wilayah: Jawa Timur lengkap sampai kecamatan, provinsi lain cukup sampai kota, dari dataset terbuka; bila tidak bisa diunduh, buat subset realistis dan catat. Pin peta opsional dengan Leaflet + OpenStreetMap. Ambil di Toko hanya menampilkan cabang yang stoknya cukup untuk semua item.
4. Pembuatan pesanan dalam SATU transaksi: kunci baris inventory, cek stok, tambah kolom dipesan, kurangi kuota flash sale, catat voucher, buat order, order_items, payment, dan stock_movements jenis pesan. Nomor RONA-YYMM-000001 berurutan.
5. Pembayaran simulasi: QRIS (QR dari payload dummy), VA per bank, Bayar di Toko. /bayar/[nomor] dengan hitung mundur 15 menit. Endpoint konfirmasi bergaya webhook dengan kunci idempoten. Saat DEMO_MODE ada tombol "Simulasikan pembayaran berhasil".
6. Kedaluwarsa: route yang bisa dipanggil cron untuk membatalkan pesanan tak dibayar lebih dari 15 menit dan melepas stok serta kuota, ditambah pengecekan saat pesanan dibuka.
7. State machine status pesanan sesuai BRIEF; transisi tidak sah ditolak; setiap transisi mencatat waktu dan pelaku.
8. Halaman sukses, /pesanan/[nomor] dengan OrderTimeline, /lacak (nomor pesanan + nomor WA).
9. Setiap transisi penting menulis pratinjau WA dan email ke tabel notifications (belum dikirim ke mana pun).
10. Uji Playwright: tamu membeli 2 produk dengan voucher lalu bayar QRIS simulasi sampai Dibayar; ambil di toko dengan Bayar di Toko.
Selesai: semua uji hijau, lint, typecheck, build. Laporkan alur yang sudah bisa diklik dan keputusan yang kamu ambil.
```

### Prompt 5: Akun pembeli (Opus 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Akun, Ulasan dan notifikasi, Voucher dan poin.

Fase 5, akun pembeli:
1. Masuk dengan nomor WA + OTP 6 digit. Saat DEMO_MODE, OTP ditampilkan di layar dan masuk Kotak Notifikasi, tidak dikirim. Batasi percobaan. Tombol "Masuk sebagai Pembeli Demo" di /tentang-demo.
2. /akun: profil, alamat (banyak, satu utama), pesanan per status, wishlist (digabung dari tamu), poin + riwayat, profil kulit, Kotak Notifikasi yang menampilkan pratinjau WA (gelembung chat) dan email.
3. Ulasan hanya untuk item pesanan Selesai: bintang, teks, foto (storage diabstraksikan, lokal saat dev), jenis kulit, shade. Bonus 50 poin untuk ulasan pertama. Perbarui rating rata-rata dan jumlah ulasan produk.
4. Poin otomatis saat pesanan Selesai, ditukar saat checkout, semua tercatat di points_ledger.
5. "Kabari aku": saat stok varian naik dari 0, buat notifikasi untuk peminatnya.
6. Keamanan: cookie sesi httpOnly, perlindungan CSRF untuk aksi form, rate limit OTP, pembeli hanya bisa melihat datanya sendiri.
Selesai: uji unit untuk poin dan ulasan, lint, typecheck, build. Laporkan.
```

### Prompt 6: Panel admin (Opus 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Panel admin, Logika bisnis, dan Model data.

Fase 6, panel admin di /admin:
1. Login staf terpisah dari pembeli (email + kata sandi). Peran Owner, Admin Online, Staf Cabang, Gudang, dengan izin per akun yang bisa diatur Owner. Staf Cabang hanya melihat lokasinya.
2. Layout admin: sidebar di desktop, menu bawah di HP, pencarian global (pesanan, produk, pelanggan).
3. Semua modul di tabel Modul BRIEF. Kedalaman prioritas: Pesanan (kanban seret antar status mengikuti state machine, aksi massal, cetak label kirim PDF ukuran A6, daftar ambil), Stok (matriks varian x lokasi, stok masuk, transfer, opname dengan selisih, riwayat), Produk (form varian dengan pemilih warna dan pratinjau ProductArt langsung), Promo (slot flash sale dengan kuota dan pratinjau harga), Laporan (grafik + unduh Excel multi-sheet).
4. Dashboard: omzet hari ini dan 30 hari, pesanan per status, rata-rata nilai pesanan, grafik omzet 30 hari, terlaris, stok menipis per cabang, daftar perlu tindakan. Muat ulang otomatis tiap 30 detik supaya pesanan baru langsung terlihat saat demo.
5. Kategori dan Merek dengan peringatan nama mirip (trigram atau Levenshtein) sebelum menyimpan.
6. Log aktivitas untuk setiap perubahan data penting.
7. Akun demo owner@rona.demo, admin@rona.demo, dinoyo@rona.demo dengan kata sandi dari env; tombol masuk cepat di /tentang-demo saat DEMO_MODE.
Selesai: uji unit untuk izin dan transfer stok, lint, typecheck, build. Laporkan beserta daftar halaman admin.
```

### Prompt 7: Rona Advisor (Opus 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Fitur pembeda AI.

Fase 7, AI:
1. Klien AI di src/lib/ai: Gemini lewat Cloudflare AI Gateway (env AI_GATEWAY_URL, GEMINI_API_KEY, AI_MODEL default gemini-3.5-flash). Timeout, satu kali retry, pesan gagal yang ramah.
2. AdvisorChat: tombol melayang di toko, panel chat dengan streaming. Model WAJIB memakai tool: cari_produk(filter), detail_produk(id), cek_stok(varian, lokasi), profil_kulit_saya(). Jawaban menampilkan kartu produk dari hasil tool dengan tombol tambah ke keranjang. Validasi di server: produk yang disebut harus ada di hasil tool. Tanpa klaim medis. Label "Jawaban AI bisa keliru". Batas 20 pesan per pengunjung per hari saat DEMO_MODE.
3. /kuis-kulit 6 langkah bergambar menghasilkan profil kulit; /rutinitas menyusun langkah pagi dan malam dari katalog berbasis aturan (AI hanya menulis penjelasan singkat bila tersedia), total harga, tambah semua ke keranjang.
4. Ringkasan ulasan per produk dihasilkan oleh job dan disimpan, bukan dibuat tiap kunjungan.
5. Admin: tombol "Tulis dengan AI" di form produk; halaman Kabar Harian untuk Owner dengan teks siap kirim WA.
6. Evaluasi: 15 pertanyaan uji (kulit berminyak, sensitif, budget 100 ribu, cari shade cushion untuk kulit sawo matang, dan seterusnya) yang memeriksa semua produk yang disebut benar-benar ada di katalog.
Selesai: lint, typecheck, build, jalankan evaluasi dan laporkan hasilnya.
```

### Prompt 8: Polish dan siap pamer (Fable 5)

```text
Baca CLAUDE.md dan docs/BRIEF.md, terutama Design system dan Konsep demo.

Fase 8, polish:
1. Audit visual semua halaman toko dan admin di 375, 768, dan 1440 px: jarak, tipografi, warna sesuai Design system. Perbaiki semua yang masih terasa template.
2. Motion: momen andalan di BRIEF (produk terbang ke keranjang, crossfade shade, hitung mundur halus, kemunculan bertahap saat digulir), transisi halaman ringan, hormati prefers-reduced-motion.
3. Gambar: konversi foto di public/images/lifestyle ke WebP responsif dengan blur placeholder; halaman tetap bagus bila foto tidak ada.
4. Performa: target Lighthouse mobile 90 ke atas untuk beranda, katalog, dan produk.
5. SEO dan berbagi: metadata semua halaman, sitemap, gambar og yang cantik. Karena datanya fiktif, seluruh situs noindex lewat robots dan meta.
6. Mode demo: DemoRibbon, /tentang-demo yang meyakinkan (fitur unggulan, cara mencoba, tombol akun demo, kredit dari env STUDIO_NAME dan STUDIO_URL), reset data harian lewat route cron yang dilindungi CRON_SECRET.
7. Aksesibilitas: kontras, fokus terlihat, label form, navigasi keyboard, alt text.
8. Halaman 404 dan error yang bermerek.
9. Cari dan hapus setiap em-dash di kode dan teks.
Selesai: lint, typecheck, build, semua uji. Laporkan skor Lighthouse dan daftar perubahan.
```

## Deploy dan skenario demo

Deploy pertama dilakukan setelah Prompt 4 (supaya alur beli sudah bisa dicoba online), lalu otomatis ter-update setiap kamu `git push`.

### Checklist deploy

- [ ] Buat akun Neon, buat project `rona-demo` di region Singapura, salin connection string versi pooled.
- [ ] Dari laptop, isi database produksi: `DATABASE_URL="<string Neon>" npm run db:reset`
- [ ] Buat akun Vercel dengan login GitHub, Import repo `rona-demo`; framework terdeteksi Next.js.
- [ ] Isi Environment Variables: DATABASE\_URL, SESSION\_SECRET, DEMO\_MODE=true, STUDIO\_NAME, STUDIO\_URL, CRON\_SECRET, kata sandi akun demo, dan (setelah Prompt 7) AI\_GATEWAY\_URL, GEMINI\_API\_KEY, AI\_MODEL.
- [ ] Set region fungsi ke Singapura supaya dekat dengan database.
- [ ] Deploy, buka alamat `.vercel.app`, coba beli sebagai tamu dari HP.
- [ ] Pasang cron reset data harian sekitar 03.00 WIB. Paket gratis membatasi frekuensi cron, karena itu pembatalan pesanan kedaluwarsa juga dicek saat pesanan dibuka (sudah ada di Prompt 4).
- [ ] Opsional: tambah domain `rona.<domain-studio-mu>` di Vercel, lalu buat record CNAME `rona` di Cloudflare DNS sesuai nilai yang ditunjukkan Vercel (mode DNS only dulu sampai terverifikasi).
- [ ] Uji tiga alur di HP: beli dan kirim, ambil di toko, serta masuk admin dan ubah status pesanan.
- [ ] Cek Lighthouse mobile untuk beranda, katalog, dan produk.
- [ ] Tandai versi: `git tag v1.0-demo && git push --tags`

### Skenario demo 5 menit untuk temanmu

1. Kirim link, minta dia buka di **HP-nya sendiri** supaya merasakan langsung.
2. Beranda: tunjukkan flash sale yang sedang berjalan dengan hitung mundur dan kuota.
3. Ketik "cusion" (sengaja salah ketik) dan tunjukkan hasilnya tetap cushion; aktifkan filter kulit berminyak.
4. Buka satu cushion: ganti shade, klik "Cari shade-ku", lihat stok di Rona Dinoyo.
5. Tanya Rona Advisor: "Sunscreen buat kulit berminyak di bawah 100 ribu?"
6. Checkout pilih Ambil di Toko, bayar QRIS, tekan simulasi bayar.
7. Di laptop, buka admin: pesanan baru muncul di dashboard, stok berubah, pindahkan kartu pesanan ke Siap Diambil.
8. Tutup dengan kalimat: "Ini demo dengan data fiktif. Untuk tokomu, merek, stok, dan cabangnya diganti dengan punyamu, dan bisa disambung ke kasir di toko."

Setelah dia tertarik, langkah berikutnya adalah sesi scoping dengan 5 pertanyaan yang sudah kita susun sebelumnya, lalu RAB per fitur.
