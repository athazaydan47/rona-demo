# Fase 6A: Panel admin inti

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md (termasuk Aturan cache), docs/BRIEF.md bagian Cara melabeli demo dengan jujur, seluruh Logika bisnis (termasuk tabel transisi status dan Pengecualian Bayar di Toko), Panel admin, Model data, lalu docs/BACKLOG.md dan docs/DEPLOY.md.

Panel admin dibagi dua fase. Fase 6A (ini) membangun fondasi dan modul yang paling sering dipakai saat demo: login staf, peran dan izin, layout, Dashboard, Pesanan, Stok, Log aktivitas, dan reset harian demo. Fase 6B nanti mengerjakan Produk, Kategori dan Merek, Promo, Ulasan, Pelanggan, Laporan, Pengaturan, dan adapter email. Rancang navigasi dan izin sekarang untuk semua modul, tapi modul 6B cukup tampil sebagai menu dengan halaman "Segera hadir".

Situs sudah tayang di produksi dan setiap push langsung ter-deploy. Aturan produksi dari Fase 5 tetap berlaku: migrasi hanya bersifat menambah, tanpa `drizzle-kit push`, env baru masuk ke `.env.example` dan docs/DEPLOY.md, commit tanpa push.

Pakai yang sudah ada: modul inventory (satu-satunya jalan mengubah stok), orders dan state machine, notifications outbox, clock, formatRupiah, ProductArt, pola rate limit dan sesi dari Fase 5, serta komponen UI yang ada.

## 0. Perbaikan dari review Fase 5

1. Tautan di isi notifikasi tertulis `http://localhost:3000/...` karena alamat situs ikut tertanam saat seed. Simpan path relatif di database, lalu tambahkan alamat situs saat notifikasi ditampilkan atau dikirim.
2. Kotak Notifikasi terlalu panjang karena semua email tampil penuh. Tampilkan pratinjau beberapa baris saja dengan tombol buka atau tutup, dan paginasi 20 notifikasi per halaman.

## 1. Login staf, peran, dan izin

1. Login staf terpisah total dari pembeli:
   - Email dan kata sandi, di /admin/masuk.
   - Kata sandi di-hash dengan algoritma modern lewat pustaka yang pasti jalan di Vercel serverless (pilih sendiri, jelaskan alasannya).
   - Tabel sesi staf dan nama cookie sendiri. Sesi berlaku 12 jam, httpOnly, Secure di produksi, SameSite=Lax.
   - Rate limit login di database. Kunci sementara setelah beberapa kali gagal. Pesan error tidak membocorkan apakah email terdaftar.
2. Izin berbasis kunci, misalnya `pesanan.lihat`, `pesanan.ubah_status`, `pesanan.batalkan`, `stok.lihat`, `stok.masuk`, `stok.transfer`, `stok.opname`, `produk.kelola`, `promo.kelola`, `ulasan.kelola`, `pelanggan.lihat`, `laporan.lihat`, `laporan.keuangan`, `pengaturan.kelola`, `staf.kelola`, `log.lihat`. Lengkapi bila perlu.
3. Empat peran bawaan sebagai templat izin: Owner, Admin Online, Staf Cabang, Gudang (lihat tabel di BRIEF).
   - Owner bisa menambah atau mencabut izin per akun di luar templat (pola ISBB).
   - Setiap akun punya daftar lokasi yang diampu. Staf Cabang hanya melihat dan mengubah data lokasinya.
4. Fungsi murni `can(staf, izin, { lokasiId })` sebagai satu-satunya sumber keputusan izin.
   - Dipakai di setiap server action dan route admin.
   - Menyembunyikan menu atau tombol di UI hanya pelengkap, bukan pengaman.
5. Halaman Staf (khusus Owner):
   - Daftar akun, tambah akun, ubah peran, centang izin tambahan, dan pilih lokasi.
   - Nonaktifkan akun (sesi aktifnya ikut dicabut) dan atur ulang kata sandi.
