# Fase 7B: Asisten AI untuk owner dan staf

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md, docs/BRIEF.md bagian Fitur pembeda AI dan Panel admin, lalu:
- `src/lib/ai` dari 7A dan 7C.
- `src/lib/reports` dari 6C (satu sumber angka).
- `can()` dan daftar izin.
- Modul inventory, orders, promo, dan ulasan.
- docs/BACKLOG.md dan docs/DEPLOY.md.

Fase ini membangun "Asisten Admin", asisten untuk owner dan staf di panel admin. Pola dan pelajarannya diambil dari asisten AI ERP Pawon Ayu yang sudah berjalan di produksi. Pelajaran itu ditulis di bawah sebagai aturan.

Aturan produksi tetap berlaku: migrasi hanya menambah, env baru didokumentasikan, commit tanpa push.

## 0. Perbaikan dari review Fase 7C

1. **Tombol "Tanya Rona" di HP terlalu lebar.** Di 375 px, tombol berbentuk pil dengan teks menutupi sebagian kartu produk di /cari-dari-video.
   - Di HP, ubah menjadi tombol bulat ikon saja (sekitar 48 px). Label teks hanya tampil di desktop, atau sekali saat kunjungan pertama lalu menyusut.
   - Saat pengguna menggulir ke bawah, tombol menyembunyikan diri dengan halus. Saat menggulir ke atas, tombol muncul lagi.
   - Uji tumpang tindih dari 7C tetap lulus.
2. **Panel "Kesehatan AI" untuk Owner** (di Laporan atau Pengaturan), dibaca dari `ai_logs`:
   - Jumlah permintaan per fitur hari ini dan 30 hari.
   - Tingkat gagal.
   - Latensi median dan p95. Ini juga menjawab pertanyaan latensi dari Vercel yang di 7C baru diukur dari laptop.
   - Token.
   - Perkiraan biaya dalam rupiah.
   - Pemakaian terhadap `AI_DAILY_CAP`.
3. **Tarif dan kurs di konfigurasi.**
   - Tarif per model (masuk dan keluar per 1 juta token) disimpan di satu tempat konfigurasi beserta tanggal berlakunya, karena tarif Gemini naik mulai 1 Januari 2027. Kurs rupiah juga ada di konfigurasi.
   - Panel di atas dan perhitungan biaya di eval memakai sumber yang sama.
   - Angka ini nanti dipakai untuk RAB klien.

## Pelajaran dari Pawon Ayu yang wajib diterapkan

1. **Satu otak, banyak pintu.** Logika asisten (prompt sistem, daftar tool, eksekutor, fungsi `jawab`) ada di satu modul yang tidak tahu kanal. Pintu pertama adalah panel chat admin. Kabar Harian memakai otak yang sama. Pintu WA cukup disiapkan antarmukanya.
2. **Dua langkah dengan paksaan tool.**
   - Untuk pertanyaan data, panggilan pertama ke model memakai mode tool wajib (model harus memanggil tool, tidak boleh menjawab dari ingatan).
   - Panggilan kedua menyusun jawaban dari hasil tool.
   - Pertanyaan cara pakai dijawab dari tool `panduan_admin` yang membaca teks panduan di repo, bukan dari karangan model.
3. **Satu metrik, satu tool bawaan.** Pawon Ayu pernah punya tiga tool yang sama-sama menjawab "omzet" dengan definisi berbeda, sehingga angkanya tidak cocok dengan dashboard. Di Rona:
   - "Omzet" selalu lewat satu tool yang memakai definisi omzet di BRIEF dan `src/lib/reports`.
   - Tool lain yang menyentuh uang menyebut di deskripsinya bahwa ia bukan tool bawaan untuk omzet.
   - Jawaban selalu menyebut periode dan definisi yang dipakai.
