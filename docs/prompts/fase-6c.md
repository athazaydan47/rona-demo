# Fase 6C: Ulasan, pelanggan, laporan, dan email

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md (termasuk Aturan cache), docs/BRIEF.md bagian Voucher dan poin, Ulasan dan notifikasi, Panel admin, Model data, definisi omzet yang ditambahkan di Fase 6A, lalu docs/BACKLOG.md dan docs/DEPLOY.md.

Ini fase terakhir panel admin. Setelah ini semua menu "Segera hadir" harus hilang.

Aturan produksi tetap berlaku:
- Migrasi hanya bersifat menambah.
- Env baru masuk ke `.env.example` dan docs/DEPLOY.md.
- Commit tanpa push.

Deploy kini cukup push (Fase 6B), jadi pastikan migrasi baru aman dijalankan otomatis saat build.

Pakai yang sudah ada: `can()`, layout admin, audit_logs, notifications outbox beserta fungsi pembacanya, pricing dan poin (termasuk ledger dan pemeriksa konsistensi), data riwayat 90 hari, pengaturan, dan komponen tabel serta dialog admin.

## 0. Perbaikan dari review Fase 6B

1. Di HP, kanban yang berubah jadi tab status selalu membuka tab Dibayar, walaupun isinya kosong ("Kosong."). Buka tab status aktif pertama yang ada isinya, dengan urutan prioritas Dibayar, Diproses, Menunggu Pembayaran, Siap Diambil, Dikirim. Ingat pilihan tab terakhir per staf selama sesi.
2. Status kosong di tab mana pun menampilkan kalimat yang membantu, misalnya "Belum ada pesanan Dibayar. Pesanan baru akan muncul di sini otomatis.", bukan hanya "Kosong."

## 1. Fungsi laporan sebagai satu sumber angka

1. Buat modul `src/lib/reports` berisi fungsi agregasi murni, misalnya ringkasan periode, per hari, per merek, per kategori, per cabang, per kanal, produk terlaris, voucher, flash sale, dan pelanggan baru dibanding kembali.
2. Dashboard (6A), halaman Laporan, unduhan Excel, dan nanti asisten AI di Fase 7 semuanya wajib memakai fungsi yang sama. Pindahkan agregasi dashboard ke modul ini tanpa mengubah hasilnya.
3. Semua batas tanggal memakai WIB dan definisi omzet di BRIEF.
4. Sediakan uji yang membuktikan angka dashboard sama dengan angka laporan untuk periode yang sama.

## 2. Laporan

1. **Pilihan periode:** hari ini, 7 hari, 30 hari, bulan ini, bulan lalu, dan kustom (maksimal 366 hari). Tersedia filter cabang dan pembanding dengan periode sebelumnya, dengan persen naik atau turun.
2. **Halaman Ringkasan.**
   - Omzet, jumlah pesanan, rata-rata nilai pesanan.
   - Total diskon produk, voucher, poin dipakai, dan ongkir.
   - Tingkat pembatalan dan retur.
   - Grafik omzet harian.
3. **Tab rincian.**
   - Per merek, per kategori, per cabang asal.
   - Per kanal: kirim dibanding ambil, metode bayar, kurir.
   - Produk dan varian terlaris.
   - Kinerja voucher dan flash sale (penjualan, kuota terpakai, potongan).
   - Pelanggan baru dibanding kembali.
4. **Hak akses.**
   - Butuh `laporan.lihat`. Angka rupiah hanya tampil dengan `laporan.keuangan`; tanpa izin itu tampil jumlah saja.
   - Staf Cabang otomatis terbatas ke lokasinya.
5. **Unduh Excel multi-sheet** (pola fitur Unduh Laporan Pawon Ayu), dibuat di server dengan pustaka yang jalan di Vercel.
   - **Sheet:** Ringkasan, Harian, Per Merek, Per Kategori, Per Cabang, Per Kanal, Produk, Voucher, Detail Pesanan (satu baris per pesanan), dan Detail Item.
   - **Isi sel:** angka rupiah berupa angka dengan format `Rp #.##0`, bukan teks. Tanggal berupa tanggal Excel sungguhan dalam WIB.
   - **Tampilan:** baris judul berisi periode, cabang, dicetak oleh, dan waktu cetak. Header dibekukan, ada autofilter, dan lebar kolom rapi.
   - **Nama file:** `laporan-rona-YYYYMMDD-YYYYMMDD.xlsx`.
   - Total di Excel wajib sama dengan yang tampil di layar.
6. **Tampilan HP:** kartu ringkasan dan grafik tetap terbaca di 375 px. Tabel rincian boleh digulir ke samping di dalam kartunya, tapi halaman tidak boleh melebar.

## 3. Ulasan

1. **Daftar ulasan.**
   - Filter bintang, status (tampil atau tersembunyi), belum dibalas, ada foto, produk, dan tanggal.
   - Foto bisa dibuka dalam lightbox.
2. **Sembunyikan dan tampilkan.**
   - Menyembunyikan wajib alasan.
   - Rating rata-rata dan jumlah ulasan produk dihitung ulang, lalu cache produk direvalidasi.
   - Tersedia aksi massal sembunyikan.
3. **Balas sebagai toko.**
   - Balasan tampil di bawah ulasan di halaman produk dengan label "Balasan Rona Beauty".
   - Balasan bisa diubah dan dihapus.
   - Pembeli menerima notifikasi lewat outbox bahwa ulasannya dibalas.
4. Ulasan bintang 1 atau 2 yang belum dibalas masuk daftar "Perlu tindakan" di dashboard.
5. Butuh izin `ulasan.kelola`. Setiap aksi tercatat di log aktivitas.

## 4. Pelanggan

