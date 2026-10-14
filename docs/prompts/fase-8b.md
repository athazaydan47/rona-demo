# Fase 8B: Pengerasan, siap jadi mesin, dan rilis v1.0-demo

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md, docs/BRIEF.md bagian Stack dan infrastruktur, Deploy dan skenario demo, lalu seluruh docs/BACKLOG.md, docs/DEPLOY.md, dan docs/AUDIT-POLES.md.

Tujuan fase ini ada tiga:
1. Rona aman dan stabil untuk dipamerkan ke publik.
2. Rona siap dipakai ulang sebagai "mesin" untuk klien berikutnya, dengan ganti kulit dalam hitungan hari, bukan minggu.
3. Rilis v1.0-demo dengan dokumentasi yang membuat proyek ini mudah dirawat sendirian.

Aturan produksi tetap berlaku: migrasi hanya menambah, env baru didokumentasikan, commit tanpa push. Tag rilis dibuat oleh Atha.

## 0. Perbaikan dari review fase sebelumnya

Bila bagian ini tidak berisi butir, lewati.

## 1. Keamanan

1. **Content Security Policy lengkap**, sudah tercatat di BACKLOG.
   - Mulai dengan mode report-only. Periksa semua halaman toko, admin, Leaflet, Blob, dan AI.
   - Setelah bersih, ubah ke mode enforce.
   - Pakai nonce untuk skrip inline bila diperlukan Next.
2. **Audit rate limit** untuk setiap endpoint sensitif:
   - OTP dan login staf
   - unggah foto
   - AI
   - cek ongkir
   - lacak pesanan
   - webhook dan cron (rahasia)

   Buat tabel di docs/KEAMANAN.md.
3. **Audit otorisasi.** Daftar semua server action dan route handler. Pastikan setiap aksi memeriksa sesi dan `can()` di server. Buat uji otomatis yang memanggil setiap aksi admin tanpa sesi dan dengan peran yang salah.
4. **Validasi masukan.** Semua masukan dari browser divalidasi dengan skema. Unggahan dicek jenis aslinya (bukan dari nama file), ukuran, dan dimensinya.
5. **Dependensi dan rahasia.**
   - `npm audit` tanpa kerentanan tinggi atau kritis yang bisa dieksploitasi.
   - Pindai repo untuk rahasia yang tidak sengaja ter-commit di seluruh riwayat git. Laporkan temuannya, jangan menulis ulang riwayat tanpa izin.
6. **Header, cookie, dan berkas keamanan.** Header dan flag cookie diverifikasi otomatis lewat uji. Tambahkan `/.well-known/security.txt`.
7. **Tulis docs/KEAMANAN.md:** model ancaman singkat, kontrol yang ada, dan yang harus ditambah untuk toko sungguhan (payment gateway nyata, WA resmi, backup).

## 2. Keandalan dan pemantauan

1. **Endpoint `/api/sehat`** berisi status database, versi aplikasi (commit), versi seed, dan waktu server, tanpa data sensitif. Pakai untuk pemantau uptime gratis.
2. **Pelacakan error opsional** lewat env (misalnya Sentry paket gratis). Bila env kosong, tidak ada yang dimuat. Data pribadi disaring sebelum dikirim.
3. **Log terstruktur di server** untuk alur penting: pesanan dibuat, dibayar, dan dibatalkan; reset demo; cron; error AI. Nomor WA dan email disamarkan.
4. **Cron diperiksa.** Bila cron harian gagal atau tidak jalan lebih dari 26 jam, dashboard Owner menampilkan peringatan.
5. **Tulis docs/OPERASIONAL.md:**
   - Cara memeriksa kesehatan.
   - Membaca log Vercel.
   - Memulihkan dari migrasi gagal.
   - Mengembalikan Neon ke titik waktu tertentu (fitur bawaan Neon).
   - Memutar ulang rahasia.
   - Apa yang dilakukan bila Gemini atau Neon bermasalah.

## 3. Siap jadi mesin (reskin)

1. **Satu berkas konfigurasi merek**, misalnya `src/config/merek.ts`, ditambah token tema. Isinya:
   - nama toko, tagline, logo teks atau SVG
   - palet warna dan font
   - gaya ProductArt
   - nomor WA, email, media sosial
   - nama dan tautan studio
   - teks pita demo
2. **Tidak ada nama "Rona" yang tertanam** di kode di luar konfigurasi, konten seed, dan dokumen. Buat uji yang menyisir kode sumber untuk memastikannya.
3. **Konten toko dipisah dari kode:** seed, teks halaman bantuan, dan templat notifikasi. Toko klien cukup mengganti konten tanpa menyentuh logika.
4. **Fitur bisa dinyalakan atau dimatikan per klien lewat konfigurasi:**
   - AI pembeli
   - AI foto dan link
   - asisten admin
   - flash sale
   - poin
   - Ambil di Toko
   - multi cabang

   Bila sebuah fitur mati, menu, halaman, dan tool AI terkait ikut tersembunyi, dan uji tetap hijau.