6. Akun demo:
   - Seed `owner@rona.demo`, `admin@rona.demo`, `dinoyo@rona.demo`, dan `gudang@rona.demo`, dengan kata sandi dari env `DEMO_STAFF_PASSWORD`.
   - Saat DEMO_MODE=true, /tentang-demo dan /admin/masuk menampilkan tombol masuk cepat untuk Owner, Admin Online, Staf Cabang Dinoyo, dan Gudang. Perbarui teks "akan tersedia setelah..." di /tentang-demo.
   - Saat DEMO_MODE=true, akun demo tidak bisa dihapus, dinonaktifkan, atau diganti kata sandinya, supaya pengunjung tidak mengunci pengunjung berikutnya.

## 2. Layout admin

1. Desktop: sidebar menu sesuai izin.
2. HP: menu bawah berisi maksimal 5 menu terpenting sesuai peran, sisanya di menu "Lainnya". Staf cabang biasanya hanya pegang HP, jadi semua halaman 6A wajib nyaman di 375 px.
3. Pencarian global (Cmd+K di desktop, ikon cari di HP) untuk pesanan, produk, dan pelanggan. Hasilnya ikut dibatasi izin dan lokasi.
4. Gaya visual tetap keluarga Rona tapi lebih padat, cocok untuk kerja harian: tabel rapi, angka rata kanan, status berwarna konsisten dengan toko.
5. Semua halaman /admin: noindex, tidak di-cache, dan butuh sesi staf. Tanpa sesi, arahkan ke /admin/masuk lalu kembali ke halaman tujuan.

## 3. Dashboard

1. Omzet hari ini dan 30 hari, jumlah pesanan per status, rata-rata nilai pesanan, grafik omzet 30 hari, produk terlaris, stok menipis per cabang, dan daftar "Perlu tindakan".
2. Definisi omzet ditulis di BRIEF (hanya menambah):
   - Jumlah total pesanan yang sudah mencapai Dibayar, dikurangi yang kemudian Dibatalkan atau Diretur.
   - Dikelompokkan per tanggal bayar dalam WIB.
3. "Perlu tindakan" berisi:
   - Pesanan Dibayar yang belum diproses lebih dari 2 jam.
   - Bayar di Toko yang akan kedaluwarsa hari ini.
   - Pesanan Siap Diambil lebih dari 3 hari.
   - Varian habis yang punya peminat "Kabari aku".
   - Ambang stok menipis default 5, nanti diatur di Pengaturan (6B).
4. Angka keuangan hanya tampil bagi yang punya izin `laporan.keuangan`. Staf Cabang hanya melihat data lokasinya.
5. Dashboard memuat ulang data otomatis tiap 30 detik dan berhenti saat tab tidak aktif. Pesanan baru diberi sorotan singkat supaya terlihat saat demo HP dan laptop berdampingan.

## 4. Pesanan

1. **Papan kanban per status (desktop).**
   - Kartu bisa diseret antar kolom hanya untuk transisi yang sah menurut state machine. Bila tidak sah, kartu kembali dan alasannya ditampilkan.
   - Transisi yang butuh isian membuka dialog dulu: Dikirim wajib nomor resi dan kurir, Dibatalkan wajib alasan.
   - Di HP, kanban berubah menjadi tab status dengan daftar kartu.
2. **Tampilan tabel** dengan filter status, metode (kirim atau ambil), lokasi, kurir, rentang tanggal, dan pencarian, plus paginasi.
3. **Halaman detail pesanan admin:**
   - Lini masa, item dengan ProductArt, rincian harga, pembayaran, data pembeli, alamat atau cabang, dan catatan.
   - Tombol aksi sesuai status dan izin.
   - Tombol hubungi pembeli via WA berisi pesan siap kirim.
