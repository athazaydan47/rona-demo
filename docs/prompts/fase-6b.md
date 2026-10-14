# Fase 6B: Katalog, promo, pengaturan, dan data riwayat

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md (termasuk Aturan cache), docs/BRIEF.md bagian Arsitektur informasi, Logika bisnis (Produk varian harga, Flash sale, Voucher dan poin, Stok per cabang, Ongkir), Panel admin, Model data, Design system, lalu docs/BACKLOG.md dan docs/DEPLOY.md.

Sisa panel admin dibagi dua:
- **Fase 6B (ini):** perbaikan review 6A, data riwayat penjualan, Produk, Kategori dan Merek, Promo, dan Pengaturan.
- **Fase 6C (nanti):** Ulasan, Pelanggan, Laporan dengan unduh Excel, dan adapter email.

Aturan produksi tetap berlaku:
- Migrasi hanya bersifat menambah, tanpa `drizzle-kit push`.
- Env baru masuk ke `.env.example` dan docs/DEPLOY.md.
- Commit tanpa push.

Pakai yang sudah ada: `can()` dan daftar izin, layout admin, audit_logs, modul inventory, pricing, flash (termasuk ensureFlashSaleSlots), shipping, cache tags, ProductArt, Blob adapter dari Fase 5, dan seed runtime dari Fase 6A.

## 0. Perbaikan dari review Fase 6A

1. **Opname di HP.** Di 375 px tabel opname terpotong ke kanan. Opname justru dikerjakan staf sambil berdiri di depan rak dengan HP, jadi di layar kecil ubah menjadi daftar kartu:
   - Isi kartu: nama, shade, SKU, angka sistem, kolom fisik besar yang mudah diketuk (keyboard angka), dan selisih berwarna.
   - Bilah bawah yang menempel menampilkan jumlah baris terisi dan total selisih, dengan tombol simpan.
2. **Kanban terlalu padat di 1440 px.**
   - Kolom akhir (Selesai, Dibatalkan, Diretur) dibuat sempit dan terlipat, berisi jumlah dan tautan ke tampilan tabel. Kolom tersebut hanya menampilkan 14 hari terakhir.
   - Kolom aktif mendapat ruang lebih lebar sehingga teks kartu terbaca.
3. **Log aktivitas dibanjiri catatan login.** Sembunyikan kejadian login secara default, dengan sakelar "Tampilkan login". Login berulang dari staf yang sama dalam 10 menit digabung menjadi satu baris.
4. **Ganti `window.prompt`.** Konfirmasi reset demo dan atur ulang kata sandi memakai dialog dari komponen UI yang ada.

## 0b. Deploy cukup dengan push

Memperbarui produksi saat ini terlalu manual: aku harus mengisi URL Neon di terminal, menjalankan migrasi atau reset dari laptop, baru push. Ubah supaya cukup `git push`.

1. **Migrasi otomatis saat build Vercel.**
   - Jalankan `db:deploy` sebelum `next build`, hanya bila `VERCEL_ENV=production`. Pakai `DATABASE_URL_UNPOOLED` bila ada.
   - Build preview tidak boleh memigrasi, karena preview dan produksi memakai database yang sama.
   - Bila migrasi gagal, build harus gagal, supaya versi lama tetap tayang dan tidak ada kode baru yang jalan di atas skema lama.
2. **Pengamanan migrasi.**
   - Jalankan dengan advisory lock Postgres supaya dua build bersamaan tidak memigrasi berbarengan.
   - Catat di log build migrasi mana yang dijalankan.
3. **Data demo setelah deploy.**
   - Bila seed berubah, cukup tekan "Reset data demo sekarang" di admin Owner atau tunggu reset harian.
   - Tambahkan versi seed (angka atau hash) yang tampil di halaman Owner. Bila versi seed di kode lebih baru dari yang terakhir dipakai reset, tampilkan pemberitahuan "Data demo versi baru tersedia, reset sekarang?"
4. **Dokumentasi.** Perbarui docs/DEPLOY.md: alur normal sekarang cukup push, isi env baru bila ada, lalu reset demo dari admin bila perlu. Cara manual dari laptop tetap ditulis sebagai cadangan darurat.
5. **Uji.** Uji logika "hanya produksi" dan perilaku gagal migrasi dengan simulasi.

## 1. Data riwayat penjualan

Dashboard dan laporan terlihat kosong karena pesanan hanya berasal dari beberapa hari terakhir. Calon klien menilai dari tampilan ini, jadi buat riwayat 90 hari yang realistis dan deterministik:

