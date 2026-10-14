# Keputusan penting

Catatan keputusan yang membentuk Rona, dari Fase 1 sampai 8B, beserta alasan singkatnya. Disusun dari riwayat commit, BACKLOG, dan laporan tiap fase. Bila ingin mengubah salah satunya, baca alasannya dulu.

## Produk dan data

| Keputusan | Fase | Alasan |
| --- | --- | --- |
| 12 merek fiktif dan gambar produk ilustrasi `ProductArt`, tanpa foto atau nama merek nyata | 1 | Bebas masalah hak cipta dan merek dagang, tampilan tetap konsisten, dan setiap shade punya warna yang tepat. |
| Seed deterministik dengan angka acak berbenih | 1 | Data sama di setiap reset, sehingga uji, tangkapan layar, dan demo bisa diulang persis. |
| Riwayat penjualan 90 hari disisipkan massal | 6B | Dashboard dan Laporan perlu angka yang masuk akal sejak hari pertama. Sisip massal menjaga reset sekitar 2 detik. |
| Reset demo harian 03.00 WIB dan tombol reset Owner | 6A | Pengunjung bebas mencoba apa pun tanpa merusak demo untuk orang berikutnya. |
| Akun staf demo dikunci lebih ketat dari yang diminta (peran, izin, lokasi tidak bisa diubah) | 6A | Supaya pengunjung tidak bisa mengunci akun Owner demo untuk pengunjung berikutnya. |
| Data wilayah dari cahyadsn/wilayah, kecamatan hanya Jawa Timur | 4 | Cukup untuk toko di Malang. Provinsi lain mengisi kecamatan bebas. |

## Uang, stok, dan pesanan

| Keputusan | Fase | Alasan |
| --- | --- | --- |
| Uang disimpan sebagai bilangan bulat rupiah | 1 | Tidak ada galat pembulatan pecahan. |
| Waktu disimpan UTC, ditampilkan WIB | 1 | Satu zona penyimpanan, tampilan sesuai pembeli. Periode laporan dan batas jam kirim dihitung di WIB. |
| Mesin harga murni (`priceCart`) yang dihitung ulang di server di setiap langkah | 4 | Browser tidak pernah dipercaya untuk angka. Fungsi murni mudah diuji untuk semua kombinasi flash, promo, voucher, poin, dan ongkir. |
| Pesanan ditolak bila total di browser berbeda dengan hitungan server | 4 | Pembeli tidak pernah membayar harga yang tidak ia lihat, misal flash sale berakhir saat checkout. |
| Stok dipesan saat pesanan dibuat, dipotong saat dibayar | 4 | Pesanan yang tidak dibayar tidak menghabiskan stok fisik, tetapi stok yang sedang dibayar tidak bisa dijual dua kali. |
| Modul inventory sebagai satu-satunya pengubah stok, dengan buku besar `stock_movements` | 1, 4 | Saldo selalu bisa dijelaskan dan direkonstruksi. Penjaga stok negatif ada di satu tempat. |
| Penguncian baris stok berurutan menurut id | 4 | Mencegah deadlock saat dua pesanan berisi varian yang sama. |
| Satu pintu konfirmasi pembayaran yang idempoten | 4 | Webhook gateway bisa datang dua kali. Simulasi dan webhook memakai jalur yang sama. |
| Aturan status pesanan sebagai satu tabel | 4 | Layanan, tombol admin, kanban, dan uji membaca aturan yang sama. |
| Poin dengan buku besar dan kunci idempoten, tukar maksimal 50% | 5 | Saldo bisa diaudit, dan kejadian yang sama tidak pernah memberi poin dua kali. |
| Retur tidak mengembalikan stok otomatis | 5 | Barang retur perlu dicek dulu. Yang layak jual dicatat lewat Stok masuk. |
| Status moderasi ulasan bernama `tampil` (prompt menyebut "tayang") | 5 | Artinya sama. Enum tidak diganti supaya migrasi tetap aditif. |
| Tabrakan antar staf dicegah lewat status asal di klausa `WHERE` | 6A | Dua staf yang memproses pesanan yang sama: yang kedua ditolak dengan pesan jelas, tanpa kunci terpisah. |

## Arsitektur dan kecepatan

| Keputusan | Fase | Alasan |
| --- | --- | --- |
| Next.js App Router dengan Cache Components, data katalog di-cache dengan tag | 2 | Halaman katalog cepat dan murah. Stok dan harga tetap segar karena dibaca di dalam `Suspense`. |
| Helper tag cache terpusat (`src/lib/cache-tags.ts`) | 2 | Tag tidak pernah salah ketik, dan setiap modul yang mengubah data tahu tag apa yang harus dibersihkan. |
| Filter dan facet katalog dihitung di memori | 2 | Cukup cepat untuk 79 produk dan jauh lebih sederhana. Wajib pindah ke SQL sebelum toko ribuan produk (BACKLOG). |
| Pencarian dengan full-text Postgres dan `pg_trgm` | 1, 2 | Tahan salah ketik tanpa layanan pencarian berbayar. |
| Proxy memeriksa keberadaan produk sebelum routing | 3 | Dengan Cache Components, slug yang tidak ada akan dikirim sebagai kerangka 200. Proxy membuat 404 sungguhan. |
| Halaman produk memakai `instant = false` | 6B, dicek 8A | Halaman memang memblokir demi 404 sungguhan. Di Next 16.4 opsi ini hanya mengatur validasi saat pengembangan; prefetch produksi tetap berjalan. |
| Migrasi otomatis di build produksi dengan advisory lock | 6B | Cukup push untuk rilis. Migrasi gagal berarti build gagal dan versi lama tetap tayang. |
| Semua migrasi aditif | 1 | Versi lama aplikasi tetap jalan di atas skema baru, jadi rilis dan pembatalan rilis aman. |
| `ProductArt` sebagai gambar dari route `/art`, bukan SVG inline | 8A | HTML beranda turun dari 2.458 KB ke sekitar 790 KB. |
| Motion dimuat lewat `LazyMotion`, animasi sederhana dengan CSS | 8B | Motion hanya dimuat galeri produk. Bersama pemuatan saat dibutuhkan di bawah, JS awal beranda turun dari 711 ke 579 KB mentah. |
| Panel Advisor, laci keranjang, menu HP, tambah cepat, dan MegaMenu dimuat saat dibutuhkan | 8B | Kode yang belum dipakai tidak ikut di muatan awal. Dimuat lebih dulu saat ada tanda niat (hover, idle). |
| Kerangka halaman produk statis berisi judul dan gambar | 8B | Elemen LCP sudah ada di HTML pertama. Lighthouse produk naik dari 79 ke lebih dari 90. |

