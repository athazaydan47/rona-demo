# Fase 5: Akun pembeli

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md (termasuk Aturan cache), docs/BRIEF.md bagian Cara melabeli demo dengan jujur, Akun, Pembayaran sukses dan lacak, Voucher dan poin, Status pesanan, Ulasan dan notifikasi, Model data, lalu docs/BACKLOG.md dan docs/DEPLOY.md.

Situs sudah tayang di produksi (Vercel + Neon) dan setiap `git push` ke main langsung ter-deploy. Karena itu fase ini wajib aman untuk produksi: perubahan skema hanya lewat file migrasi yang bersifat menambah (kolom baru boleh null atau punya default), tidak ada `drizzle-kit push`, dan setiap env baru masuk ke `.env.example` serta tabel di docs/DEPLOY.md.

Pakai yang sudah ada: modul pricing (termasuk logika poin dari Fase 4), inventory, orders, state machine, notifications outbox beserta fungsi pembacanya, fungsi gabung keranjang tamu, pemilih wilayah di checkout, clock, formatRupiah, ProductArt, dan komponen UI yang ada.

## 0. Perbaikan kecil dari review Fase 4.1

1. Stepper checkout di 375 px terpotong ("Peneri...", "Pengiri..."). Pakai label pendek (Alamat, Kirim, Bayar) atau tampilkan label lengkap hanya untuk langkah aktif. Tidak boleh ada label terpotong di 375 px.
2. Posisi tombol Kembali tidak konsisten: di langkah 2 sebaris dengan tombol lanjut, di langkah 3 terpisah di atas. Samakan polanya di ketiga langkah.
3. Kurir instan tampil "Estimasi tiba hari ini" pada pukul 01.18. Kurir instan hanya bisa dipilih Senin sampai Sabtu pukul 08.00 sampai 17.00 WIB. Di luar itu tampil nonaktif dengan keterangan kapan tersedia lagi, misalnya "Tersedia lagi besok pukul 08.00". Logikanya di src/lib/shipping dan pakai clock, dengan uji.

## 1. Masuk dan sesi

1. Masuk dan daftar memakai alur yang sama: nomor WA, lalu OTP 6 digit. Nomor dinormalisasi dengan fungsi yang sama dengan checkout. Bila nomor belum terdaftar, akun dibuat setelah OTP benar, lalu pembeli diminta mengisi nama.
2. OTP:
   - Disimpan dalam bentuk hash, berlaku 5 menit, sekali pakai, maksimal 5 kali salah per kode.
   - Rate limit disimpan di database (bukan memori, karena serverless): kirim ulang paling cepat 60 detik, maksimal 3 permintaan per nomor per 10 menit dan 10 per hari, serta batas per IP yang wajar.
   - Pesan tidak boleh membocorkan apakah nomor sudah terdaftar.
   - Pengirim OTP lewat antarmuka adapter. Saat DEMO_MODE=true, OTP ditampilkan di layar dan masuk Kotak Notifikasi. Saat DEMO_MODE bukan true dan belum ada adapter WA sungguhan, halaman masuk menampilkan pesan bahwa login belum tersedia (jangan pernah menampilkan OTP).
3. Sesi:
   - Tabel sesi dengan token acak yang disimpan sebagai hash, sehingga bisa dicabut. Env baru `SESSION_SECRET` bila dibutuhkan untuk penandatanganan.
   - Cookie httpOnly, Secure di produksi, SameSite=Lax, berlaku 30 hari dan diperpanjang saat aktif.
   - Keluar mencabut sesi di server. Tersedia juga "Keluar dari semua perangkat".
4. Saat berhasil masuk:
   - Gabungkan keranjang tamu (fungsi dari Fase 4) dan wishlist tamu.
   - Klaim pesanan tamu yang nomor WA-nya sama dengan nomor yang baru saja terverifikasi OTP, termasuk notifikasinya.
   - Tombol "Simpan pesanan ini ke akunmu" di halaman sukses kini mengarah ke alur masuk, lalu kembali ke pesanan tersebut.
5. Header: ikon akun membuka alur masuk bila belum masuk, atau ke /akun bila sudah. Tampilkan badge jumlah notifikasi belum dibaca.
6. Akun demo:
   - Seed satu akun "Pembeli Demo" dengan nomor yang jelas fiktif.
   - Datanya lengkap dan deterministik: 2 alamat (satu utama), pesanan di berbagai status (minimal satu Selesai yang belum diulas, satu Dikirim, satu Menunggu Pembayaran), saldo poin dengan riwayat, wishlist, profil kulit, dan notifikasi.
   - Tombol "Masuk sebagai Pembeli Demo" di /tentang-demo (buat halaman ini secara sederhana bila belum ada) dan di halaman masuk. Tombol ini hanya ada dan hanya berfungsi saat DEMO_MODE=true, tanpa OTP.

