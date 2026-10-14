# Fase 8C: Tanya Rona satu pintu untuk pembeli

Model yang disarankan: Opus 5.5.

Baca dulu: CLAUDE.md, lalu seluruh kode AI pembeli:
- Rona Advisor (7A).
- Pencarian kalimat, padanan shade, kuis kulit, rutinitas, "Cocok untuk kulitmu?", dan ringkasan ulasan (7A).
- Bantu isi kuis dari foto dan cari dupe dari link atau screenshot (7C).
- Batas pemakaian dan Kesehatan AI (7B).
- Halaman /lacak, /cek-ongkir, /toko, dan halaman bantuan (8A).
- `evals/advisor.json` dan docs/BACKLOG.md.

Prompt ini menggantikan `docs/prompts/fase-8b-1.md` yang tidak jadi dijalankan.

## Latar

Uji di HP sungguhan menemukan dua masalah:

1. **Link TikTok asli gagal.** Link pendek `https://vt.tiktok.com/ZSgewBdCV/` ditempel di /cari-dari-video dan hasilnya "Videonya tidak bisa dibuka", padahal videonya publik. Jalur ini sebelumnya hanya diuji dengan mock.
2. **Fitur pembeli tersebar di banyak halaman** (kuis, rutinitas, padanan shade, cari dari video, lacak, cek ongkir). Saat demo, pembeli harus pindah-pindah halaman, dan saat menempel link di chat Advisor, Advisor menjawab tidak bisa membuka link.

Tujuan fase ini: **Tanya Rona menjadi satu pintu.** Semua yang bisa dilakukan pembeli di halaman-halaman itu juga bisa dilakukan langsung di dalam chat, dengan kartu interaktif. Halaman-halaman lama tetap ada (untuk SEO dan pembeli yang lebih suka cara biasa), dan semuanya memakai fungsi server yang sama. Tidak boleh ada logika kedua.

Prinsip 7A sampai 7C tetap berlaku:
- Tidak mengarang; produk, harga, dan stok hanya dari fungsi katalog.
- Toko tetap jalan tanpa AI.
- Tanpa klaim medis.
- Foto tidak disimpan.
- Biaya terkendali.

Aturan produksi tetap berlaku: migrasi hanya menambah, env baru didokumentasikan, commit tanpa push.

## 1. Perbaiki link TikTok asli dulu

1. **Diagnosis dengan link sungguhan.** Jalankan alur nyata (bukan mock) dengan `https://vt.tiktok.com/ZSgewBdCV/` dan beberapa link TikTok publik lain: link pendek, link panjang `www.tiktok.com/@akun/video/ID`, dan link dengan parameter pelacak. Catat di tahap mana gagalnya:
   - penyelesaian link pendek (HEAD ditolak, redirect lebih dari satu kali, perlu user agent)
   - endpoint oEmbed (status, blokir dari IP server)
   - jenis konten (misalnya postingan foto atau carousel yang tidak didukung oEmbed)
2. **Perbaiki penyelesaian link.**
   - Pakai GET bila HEAD ditolak.
   - Ikuti redirect sampai beberapa kali, asal setiap langkah tetap di domain yang diizinkan.
   - Ambil id video, lalu panggil oEmbed dengan URL kanonis.
   - Pagar SSRF tetap berlaku di setiap langkah.
3. **Bila oEmbed tetap gagal dari server,** jangan berhenti di pesan galat. Langsung tawarkan unggah screenshot di tempat yang sama, dengan satu ketukan.
4. **Diagnostik.**
   - Setiap kegagalan dicatat dengan tahap dan kode status di `ai_logs` (tanpa isi pribadi) dan terlihat di Kesehatan AI.
   - Tambahkan `npm run cek:tiktok -- <url>` untuk diagnosis lokal.
   - Tambahkan pemeriksaan hanya-baca di `npm run uji:produksi` yang mencoba satu link TikTok publik lewat server produksi, supaya ketahuan bila TikTok memblokir Vercel.