## Keamanan

| Keputusan | Fase | Alasan |
| --- | --- | --- |
| Pembeli masuk dengan OTP WhatsApp, tanpa kata sandi | 5 | Kebiasaan pembeli Indonesia. Di demo, kode tampil di layar. Di luar demo, masuk dimatikan sampai ada WA resmi. |
| Token sesi disimpan sebagai hash | 5 | Kebocoran database tidak langsung memberi sesi. |
| Staf masuk terpisah dengan scrypt dan kunci sementara | 6A | scrypt bawaan Node jalan di serverless tanpa pustaka native. |
| Izin berbasis kunci dengan satu fungsi `can()` | 6A | Satu keputusan untuk semua halaman dan aksi. Peran hanya templat, izin bisa ditambah atau dicabut per orang. |
| CSP dengan `'unsafe-inline'` untuk skrip | 8B | Nonce tidak cocok dengan prarender sebagian (PPR). Skrip dari domain lain tetap diblokir. Lihat docs/KEAMANAN.md. |
| Batas laju di Postgres untuk titik yang rawan ditebak | 8B | Berlaku di semua instance serverless tanpa layanan tambahan. Titik ringan memakai batas di memori. |
| Database uji terpisah untuk Vitest dan Playwright | 8B | Data uji pernah bocor ke tangkapan layar. Sekarang database kerja dan produksi hanya berisi seed. |
| Uji otorisasi berbasis ekspor modul | 8B | Aksi admin baru otomatis ikut diuji tanpa perlu diingat. |

## AI

| Keputusan | Fase | Alasan |
| --- | --- | --- |
| Gemini lewat Cloudflare AI Gateway | 7A | Satu titik untuk log, batas, dan cache, serta bisa ganti penyedia tanpa mengubah kode. |
| AI hanya merekomendasikan dari hasil tool katalog | 7A | Kartu produk selalu dari id nyata. Model tidak bisa mengarang produk atau harga. |
| Penjaga angka rupiah di jawaban Advisor dan Asisten Admin | 7C, 7B | Setiap angka di teks harus cocok dengan data. Jawaban yang melanggar diganti. |
| Atribut lunak di pencarian kalimat menjadi penambah peringkat, bukan filter | 7C | Kalimat panjang tidak boleh menyaring habis hasil. |
| Foto pembeli hanya di memori satu permintaan | 7C | Tidak ada foto wajah yang tersimpan di disk, Blob, database, atau log. |
| Satu otak untuk Asisten Admin, Kabar Harian, dan pintu WA | 7B | Aturan izin dan penjaga angka berlaku sama di semua pintu. |
| Tool Asisten Admin hanya membaca; saran menjadi draf | 7B | AI tidak pernah mengubah data. Staf yang menyetujui. |
| Hari raya tanpa tanggal ditanya balik oleh server, bukan oleh model | 8B | Tanggal hari raya berubah tiap tahun. Model sempat mengubah "Natal kemarin" menjadi satu tanggal sendiri dan menjawab Rp0. |
| Tingkat berpikir Gemini terendah yang didukung | 7C | Jawaban lebih cepat dan murah. Eval menunjukkan mutu tetap. |
| Toko tetap jalan tanpa AI | 7A | Semua fitur AI punya jalan pintas: pencarian biasa, kuis tanpa foto, narasi templat. |
| Mode mock deterministik untuk uji | 7A | Uji alur tidak bergantung jaringan atau biaya. |

## Reskin dan rilis

| Keputusan | Fase | Alasan |
| --- | --- | --- |
| Nama, palet, font, dan teks demo di `src/config`, dengan uji yang menolak nama merek di kode lain | 8B | Reskin klien cukup mengubah konfigurasi dan konten. |
| Sakelar fitur dibaca saat build | 8B | Nilai sama di server dan browser. Fitur yang mati hilang dari menu dan ditolak server. |
| Impor katalog CSV lewat aturan formulir admin dan modul inventory | 8B | Data klien melewati validasi yang sama, dan stok awal tercatat di buku besar. |
| Uji asap produksi hanya-baca | 8B | Situs tayang bisa diperiksa setelah rilis tanpa membuat pesanan atau data. |
| `noindex` di seluruh situs | 4.1 | Data fiktif tidak boleh muncul di mesin pencari. |