## 2. Halaman /akun

Tata letak: menu samping di desktop, daftar menu di HP. Semua halaman hanya menampilkan data milik pembeli yang sedang masuk.

1. **Ringkasan**: sapaan, saldo poin, pesanan aktif, dan pintasan ke halaman lain.
2. **Profil**: nama dan email. Mengganti nomor WA wajib OTP ke nomor baru.
3. **Alamat**:
   - Tambah, ubah, dan hapus alamat, maksimal 10, dengan tepat satu alamat utama.
   - Memakai pemilih wilayah dan pin peta yang sama dengan checkout.
4. **Pesanan**:
   - Tab per status dengan paginasi.
   - Kartu pesanan berisi ProductArt, nomor, tanggal WIB, total, dan status.
   - Kartu mengarah ke /pesanan/[nomor], yang kini juga bisa dibuka pemiliknya tanpa token.
5. **Wishlist**: daftar produk dengan harga dan stok terkini serta tombol tambah ke keranjang. Ikon hati di seluruh situs tersambung ke server saat sudah masuk.
6. **Poin**: saldo, nilai rupiahnya, riwayat dari points_ledger, dan penjelasan singkat cara mendapat dan memakai poin.
7. **Profil kulit**:
   - Formulir jenis kulit, masalah kulit, undertone, dan preferensi finish. Disimpan di customers.profil_kulit.
   - Kuis kulit akan mengisinya di Fase 7, jadi bentuk datanya dibuat sekarang dan dicatat di BRIEF.
8. **Kotak Notifikasi**:
   - Pratinjau WA dalam bentuk gelembung chat dan pratinjau email.
   - Penanda belum dibaca, serta tombol tandai semua dibaca.

Checkout untuk pembeli yang sudah masuk:
- Data penerima terisi dari profil.
- Pilih alamat tersimpan, dengan opsi simpan alamat baru.
- Kolom tukar poin dengan sakelar "Pakai 1.250 poin, hemat Rp 1.250". Batas maksimal 50% tetap dihitung di server.

## 3. Poin

1. Pemberian poin: 1 poin per Rp 1.000 dari nilai belanja bersih (subtotal setelah diskon produk dan voucher, dikurangi poin yang dipakai, tanpa ongkir), dibulatkan ke bawah, diberikan saat pesanan menjadi Selesai.
   - Idempoten: satu pesanan hanya sekali memberi poin, dijaga oleh referensi unik di ledger.
   - Tambahkan aturan rumus ini ke BRIEF (hanya menambah).
2. Penukaran poin:
   - Poin dikurangi di transaksi yang sama dengan pembuatan pesanan, dengan mengunci baris customer.
   - Poin dikembalikan bila pesanan dibatalkan atau kedaluwarsa.
3. Pesanan Diretur menarik kembali poin yang diberikan. Saldo tidak boleh negatif: bila tidak cukup, tarik sebanyak yang ada dan catat alasannya.
4. Setiap gerakan poin tercatat di points_ledger, dan saldo di customers selalu sama dengan jumlah ledger. Sediakan fungsi pemeriksa konsistensi beserta ujinya.

## 4. Pesanan diterima dan simulasi pengiriman

1. Di /pesanan/[nomor] status Dikirim, pembeli bisa menekan "Pesanan diterima", yang menjadi Selesai lewat state machine.
2. Selesai otomatis 3 hari setelah Dikirim. Ikut dijalankan oleh route cron harian yang sudah ada dan oleh pengecekan saat pesanan dibuka.
3. Saat DEMO_MODE=true, pesanan kirim berstatus Dibayar punya tombol "Simulasikan toko: proses dan kirim pesanan". Tombol ini menjalankan Diproses lalu Dikirim dengan resi dummy, supaya pengunjung demo bisa mencoba alur sampai ulasan tanpa panel admin. Di luar DEMO_MODE, tombol dan route-nya tidak ada.

## 5. Ulasan

1. Ulasan hanya untuk item pesanan Selesai milik pembeli tersebut, satu ulasan per item.
   - Tombol "Tulis ulasan" muncul di /pesanan/[nomor] dan di /akun/pesanan.
2. Isi ulasan:
   - Bintang 1 sampai 5 dan teks minimal 20 karakter.
   - Jenis kulit, terisi dari profil kulit dan bisa diubah.
   - Shade terisi otomatis dari item.
   - Foto maksimal 3.