5. **Laporkan akar masalah dan buktinya.**

## 2. Tanya Rona satu pintu

### 2.1 Kemampuan baru di chat (semua memakai fungsi yang sudah ada sebagai tool)

1. **Link video dan screenshot.**
   - Link TikTok atau YouTube yang ditempel di chat langsung diproses dengan alur dupe yang sama.
   - Ada tombol lampiran gambar di kotak ketik untuk 1 sampai 3 screenshot.
   - Link Instagram, Shopee, dan lainnya dijawab dengan ajakan mengirim screenshot, lengkap dengan tombol unggah.
2. **Kuis kulit percakapan.**
   - "Bantu aku pilih skincare" atau "kenali kulitku" memulai kuis di dalam chat. Pertanyaannya sama dengan /kuis-kulit dan muncul satu per satu sebagai pilihan cepat (chip bergambar kecil), dan bisa dilewati.
   - Hasilnya disimpan ke profil kulit yang sama.
3. **Foto wajah opsional di chat.**
   - Kartu persetujuan yang sama dengan 7C tampil di dalam chat sebelum kamera atau galeri terbuka.
   - Hasilnya menjadi usulan jawaban kuis yang dikonfirmasi pembeli satu per satu.
4. **Rutinitas di chat.**
   - Kartu rutinitas pagi dan malam beserta subtotal, pilihan "Mulai dari yang penting", dan peringatan bentrok bahan.
   - Tombol "Tambah semua ke keranjang".
   - Tautan "Lihat versi lengkap" ke /rutinitas.
5. **Padanan shade di chat.** Contohnya "Aku pakai cushion Pualam 02, yang setara apa?" menghasilkan kartu 3 shade terdekat beserta alasannya.
6. **"Cocok buat kulitku?"** Saat chat dibuka dari halaman produk, atau produk disebut dengan jelas, tampilkan kecocokan berbasis aturan dengan profil kulit.
7. **Info toko:**
   - Cek ongkir ke kota tujuan (kurir, harga, estimasi).
   - Jam buka dan alamat cabang, dengan tombol rute.
   - Flash sale yang sedang berjalan dan voucher aktif yang memang untuk publik.
   - Kebijakan retur, cara bayar, dan FAQ, dibaca dari teks halaman bantuan (satu sumber).
8. **Lacak pesanan di chat.**
   - Pembeli memberi nomor pesanan dan nomor WA. Aturannya sama dengan /lacak: keduanya harus cocok. Bila pembeli sudah masuk, cukup nomor pesanan miliknya.
   - Hasilnya berupa kartu status dengan lini masa singkat dan tautan ke halaman pesanan.
   - Tanpa data pribadi lain.
9. **Keranjang dari chat.** Setelah menambah produk, tampilkan ringkasan kecil keranjang dengan tombol "Lihat keranjang" dan "Lanjut checkout". Chat tidak membuat pesanan dan tidak memproses pembayaran.

### 2.2 Pengalaman chat

1. **Layar pembuka** berisi sapaan singkat dan chip pintu masuk yang mewakili semua kemampuan, misalnya:
   - "Rekomendasi sesuai kulitku"
   - "Cari yang mirip dari video"
   - "Cari padanan shade"
   - "Lacak pesananku"
   - "Cek ongkir"

   Bila pembeli punya profil kulit, sapaannya menyebut bahwa jawaban disesuaikan.
2. **Satu komponen kartu untuk setiap jenis hasil:** produk, sumber video, rutinitas, shade, status pesanan, ongkir, dan cabang. Desainnya konsisten dengan toko. Di 375 px semuanya nyaman tanpa geser ke samping.
3. **Status proses yang jelas** per tahap ("Aku lihat videonya dulu ya", "Mencocokkan warna"), dengan streaming seperti 7C.
4. **Riwayat percakapan** tetap di sisi klien selama sesi. Di HP, chat terbuka sebagai sheet penuh. Tombol kembali menutup chat, tidak meninggalkan halaman.
5. **Panduan demo dan halaman Tentang Demo** menyertakan 5 contoh kalimat siap tekan untuk mencoba Tanya Rona, termasuk satu link TikTok contoh yang sudah dipastikan bisa dibuka.