4. **Aksi massal**: proses pesanan terpilih, cetak label, cetak daftar ambil.
5. **Label kirim PDF ukuran A6**, dibuat di server dengan pustaka yang jalan di Vercel. Isinya:
   - Nomor pesanan dengan barcode atau QR.
   - Pengirim (Rona Beauty, Gudang Online) dan penerima.
   - Kurir dan layanan, berat, jumlah barang, dan catatan.
   - Sediakan juga halaman pratinjau HTML dari label yang sama untuk cuplik.
6. **Daftar ambil PDF A4**: item dari pesanan terpilih dijumlahkan per varian, berisi SKU, nama, shade, jumlah, dan lokasi.
7. **Aksi Staf Cabang** untuk pesanan Ambil di Toko di lokasinya:
   - "Siapkan pesanan" (Dibayar ke Diproses ke Siap Diambil).
   - "Tandai sudah diambil".
   - Untuk Bayar di Toko: "Tandai lunas dan sudah diambil" dalam satu aksi, sesuai BRIEF.
8. **Pembatalan oleh admin** memakai logika yang sudah ada: stok, kuota flash, voucher, dan poin dikembalikan.
9. **Keamanan aksi:**
   - Cegah tabrakan antar staf. Setiap perubahan status memeriksa status asal di klausa WHERE. Bila status sudah berubah oleh orang lain, tolak dengan pesan "Pesanan ini baru saja diubah oleh staf lain" lalu muat ulang.
   - Setiap aksi tercatat di log aktivitas dan memicu notifikasi outbox yang sudah ada.
   - Tombol simulasi demo di sisi pembeli tetap dipertahankan.

## 5. Stok

1. **Matriks varian x lokasi**:
   - Cari, filter merek dan kategori, sorot stok menipis dan habis, paginasi.
   - Kolom tersedia (stok fisik dikurangi dipesan) dan dipesan.
   - Staf Cabang hanya melihat kolom lokasinya.
2. **Detail varian**: stok per lokasi dan buku stok (stock_movements) dengan filter jenis dan tanggal.
3. **Stok masuk**:
   - Formulir banyak baris (cari varian, jumlah), lokasi tujuan, referensi atau nomor surat jalan, dan catatan.
   - Ringkasan dikonfirmasi dulu sebelum disimpan.
4. **Transfer antar lokasi**:
   - Pilih lokasi asal dan tujuan, isi baris varian dan jumlah.
   - Jumlah tidak boleh melebihi stok tersedia di asal, dan lokasi asal tidak boleh sama dengan tujuan.
   - Satu transaksi menulis dua gerakan transfer (keluar dan masuk) dengan referensi yang sama, mengunci baris dengan urutan id.
5. **Opname**:
   - Pilih lokasi, lalu tampilkan lembar hitung (boleh sebagian varian lewat filter).
   - Isi jumlah fisik dan tampilkan selisih per baris beserta totalnya.
   - Konfirmasi menulis gerakan opname sebesar selisih. Opname tidak boleh membuat stok fisik lebih kecil dari jumlah dipesan; bila terjadi, tampilkan peringatan yang jelas.
6. Semua perubahan lewat modul inventory, sehingga "Kabari aku" dan revalidasi cache ikut jalan. Setiap perubahan tercatat di log aktivitas.

## 6. Log aktivitas

1. Tulis audit_logs untuk:
   - Perubahan status pesanan.
   - Semua gerakan stok manual.
   - Perubahan staf dan izin.
   - Login staf, berhasil maupun gagal.
   - Nantinya perubahan harga, produk, dan pengaturan (6B).
2. Isi tiap catatan: siapa, kapan, aksi, objek, serta data sebelum dan sesudah.
3. Halaman Log aktivitas (izin `log.lihat`):
   - Filter staf, jenis aksi, objek, dan tanggal.
   - Tampilan beda sebelum dan sesudah yang mudah dibaca.

## 7. Reset harian demo