5. **Impor katalog.** Skrip `npm run impor:katalog` membaca CSV (templat disediakan di `docs/templat-katalog.csv`) berisi produk, varian, harga, berat, dan stok awal per lokasi.
   - Ada validasi dan laporan baris yang gagal.
   - Mode uji kering tanpa menulis.
   - Penulisan lewat modul inventory.
   - Ini pekerjaan pertama di setiap proyek klien sungguhan.
6. **Tulis docs/RESKIN.md**, langkah demi langkah mengubah Rona menjadi toko klien:
   - konfigurasi merek
   - konten
   - impor katalog
   - cabang
   - kurir dan tarif
   - payment gateway sungguhan lewat adapter
   - WA resmi
   - domain
   - deploy

   Sertakan perkiraan waktu per langkah dan daftar hal yang wajib ditanyakan ke klien.

## 4. Kualitas kode dan dokumentasi

1. **Bersihkan kode:** kode mati, TODO yang sudah usang, dan duplikasi.
2. **Laporan cakupan uji** untuk `src/lib/pricing`, `inventory`, `orders`, `reports`, dan `ai`. Targetnya di atas 85 persen untuk logika uang dan stok.
3. **README.md** yang rapi:
   - apa ini
   - fitur
   - stack
   - cara menjalankan lokal
   - perintah penting
   - struktur folder
   - tautan ke dokumen lain
4. **docs/ARSITEKTUR.md:**
   - Diagram sederhana (Mermaid): toko, admin, modul lib, database, cron, AI, dan Blob.
   - Alur pesanan dari keranjang sampai Selesai.
   - Alur stok dan buku stok.
   - Aturan cache.
   - Prinsip satu sumber angka.
5. **docs/KEPUTUSAN.md:** ringkasan keputusan teknis penting dari seluruh fase (berdasarkan laporan di riwayat commit dan BACKLOG), masing-masing dengan alasan singkat.
6. **CHANGELOG.md** per fase.

## 5. Regresi akhir

1. Seluruh Vitest, Playwright (Chromium dan WebKit), axe, perayap tautan, dan `npm run cek:data` hijau.
2. Jalankan evaluasi AI (`eval:ai` dan `eval:asisten`) bila kunci tersedia, dan pastikan skornya tidak turun dari fase sebelumnya.
3. **Uji asap produksi:** skrip `npm run uji:produksi -- --url=<alamat>` yang menjalankan subset Playwright hanya-baca dan aman ke situs yang sudah tayang. Isinya: beranda, produk, pencarian, 404, sehat, robots, dan header. Tanpa membuat pesanan.

## 6. Aset portofolio

1. **Skrip `npm run aset:portofolio`** menghasilkan gambar bersih untuk situs Ciptalogy:
   - beranda desktop
   - halaman produk
   - checkout di HP
   - dashboard admin
   - laporan
   - panel Advisor

   Dalam resolusi tinggi, tanpa pita demo, dengan bingkai perangkat sederhana yang dibuat sendiri (tanpa logo atau mockup bermerek), disimpan di `_portofolio/`.
2. **Tulis docs/STUDI-KASUS.md** berisi draf studi kasus singkat untuk portofolio:
   - masalah
   - pendekatan
   - fitur utama
   - angka teknis (jumlah uji, Lighthouse, waktu reset)
   - pelajaran

   Jujur bahwa ini proyek demo.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test (dengan cakupan), build, seluruh Playwright, `cek:data`, dan evaluasi AI bila kunci ada.
2. Jalankan `npm run aset:portofolio`. Jangan buka gambarnya, cukup laporkan daftar file dan ukurannya.
3. Kosongkan BACKLOG dari butir yang sudah selesai. Butir yang ditunda diberi alasan dan dikelompokkan sebagai "Untuk toko sungguhan" atau "Nanti".
4. Commit dengan pesan "chore: pengerasan, reskin, dokumentasi (fase 8b)". Jangan push.
5. Laporkan:
   - Ringkasan keamanan (temuan dan perbaikan).
   - Hasil semua uji, cakupan, dan evaluasi.
   - Daftar dokumen baru.
   - Langkah rilis untuk aku: push, verifikasi produksi, `npm run uji:produksi`, lalu `git tag v1.0-demo && git push --tags`.
   - Apa yang perlu aku cek manual sebelum mengirim tautan ke temanku.