4. **Agregasi di kode, bukan di model.** Tool mengembalikan angka yang sudah dijumlahkan dan dibulatkan, dengan baris yang dibatasi (misalnya 10 teratas plus "lainnya"). Model tidak pernah menjumlahkan ratusan baris sendiri.
5. **Semua tool mendukung rentang tanggal.**
   - Kosakata periode ("hari ini", "kemarin", "minggu ini" = Senin sampai hari ini, "bulan lalu", "30 hari terakhir", tanggal eksplisit) diterjemahkan oleh fungsi deterministik dengan clock dan WIB, bukan oleh model. Maksimal 366 hari.
   - Jawaban selalu menyebut rentang yang dipakai.
6. **Filter yang cukup.** Setiap tool punya parameter penyaring yang wajar (cabang, merek, kategori, produk, status) supaya model tidak menerima data terlalu lebar lalu membacakan semuanya.
7. **Pencocokan nama deterministik.**
   - Nama merek, produk, varian, cabang, dan pelanggan dicocokkan di kode (persis lebih dulu, lalu trigram).
   - Satu cocok: dipakai. Banyak cocok tanpa yang persis: kembalikan status "ambigu" beserta kandidat, dan model wajib bertanya balik. Tidak cocok: katakan tidak ditemukan.
   - Model tidak boleh menebak id.
8. **Bertanya balik bila informasi kurang**, bukan menyerah atau mengarang.
9. **Pembatasan peran secara struktural.**
   - Daftar tool yang diberikan ke model dan eksekutornya sama-sama disaring dengan `can()` milik staf yang bertanya.
   - Staf Cabang otomatis terkunci ke lokasinya di level tool.
   - Tanpa `laporan.keuangan`, kolom rupiah dihapus dari hasil tool (bukan sekadar disembunyikan di UI).
   - Tanpa `pelanggan.kontak`, data kontak disamarkan di hasil tool.
10. **Hanya membaca, ditegakkan di struktur.**
    - Eksekutor hanya bisa memanggil fungsi dalam daftar izin baca.
    - Modul asisten tidak mengimpor fungsi tulis inventory, orders, promo, atau produk.
    - Uji penjaga memastikan daftar tool sama dengan daftar izin yang ditulis tetap, tidak ada nama tool berkata kerja mutasi, dan tool di luar cakupan peran ditolak alih-alih dijalankan.
11. **AI menyiapkan, manusia mengesahkan.** Semua aksi tulis berupa draf yang dibuka di formulir admin yang sudah ada, lalu disimpan staf dengan klik. Aksi berbahaya (batal pesanan, ubah harga, hapus) tidak diberikan ke AI sama sekali.
12. **Jangan sampai salah tapi tampak wajar.** Bila data belum final atau tidak lengkap (misalnya hari ini belum selesai), tool menandainya dan model wajib menyebutnya "sementara".
13. **Jaga angka.**
    - Keluaran akhir terstruktur: teks dan daftar angka yang dirujuk beserta sumbernya (tool dan kolom).
    - Server memeriksa setiap angka di teks ada di hasil tool (setelah normalisasi format rupiah, persen, dan pembulatan).
    - Bila ada angka tanpa sumber, jawaban dibuat ulang sekali. Bila masih gagal, tampilkan jawaban dengan peringatan dan catat di log.
14. **Gagal dengan jujur.** Bila Gemini tidak tersedia, tampilkan "Asisten sedang tidak tersedia, coba lagi sebentar" yang jelas berbeda dari penolakan akses. Fitur lain di admin tetap jalan.
15. **Jejak audit di setiap pintu.**
    - `ai_logs` mencatat staf, pintu, nama tool yang dipanggil, latensi, dan berhasil atau gagal. Isi hasil tool tidak dicatat.
    - Dari log ini harus bisa dibuktikan bahwa pertanyaan omzet benar-benar memanggil tool omzet.
16. **Notifikasi tidak pernah memblokir alur utama**, dan tidak pernah mengirim pesan seragam massal ke banyak nomor. Pelajaran ini dari nomor WA Pawon Ayu yang kena ban.

## 1. Tool baca untuk asisten

Semua membungkus fungsi yang sudah ada, tanpa kueri baru yang menduplikasi logika:

1. `ringkasan_penjualan(periode, cabang?)`: omzet, pesanan, rata-rata nilai pesanan, diskon, pembatalan, retur, dan pembanding dengan periode sebelumnya.
2. `penjualan_per(dimensi, periode, cabang?)`: dimensi merek, kategori, cabang, kanal, metode bayar, kurir, atau jam.
3. `produk_terlaris(periode, cabang?, merek?, kategori?)`.
4. `stok_varian(cari, lokasi?)` dan `stok_menipis(lokasi?)`.
5. `permintaan_kabari_aku(periode?)`: varian habis dengan jumlah peminat.
6. `pesanan_perlu_tindakan(cabang?)` dan `cari_pesanan(nomor atau nomor WA)`, mengikuti penyamaran.
7. `ringkasan_pelanggan(periode, segmen?)`: jumlah per segmen, pelanggan baru dibanding kembali, tanpa data pribadi kecuali punya izin.
8. `ringkasan_ulasan(periode, bintang?, produk?)`: rata-rata, jumlah, keluhan yang sering muncul (diambil dari ringkasan ulasan 7A bila ada), dan yang belum dibalas.
9. `kinerja_voucher(periode)` dan `kinerja_flash_sale(periode)`.
10. `kinerja_advisor(periode)`: lihat bagian 4.
11. `saran_transfer_stok(lokasi?)` dan `saran_flash_sale(periode?)`: lihat bagian 2.
12. `panduan_admin(topik)`: membaca berkas panduan singkat di repo (cara membuat voucher, cara transfer stok, dan sebagainya). Tulis berkas panduannya sekarang di `docs/panduan-admin/`.

## 2. Saran yang menjadi draf

1. **Saran transfer stok.**
   - Algoritma deterministik di `src/lib/inventory`, bukan AI. Untuk tiap varian, hitung laju jual 14 hari per lokasi dan hari-cukup-stok.
   - Bila sebuah cabang akan habis dalam X hari sementara lokasi lain punya kelebihan di atas Y hari, usulkan jumlah transfer yang wajar (dibulatkan, tidak membuat lokasi asal kekurangan). X dan Y diatur di Pengaturan.
   - Tampilkan di Stok sebagai daftar "Saran transfer" dengan alasan angkanya.
   - Tombol "Buat draf transfer" membuka formulir transfer yang sudah terisi. Staf memeriksa lalu menyimpan lewat aksi transfer yang ada.
   - AI hanya menjelaskan saran dalam bahasa yang enak dibaca, dan bisa dipanggil dari chat.
2. **Saran flash sale.**
   - Skor deterministik: laju jual rendah, stok online tinggi, rating baik, dan belum ikut flash sale 30 hari terakhir.
   - Daftar kandidat dengan usulan harga flash (persen diskon dalam batas yang diatur) dan kuota.
   - Tombol "Tambahkan ke slot" membuka formulir slot terisi.
3. **Panduan gaya bahasa toko** di Pengaturan, sebagai acuan untuk semua tulisan AI:
   - Nada dan sapaan (bawaan: hangat, singkat, "kamu").
   - Kata yang dipakai dan yang dihindari.
   - Panjang ideal per tab.
   - 2 sampai 3 contoh deskripsi terbaik, dipilih admin dari produk yang ada.
   - Nilai bawaan diisi dari gaya Rona sekarang. Bisa diubah per klien, dan ini bagian dari kesiapan reskin.
4. **Penulis deskripsi dan SEO** di formulir produk.
   - **Acuan yang bisa diisi admin:**
     - Poin-poin.
     - Teks dari pemasok atau kemasan (tempel), opsional.
     - Data produk yang sudah ada (bahan aktif, cocok kulit, finish, SPF, netto, BPOM).
   - AI menyusun deskripsi per tab (manfaat, kandungan, cara pakai), judul meta, dan deskripsi meta, mengikuti panduan gaya bahasa toko dan contoh-contohnya.
   - **Pemeriksa klaim:**
     - Bahan yang disebut harus ada di daftar bahan aktif produk.
     - Klaim angka (persen, jam tahan lama, SPF) harus ada di acuan.
     - Tidak boleh ada klaim medis atau klaim yang tidak ada di acuan (daftar kata terlarang di kode).
     - Kalimat yang melanggar ditandai beserta alasannya.
   - Hasil tampil sebagai usulan berdampingan dengan isi lama. Admin menerima per kolom, dan bisa meminta "Buat ulang lebih singkat" atau "lebih santai".
   - Penulisan massal: dari daftar produk, pilih beberapa produk berdeskripsi kosong atau pendek, lalu buat usulan untuk semuanya. Admin tetap meninjau per produk sebelum menyimpan.