1. **Volume dan pola.**
   - Sekitar 8 sampai 25 pesanan per hari.
   - Lebih ramai di akhir pekan dan sekitar tanggal gajian (tanggal 25 sampai 5).
   - Lonjakan saat slot flash sale.
   - Sepi di malam hari.
2. **Campuran pesanan.**
   - Kirim dan Ambil di Toko di ketiga cabang, dengan semua metode bayar.
   - Sebagian memakai voucher dan poin.
   - Status sebagian besar Selesai, sebagian kecil Dibatalkan, beberapa Diretur. Beberapa hari terakhir masih punya pesanan aktif.
3. **Pelanggan fiktif.** Sekitar 150 pelanggan dengan nama Indonesia yang jelas fiktif dan nomor berawalan 0800. Sebagian membeli berulang, supaya segmen pelanggan di 6C bermakna.
4. **Konsistensi data adalah syarat utama.**
   - Pesanan historis dibuat dengan rumus pricing yang sama.
   - Buku stok konsisten: jumlah semua stock_movements per varian per lokasi sama dengan stok fisik saat ini. Caranya, tulis stok awal sebagai gerakan masuk di hari pertama, lalu gerakan keluar sesuai pesanan.
   - Poin pelanggan sama dengan jumlah points_ledger.
   - Jumlah terjual produk sesuai dengan penjualan.
   - Sediakan pemeriksa konsistensi sebagai skrip dan uji.
5. **Waktu relatif.** Riwayat dihitung mundur dari tanggal reset, sehingga demo selalu tampak "hidup" setiap hari setelah reset harian.
6. **Kecepatan reset.**
   - Pakai insert massal (beberapa kueri besar, bukan ribuan kueri kecil).
   - Laporkan jumlah kueri dan durasi reset lokal sebelum dan sesudah.
   - Targetkan reset di produksi tetap di bawah 15 detik.

## 2. Produk

1. **Daftar produk** dengan pencarian, filter merek, kategori, dan status (aktif, draf, arsip), paginasi, serta kolom harga dan stok total.
2. **Formulir tambah dan ubah produk.**
   - **Info:** nama, merek, kategori, bentuk kemasan untuk ProductArt, deskripsi per tab (manfaat, kandungan, cara pakai), bahan aktif, cocok untuk kulit, masalah kulit, finish, SPF, BPOM, dan netto.
   - **Varian (tabel yang bisa ditambah baris):**
     - Nama shade, pemilih warna hex dengan pratinjau, undertone, kedalaman 1 sampai 6.
     - SKU (dibuat otomatis, bisa diubah), barcode, berat gram.
     - Harga normal, harga jual dengan persen diskon otomatis.
     - Aktif atau tidak.
   - **Pratinjau ProductArt langsung** yang berubah saat kemasan, warna, atau shade diubah.
   - **Foto opsional** lewat Blob adapter.
   - **SEO:** slug, judul meta, dan deskripsi meta dengan penghitung karakter, plus pratinjau tampilan hasil pencarian.
   - **Status:** aktif, draf, atau arsip.
3. **Aturan.**
   - SKU unik.
   - Harga jual tidak boleh melebihi harga normal.
   - Pembulatan harga promo mengikuti BRIEF.
   - Varian baru otomatis mendapat baris inventory 0 di semua lokasi lewat modul inventory.
   - Produk yang sudah punya pesanan tidak bisa dihapus, hanya diarsipkan.
   - Duplikat produk tersedia untuk mempercepat input.
4. **Setelah disimpan.**
   - Revalidasi cache tag yang terkait.
   - Setiap perubahan harga dan status tercatat di log aktivitas dengan data sebelum dan sesudah.
   - Draf dan arsip tidak tampil di toko dan menghasilkan 404.

## 3. Kategori dan Merek

1. **Pohon kategori seret-lepas.** Maksimal 2 tingkat dan maksimal 8 sub kategori per induk, sesuai BRIEF. Urutan bisa diubah.
2. **Peringatan nama mirip** sebelum menyimpan kategori atau merek baru, memakai pg_trgm similarity atau Levenshtein. Contoh: "Lip Blam" mirip "Lip Balm". Admin tetap bisa memilih "Tetap simpan".
3. **Penghapusan.** Kategori yang masih punya produk tidak bisa dihapus. Tawarkan pindahkan produk dulu.
4. **Merek:** nama, slug, warna merek (dipakai ProductArt), dan deskripsi. Perubahan merevalidasi halaman merek dan produk terkait.

## 4. Promo