### 2.3 Pagar

1. Semua pagar 7A sampai 7C tetap berlaku: validasi produk di server, penjaga harga, tanpa klaim medis, prompt injection dari ulasan, caption, atau link diperlakukan sebagai data, dan SSRF.
2. Advisor tidak boleh lagi menjawab "tidak bisa membuka link" untuk domain yang didukung.
3. Batas pemakaian dihitung per fitur dan bersama. Bila habis, kemampuan berbasis aturan (kuis, rutinitas, padanan shade, lacak, ongkir) tetap jalan di chat tanpa AI.
4. Data lacak pesanan tidak pernah dikirim ke model kecuali status ringkasnya. Verifikasi nomor WA dilakukan di server, bukan oleh model.

## 3. Uji dan eval

1. **Vitest:**
   - Penyelesaian link TikTok dengan respons tiruan untuk semua tahap yang ditemukan di bagian 1.
   - Deteksi link di pesan.
   - Jalur link yang belum didukung.
   - Kuis percakapan sampai profil.
   - Lacak di chat (cocok, tidak cocok, sudah masuk).
   - Tool ongkir dan info cabang.
   - Batas pemakaian bersama.
   - Fallback tanpa AI.
2. **Playwright dengan mock:**
   - Kuis di chat, lalu rutinitas, lalu Tambah semua.
   - Tempel link TikTok tiruan, lalu kartu dupe tampil dan bisa ditambah ke keranjang.
   - Unggah screenshot di chat.
   - Lacak pesanan di chat.
   - Cek ongkir di chat.
   - Tanpa env AI, chip berbasis aturan tetap jalan.
   - Semua di 375 px.
3. **Eval:** tambahkan minimal 15 skenario ke `evals/advisor.json` untuk kemampuan baru, termasuk:
   - link TikTok di tengah kalimat
   - link Instagram
   - permintaan kuis
   - "lacak pesananku" tanpa nomor (harus bertanya balik)
   - nomor WA yang tidak cocok (harus ditolak)
   - cek ongkir ke kota yang tidak dikenal

   Jalankan `npm run eval:ai` dengan Gemini sungguhan dan laporkan skornya.
4. **Uji link asli:** jalankan `npm run cek:tiktok` dengan minimal 3 link TikTok publik dan 1 YouTube Shorts sungguhan, lalu laporkan hasilnya.

## 4. Cuplik

Satu lembar saja, di 375 px, aksi baru "tanya-rona" (dengan mock) yang memotret:
- Layar pembuka dengan chip.
- Kuis di chat.
- Kartu rutinitas.
- Kartu dupe dari link.
- Kartu lacak pesanan.
- Kartu ongkir.

## Selesai

1. Jalankan lint, typecheck, test, build, dan uji Playwright.
2. Jalankan eval dan `cek:tiktok`.
3. Jalankan `npm run cuplik -- --nama=fase8c --halaman=/ --aksi=tanya-rona --lebar=375`. Satu lembar.
4. Jangan buka gambarnya.
5. Perbarui docs/BACKLOG.md, CHANGELOG.md, docs/DEPLOY.md bila ada env baru, dan BRIEF (hanya menambah).
6. Commit dengan pesan "feat: tanya rona satu pintu dan perbaikan link tiktok (fase 8c)". Jangan push.
7. Laporkan:
   - Akar masalah link TikTok beserta buktinya.
   - Yang dibuat dan keputusan yang kamu ambil sendiri.
   - Hasil uji, eval, dan `cek:tiktok`.
   - Perkiraan biaya per percakapan bila bertambah.
   - Urutan memperbarui produksi.
   - Daftar kalimat yang sebaiknya aku coba di HP.