5. **Draf balasan ulasan** di dialog balas moderasi.
   - Acuannya isi ulasan, data pesanan (produk, shade, status), kebijakan retur dari halaman bantuan, dan panduan gaya bahasa toko.
   - **Balasan sesuai situasi:**
     - Pujian: terima kasih yang personal, bukan templat.
     - Keluhan produk: empati, lalu saran pemakaian bila relevan.
     - Keluhan pengiriman atau kemasan: minta maaf dan arahkan ke kebijakan retur.
     - Salah shade: tawarkan padanan shade dengan tautan ke fitur 7A.
   - Tanpa menjanjikan uang kembali atau kompensasi di luar kebijakan retur. Tanpa menyalahkan pembeli. Tanpa klaim medis.
   - Admin bisa mengubah sebelum mengirim. Balasan yang dikirim tercatat sebagai buatan staf (dengan penanda "dibantu AI" di log, bukan di tampilan publik).
   - Saran cepat di daftar ulasan: tombol "Buat draf untuk semua yang belum dibalas" menghasilkan draf yang ditinjau satu per satu.

## 3. Kabar Harian

1. **Waktu pembuatan.** Dibuat oleh cron harian untuk hari kemarin, dijalankan sebelum langkah reset demo supaya datanya utuh.
2. **Isi deterministik** dari `src/lib/reports`:
   - omzet dan pesanan dibanding kemarin lusa dan rata-rata 7 hari
   - produk terlaris
   - stok menipis per cabang
   - pesanan bermasalah (kedaluwarsa, batal, menunggu lama)
   - ulasan buruk yang belum dibalas
   - saran transfer teratas
3. **Narasi AI singkat** (2 sampai 4 kalimat) bila AI tersedia. Bila tidak tersedia, pakai templat teks deterministik. Kabar Harian tidak pernah gagal dibuat.
4. **Halaman Kabar Harian (Owner):**
   - Riwayat 14 hari.
   - Pratinjau gelembung WA.
   - Tombol "Salin untuk WA".
   - Masuk ke outbox kanal WA hanya untuk nomor owner di Profil toko (pratinjau di mode demo).

## 4. Kinerja Advisor di Laporan

1. Tab baru "Rona Advisor" di Laporan, memakai atribusi sumber dari 7A. Isinya:
   - percakapan
   - tambah ke keranjang dari Advisor
   - pesanan yang berisi item dari Advisor
   - omzet dari item tersebut
   - rata-rata nilai pesanan dengan dan tanpa item Advisor
2. Sertakan catatan jujur bahwa ini korelasi, bukan bukti sebab-akibat.
3. Ikut masuk ke sheet Excel.
4. Seed riwayat menyertakan sebagian pesanan yang ditandai bersumber Advisor, dengan proporsi yang wajar, supaya tab ini tidak kosong saat demo. Naikkan versi seed.

## 5. Panel chat "Asisten Admin"

1. **Tombol dan panel.** Tombol di header admin, plus tombol melayang di HP yang tidak menutupi menu bawah. Panel tampil di samping di desktop dan sebagai sheet di HP.
2. **Chip contoh per peran:**
   - **Owner:** "Omzet minggu ini dibanding minggu lalu", "Merek paling laku di Dinoyo bulan ini", "Varian habis yang paling banyak diminta".
   - **Staf Cabang:** "Stok cushion shade 02 di sini", "Pesanan ambil hari ini".
   - **Gudang:** "Saran transfer hari ini".