1. **Flash sale.**
   - Daftar slot dalam tampilan kalender mingguan dan daftar. Buat slot dengan tanggal dan jam (preset 12.00 sampai 14.00 dan 20.00 sampai 22.00, atau kustom).
   - Tambah varian ke slot dengan harga flash, kuota, dan maksimal per pembeli. Tampilkan pratinjau harga coret dan persen diskon.
   - Validasi: harga flash harus di bawah harga efektif. Beri peringatan bila kuota melebihi stok online tersedia.
   - Slot yang sedang berjalan bisa diubah dengan konfirmasi dan tercatat di log.
   - Jelaskan dan tegaskan hubungan slot buatan admin dengan slot otomatis dari ensureFlashSaleSlots: slot buatan admin selalu menang, dan slot otomatis tidak boleh menimpanya.
2. **Promo harga per varian dengan periode**, mengikuti urutan harga di BRIEF.
3. **Voucher.**
   - CRUD lengkap untuk semua tipe dan syarat di BRIEF.
   - Statistik pemakaian (terpakai, sisa kuota, total potongan).
   - Nonaktifkan voucher tanpa menghapus riwayatnya.
4. **Banner beranda.**
   - Gambar atau komposisi ProductArt, judul, teks, dan tautan.
   - Jadwal tayang mulai dan selesai, serta urutan.
   - Pratinjau di 375 dan 1440 px.
   - Pesan PromoBar juga diatur di sini.

## 5. Pengaturan

1. **Profil toko:** nama, nomor WA toko, email, dan alamat.
2. **Cabang:** alamat, koordinat, jam buka per hari, hari libur, dan bisa ambil di toko atau tidak.
3. **Operasional:**
   - Cut-off kirim dan ambil.
   - Jam operasional kurir instan.
   - Kurir aktif dan tabel tarif per zona.
   - Metode bayar aktif.
   - Ambang stok menipis.
   - Batas dan nilai gratis ongkir otomatis.
4. **Penerapan ke logika.**
   - Semua nilai ini kini dibaca dari pengaturan, bukan konstanta di kode. Nilai bawaan tetap sama dengan aturan sekarang, dan uji yang ada tetap lulus.
   - Pembacaan pengaturan di-cache dengan tag dan direvalidasi saat disimpan.
   - Perubahan tercatat di log dengan data sebelum dan sesudah.
5. **Mode demo.** Saat DEMO_MODE=true, pengaturan tetap bisa diubah pengunjung, karena reset harian akan memulihkannya. Tampilkan pemberitahuan kecil soal itu.

## 6. Uji

1. **Vitest:**
   - Pemeriksa konsistensi data riwayat (stok, poin, terjual).
   - Determinisme seed riwayat.
   - Validasi produk dan varian.
   - Peringatan nama mirip.
   - Aturan pohon kategori.
   - Prioritas slot admin terhadap slot otomatis.
   - Validasi flash sale dan voucher.
   - Pengaturan yang mengubah cut-off, gratis ongkir, dan ambang stok benar-benar mengubah hasil logika.
   - Izin setiap halaman baru.
2. **Playwright:**
   - Admin Online membuat produk baru dengan 2 shade. Produk tampil di toko dengan stok habis. Akun Gudang melakukan stok masuk. Pembeli dengan "Kabari aku" menerima notifikasi.
   - Owner membuat slot flash sale untuk varian tertentu. Dengan clock dimajukan ke jam slot, harga flash tampil di halaman produk dan checkout.
   - Owner membuat voucher baru, dan pembeli memakainya di checkout.
   - Owner mengubah batas gratis ongkir. Bilah progres di keranjang ikut berubah.

## 7. Cuplik

Tambahkan aksi "admin-6b" pada skrip cuplik yang memotret:
- Dashboard Owner dengan data riwayat.
- Daftar produk.
- Formulir produk dengan pratinjau ProductArt.
- Pohon kategori dan peringatan nama mirip.
- Kalender flash sale.
- Formulir voucher.
- Banner.
- Pengaturan.
- Opname di HP.
- Kanban yang baru.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run cuplik -- --nama=fase6b --halaman=/admin --aksi=admin-6b`. Targetkan maksimal 2 lembar.
3. Jangan buka gambarnya.
4. Perbarui docs/BACKLOG.md, docs/DEPLOY.md, `.env.example`, dan BRIEF (hanya menambah) bila ada aturan baru.
5. Commit dengan pesan "feat: katalog, promo, pengaturan, data riwayat (fase 6b)". Jangan push.
6. Laporkan:
   - Yang dibuat dan keputusan yang kamu ambil sendiri.
   - Hasil semua uji (jumlah dan yang dilewati).
   - Jumlah kueri dan durasi reset sebelum dan sesudah data riwayat.
   - Migrasi baru dan apakah aman selagi versi lama tayang.
   - Env baru.
   - Urutan persis memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual.