1. **Segmen.** Tambahkan definisinya ke BRIEF (hanya menambah):
   - **Baru:** baru punya 1 pesanan Selesai, dalam 30 hari terakhir.
   - **Setia:** minimal 3 pesanan Selesai dalam 180 hari terakhir.
   - **Tidak aktif:** tidak ada pesanan dalam 90 hari terakhir.
   - **Lainnya:** yang tidak masuk ketiganya.
   - Hitung dengan clock supaya bisa diuji.
2. **Daftar pelanggan.**
   - Cari nama atau nomor, filter segmen.
   - Urutkan menurut total belanja, jumlah pesanan, atau terakhir belanja.
   - Paginasi.
3. **Detail pelanggan.**
   - Ringkasan: total belanja bersih, jumlah pesanan, rata-rata nilai pesanan, terakhir belanja, cabang favorit, merek favorit.
   - Daftar pesanan, saldo poin dan riwayat ledger.
   - Profil kulit, alamat, wishlist, daftar "Kabari aku", dan notifikasi.
   - Tombol hubungi via WA.
4. **Penyesuaian poin manual** (izin baru `pelanggan.poin`, bawaan hanya Owner):
   - Alasan wajib diisi.
   - Ditulis ke points_ledger.
   - Saldo tidak boleh negatif.
   - Tercatat di log aktivitas.
5. **Privasi.**
   - Izin baru `pelanggan.kontak` (bawaan Owner dan Admin Online). Tanpa izin ini, nomor WA dan email disamarkan sebagian.
   - Tidak ada ekspor data pelanggan.
6. Tautan ke detail pelanggan dari halaman detail pesanan admin dan dari pencarian global.

## 5. Adapter email

1. **Pengirim outbox.**
   - Notifikasi kanal email dikirim lewat adapter yang dipilih env `EMAIL_PROVIDER`.
   - Pilihan: `preview` (bawaan, tidak mengirim apa pun, perilaku sekarang) dan `resend` (lewat REST API Resend dengan fetch, tanpa SDK). Env: `RESEND_API_KEY` dan `EMAIL_FROM`.
2. **Mode demo.** Saat DEMO_MODE=true, email sungguhan hanya terkirim ke alamat di env `EMAIL_ALLOWLIST` (dipisah koma). Alamat lain ditandai "dilewati", supaya situs demo tidak bisa dipakai untuk spam.
3. **Status dan pengiriman.**
   - Status per notifikasi: menunggu, terkirim, gagal, atau dilewati, beserta jumlah percobaan dan error terakhir.
   - Kirim setelah transaksi selesai (`after()` dari Next).
   - Coba ulang lewat cron harian, maksimal 3 kali.
   - Kunci idempoten supaya tidak terkirim dua kali.
4. **Template email.** HTML sederhana yang responsif dengan identitas Rona, versi teks biasa, dan tautan absolut dari alamat situs. Hanya email transaksional, tanpa promosi.
5. **Halaman admin "Notifikasi keluar"** (izin `pengaturan.kelola`): filter kanal, status, dan tanggal, pratinjau isi, dan tombol "Kirim ulang" untuk yang gagal.
6. **WhatsApp.** Kanal WA tetap pratinjau. Siapkan antarmuka `WhatsAppSender` dan tulis di docs/DEPLOY.md apa yang dibutuhkan untuk WhatsApp Business Platform resmi:
   - Verifikasi bisnis Meta.
   - Nomor khusus.
   - Daftar template yang perlu disetujui, sesuai notifikasi yang ada.
   - Ide masuk lewat WA yang dimulai pembeli.
   Jangan diimplementasikan.

## 6. Uji

1. **Vitest:**
   - Fungsi laporan terhadap data uji yang dihitung manual, termasuk batas hari WIB.
   - Dashboard sama dengan laporan.
   - Excel: nama sheet, tipe sel angka dan tanggal, serta total sama dengan fungsi laporan (baca ulang filenya di uji).
   - Segmen pelanggan di setiap batasnya.
   - Penyesuaian poin.
   - Sembunyikan ulasan menghitung ulang rating.
   - Balasan ulasan.
   - Pengirim email: allowlist demo, coba ulang, idempoten, dan error penyedia, dengan adapter tiruan.
   - Izin setiap halaman dan aksi baru, termasuk penyamaran kontak.
2. **Playwright:**
   - Admin Online menyembunyikan ulasan. Rating di halaman produk berubah. Owner membalas ulasan lain, dan balasannya tampil di halaman produk.
   - Owner membuka Laporan 30 hari lalu mengunduh Excel. File terunduh dengan sheet yang benar.
   - Dari detail pesanan, buka detail pelanggan. Staf tanpa `pelanggan.kontak` melihat nomor tersamar.

## 7. Cuplik

Tambahkan aksi "admin-6c" pada skrip cuplik yang memotret:
- Laporan ringkasan dan satu tab rincian.
- Daftar dan detail pelanggan.
- Moderasi ulasan dengan dialog balas.
- Notifikasi keluar.
- Laporan di HP.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run cuplik -- --nama=fase6c --halaman=/admin --aksi=admin-6c`. Targetkan 1 lembar.
3. Jangan buka gambarnya.
4. Perbarui docs/BACKLOG.md, docs/DEPLOY.md, `.env.example`, dan BRIEF (hanya menambah).
5. Commit dengan pesan "feat: ulasan, pelanggan, laporan, email (fase 6c)". Jangan push.
6. Laporkan:
   - Yang dibuat dan keputusan yang kamu ambil sendiri.
   - Hasil semua uji (jumlah dan yang dilewati).
   - Migrasi baru dan apakah aman dijalankan otomatis saat build.
   - Env baru (wajib atau opsional).
   - Urutan memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual.