1. Semua pengunjung berbagi akun demo, jadi data harus kembali bersih tiap malam. Gabungkan ke route cron harian yang sudah ada (pukul 03.00 WIB), karena paket gratis Vercel membatasi cron. Urutannya:
   - Kedaluwarsa.
   - Selesai otomatis.
   - Reset data demo, hanya bila DEMO_MODE=true dan env `DEMO_DAILY_RESET=true`.
2. Reset data demo di produksi:
   - Tidak menjalankan migrasi dan tidak memakai drizzle-kit saat runtime.
   - Cukup mengosongkan tabel data, lalu mengisi ulang dengan seed deterministik yang sama.
   - Harus cepat dan aman di fungsi serverless. Atur `maxDuration`, pakai insert massal, ukur durasinya terhadap database bukan lokal, dan laporkan hasilnya.
3. Foto ulasan yang diunggah pengunjung di Blob ikut dihapus saat reset.
4. Saat DEMO_MODE=true, Owner punya tombol "Reset data demo sekarang" dengan konfirmasi dan rate limit. Pengunjung yang mencoba demo tidak perlu menunggu besok.
5. Reset tidak boleh pernah jalan bila DEMO_MODE bukan true. Uji juga hal ini.

## 8. Uji

1. Vitest:
   - Matriks `can()` untuk keempat peran, izin tambahan, dan pembatasan lokasi.
   - Login staf: rate limit dan kunci sementara.
   - Pemetaan kanban ke state machine.
   - Perubahan status dengan status asal yang sudah berubah.
   - Transfer stok: berhasil, stok kurang, lokasi sama, dan atomik.
   - Opname: selisih dan batas stok dipesan.
   - Stok masuk memicu "Kabari aku".
   - Agregasi dashboard dengan batas hari WIB.
   - Reset demo: idempoten dan ditolak saat DEMO_MODE mati.
   - Uji IDOR untuk Staf Cabang: tidak bisa membuka pesanan atau stok lokasi lain.
2. Playwright:
   - Tamu membeli dengan kirim. Admin Online masuk, pesanan baru tampil di dashboard, lalu diproses dan diinput resi hingga Dikirim. Pembeli melihat resinya di /pesanan.
   - Ambil di Toko Rona Dinoyo dengan Bayar di Toko. Staf Dinoyo menandai lunas dan diambil hingga Selesai. Staf Dinoyo mendapat penolakan saat membuka pesanan lokasi lain.
   - Akun Gudang mentransfer stok dari Gudang Online ke Rona Sawojajar. Matriks berubah dan buku stok berisi dua baris dengan referensi sama.

## 9. Cuplik

Tambahkan aksi "admin" pada skrip cuplik yang memotret:
- /admin/masuk.
- Dashboard (Owner).
- Pesanan kanban dan tabel.
- Detail pesanan.
- Pratinjau label A6.
- Matriks stok.
- Formulir transfer.
- Opname dengan selisih.
- Halaman Staf dan izin.
- Log aktivitas.
- Dashboard versi Staf Dinoyo di HP.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run cuplik -- --nama=fase6a --halaman=/admin --aksi=admin`. Targetkan maksimal 2 lembar.
3. Jangan buka gambarnya.
4. Perbarui docs/BACKLOG.md, docs/DEPLOY.md (env baru, langkah migrasi, cara mengaktifkan reset harian), dan `.env.example`.
5. Commit dengan pesan "feat: panel admin inti (fase 6a)". Jangan push.
6. Laporkan:
   - Yang dibuat, keputusan yang kamu ambil sendiri, dan daftar halaman admin beserta izinnya.
   - Hasil semua uji (jumlah dan yang dilewati).
   - Migrasi baru dan apakah aman selagi versi lama tayang.
   - Env baru yang harus aku isi di Vercel.
   - Durasi reset demo yang terukur.
   - Urutan persis memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual.