3. **Bentuk jawaban.**
   - Teks singkat, tabel kecil bila perlu, dan tautan ke halaman admin terkait ("Lihat di Laporan", "Buka draf transfer").
   - Selalu menyebut periode dan sumber angkanya.
4. **Masukan suara opsional.**
   - Tombol mikrofon merekam, lalu server mentranskripsi lewat Gemini. Teksnya masuk ke kotak ketik dan bisa diubah. Teks tidak pernah terkirim otomatis.
   - Rekaman maksimal 60 detik, tidak disimpan.
5. **Riwayat percakapan** disimpan di sisi klien selama sesi.
6. **Batas pemakaian** per staf per hari, plus batas global.

## 6. Evaluasi

1. **Berkas `evals/asisten.json`** berisi minimal 30 pertanyaan per peran. Cakupannya:
   - omzet berbagai periode
   - perbandingan
   - cabang
   - nama ambigu (misalnya "Lumi" sebagai merek dan bagian nama produk)
   - stok
   - Kabari aku
   - pertanyaan yang harus ditolak per peran
   - pertanyaan cara pakai
   - upaya prompt injection
   - permintaan aksi tulis (harus jadi draf atau ditolak)
2. **Perintah `npm run eval:asisten`.** Untuk setiap pertanyaan, periksa:
   - Tool yang dipanggil sesuai harapan.
   - Angka di jawaban sama dengan hasil fungsi laporan untuk periode itu.
   - Peran dihormati.
   - Pertanyaan balik terjadi saat seharusnya.
   - Hasilnya berupa tabel skor.
3. Dilewati bila tidak ada kunci. Uji unit memakai mock.

## 7. Uji

1. **Vitest:**
   - Penerjemah periode di semua kosakata dan batas WIB.
   - Pencocokan nama: persis, ambigu, tidak ditemukan.
   - Penyaringan tool per peran.
   - Penghapusan kolom rupiah dan penyamaran kontak di hasil tool.
   - Uji penjaga hanya-baca (daftar izin, kata kerja mutasi, impor).
   - Penjaga angka.
   - Algoritma saran transfer dan saran flash sale.
   - Pemeriksa klaim deskripsi.
   - Kabar Harian dengan dan tanpa AI.
   - Atribusi Advisor di laporan.
   - Endpoint transkripsi dengan mock (tanpa sesi ditolak, gagal tidak menjadi 500).
2. **Playwright dengan mock:**
   - Owner bertanya omzet minggu ini, dan angkanya sama dengan Laporan.
   - Staf Dinoyo bertanya omzet, lalu ditolak dengan sopan. Stok Dinoyo dijawab.
   - Gudang membuka saran transfer, membuat draf, lalu menyimpan. Buku stok bertambah.
   - Admin memakai penulis deskripsi, menerima satu kolom, lalu menyimpan.
   - Kabar Harian tampil di halaman Owner.

## 8. Cuplik

Tambahkan aksi "ai-admin" pada skrip cuplik (dengan mock) yang memotret:
- Panel Asisten Admin dengan jawaban dan tabel di 1440 dan 375 px.
- Saran transfer.
- Penulis deskripsi dengan usulan berdampingan.
- Draf balasan ulasan.
- Kabar Harian.
- Tab Rona Advisor di Laporan.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run eval:asisten` (dan `npm run eval:ai`) bila kunci tersedia, lalu sertakan tabel skornya.
3. Jalankan `npm run cuplik -- --nama=fase7b --halaman=/admin --aksi=ai-admin`. Targetkan 1 lembar.
4. Jangan buka gambarnya.
5. Perbarui docs/BACKLOG.md, docs/DEPLOY.md, `.env.example`, dan BRIEF (hanya menambah).
6. Commit dengan pesan "feat: asisten AI untuk owner dan staf (fase 7b)". Jangan push.
7. Laporkan:
   - Yang dibuat, keputusan yang kamu ambil sendiri, dan daftar tool beserta peran yang boleh memakainya.
   - Hasil uji dan evaluasi.
   - Perkiraan biaya per pertanyaan dan per Kabar Harian.
   - Migrasi baru, env baru, dan urutan memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual.