3. Foto:
   - Dikompresi di browser (sisi terpanjang 1600 px, WebP), lalu divalidasi lagi di server (jenis file, ukuran, dimensi).
   - Penyimpanan lewat adapter: disk lokal saat dev, Vercel Blob di produksi bila `BLOB_READ_WRITE_TOKEN` ada.
   - Bila token tidak ada di produksi, unggah foto dinonaktifkan dengan pesan yang ramah, tapi ulasan teks tetap bisa dikirim.
4. Ulasan langsung tayang dengan status moderasi "tayang". Panel admin di Fase 6 akan bisa menyembunyikan dan membalas.
5. Ulasan pertama memberi bonus 50 poin, hanya sekali per pembeli, idempoten.
6. Rating rata-rata dan jumlah ulasan produk dihitung ulang di server, lalu revalidasi tag produk.
7. Di halaman produk, ulasan dari pesanan nyata diberi label "Pembeli terverifikasi" beserta shade dan jenis kulitnya.

## 6. Kabari aku

1. Di varian yang stok online-nya habis, tombol "Kabari aku" menyimpan minat. Pembeli harus masuk dulu, dan setelah masuk kembali ke produk itu.
2. Saat stok tersedia Gudang Online untuk varian itu naik dari 0 menjadi lebih dari 0 (di dalam modul inventory, jadi semua jalur perubahan stok ikut), buat notifikasi untuk setiap peminat, lalu tandai minatnya selesai.
3. Pembeli bisa melihat dan membatalkan daftar "Kabari aku" miliknya di /akun.

## 7. Keamanan

1. Setiap server action dan route handler mengambil identitas pembeli hanya dari sesi, tidak pernah dari isian formulir atau parameter.
2. Uji IDOR: pembeli A tidak bisa membaca atau mengubah alamat, pesanan, ulasan, wishlist, notifikasi, atau poin milik pembeli B.
3. Server action Next.js sudah memeriksa Origin. Route handler yang menerima POST dari browser wajib memeriksa Origin juga. Jelaskan perlindungan CSRF yang dipakai di laporan.
4. Halaman /akun dan data pribadi tidak boleh di-cache. Ikuti Aturan cache di CLAUDE.md.
5. Jangan mencatat OTP, token sesi, atau nomor WA lengkap di log.

## 8. Uji

1. Vitest:
   - OTP dengan clock palsu: kedaluwarsa, sekali pakai, batas salah, rate limit, dan kirim ulang.
   - Sesi: buat, cabut, perpanjang.
   - Poin: rumus pemberian termasuk pembulatan, idempoten, tukar dengan batas 50%, kembali saat batal dan kedaluwarsa, tarik saat retur tanpa saldo negatif, pemeriksa konsistensi.
   - Ulasan: syarat Selesai, satu per item, bonus pertama sekali, hitung ulang rating.
   - Kabari aku: terpicu tepat sekali saat stok naik dari 0.
   - Klaim pesanan tamu dan gabung wishlist.
   - Kurir instan di dalam dan di luar jam operasional.
   - Uji IDOR.
2. Playwright:
   - Tamu membeli, lalu masuk dengan nomor WA yang sama lewat OTP demo. Pesanan muncul di /akun/pesanan dan keranjang tergabung.
   - Pembeli Demo checkout dengan alamat tersimpan dan tukar poin, bayar simulasi, simulasikan kirim, tekan Pesanan diterima. Poin bertambah sesuai rumus, ulasan pertama dikirim, bonus 50 poin masuk, dan rating produk berubah.
   - Pembeli tidak bisa membuka /pesanan milik orang lain.

## 9. Cuplik

Tambahkan aksi "akun" pada skrip cuplik yang memotret:
- Halaman masuk dengan OTP demo tampil.
- /akun ringkasan, alamat, pesanan, poin, profil kulit, dan Kotak Notifikasi.
- Formulir ulasan.
- Checkout langkah 3 dengan poin dipakai.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run cuplik -- --nama=fase5 --halaman=/akun --aksi=akun`. Targetkan maksimal 2 lembar.
3. Jangan buka gambarnya.
4. Perbarui docs/BACKLOG.md, docs/DEPLOY.md (env baru dan langkah migrasi), dan `.env.example`.
5. Commit dengan pesan "feat: akun pembeli, poin, ulasan (fase 5)". Jangan push.
6. Laporkan:
   - Yang dibuat dan keputusan yang kamu ambil sendiri.
   - Hasil semua uji (jumlah dan yang dilewati).
   - Daftar migrasi baru dan apakah semuanya aman dijalankan selagi versi lama masih tayang.
   - Env baru yang harus aku isi di Vercel.
   - Urutan persis yang harus aku jalankan untuk memperbarui produksi (migrasi atau reset Neon, isi env, lalu push).
   - File cuplik, dan apa yang perlu aku cek manual.
