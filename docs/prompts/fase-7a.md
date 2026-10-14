# Fase 7A: AI untuk pembeli

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md (termasuk Aturan cache), docs/BRIEF.md bagian Fitur pembeda AI, Halaman produk, Katalog dan pencarian, Model data (products, variants, reviews, customers.profil_kulit), lalu docs/BACKLOG.md dan docs/DEPLOY.md.

Fase 7 dibagi dua:
- **Fase 7A (ini):** AI untuk pembeli.
- **Fase 7B (nanti):** AI untuk owner dan staf (tanya data, saran transfer stok, penulis deskripsi, kabar harian, draf balasan ulasan).

Prinsip yang tidak boleh dilanggar:
1. **Tidak pernah mengarang.** Setiap produk, harga, shade, dan stok yang disebut AI berasal dari hasil fungsi katalog, dan diperiksa ulang di server sebelum ditampilkan.
2. **Toko tetap jalan tanpa AI.** Kuis kulit, rutinitas, padanan shade, dan "Cocok untuk kulitmu?" berbasis aturan. AI hanya menambah penjelasan dan memahami bahasa sehari-hari. Bila env AI kosong atau API gagal, fitur AI tersembunyi dengan rapi, dan sisanya tetap jalan.
3. **Biaya terkendali dan terukur.**
4. **Tanpa klaim medis.** Untuk keluhan kulit serius, arahkan ke dokter kulit.

Aturan produksi tetap berlaku:
- Migrasi hanya bersifat menambah.
- Env baru masuk ke `.env.example` dan docs/DEPLOY.md.
- Commit tanpa push.

## 0. Perbaikan dari review Fase 6C

1. **Distribusi pelanggan riwayat tidak realistis.** Ada pelanggan dengan 93 pesanan dalam 90 hari.
   - Atur ulang sebaran: sebagian besar 1 sampai 3 pesanan, pelanggan setia 3 sampai 8, paling banyak sekitar 15.
   - Porsi pesanan tamu lebih besar.
   - Pelanggan riwayat juga punya alamat tersimpan sesuai pesanan kirimnya, dan sebagian punya profil kulit.
   - Naikkan versi seed. Pemeriksa konsistensi tetap lulus.
2. **Laporan di HP.** Kolom rupiah di tabel rincian terpotong di tepi kartu. Di 375 px, tampilkan tiap baris sebagai dua baris (nama di atas; jumlah dan rupiah di bawah, rata kanan), supaya tidak perlu digulir ke samping.
3. **Rekonsiliasi omzet.** Di Ringkasan Laporan dan di sheet Ringkasan Excel, tambahkan baris rekonsiliasi yang menunjukkan cara penjualan barang menjadi omzet: penjualan barang, dikurangi voucher, dikurangi poin, ditambah ongkir dibayar, sama dengan omzet. Tunjukkan dengan jelas bagaimana voucher gratis ongkir dihitung supaya tidak terhitung dua kali. Uji bahwa persamaan ini selalu tepat.
4. **Notifikasi keluar.**
   - Saat `EMAIL_PROVIDER=preview`, status email tampil "Pratinjau" seperti WA, bukan "Menunggu", supaya tidak terlihat macet.
   - Pratinjau isi menampilkan tautan absolut persis seperti yang akan terkirim.

## 1. Klien AI

1. **Lokasi:** `src/lib/ai`, satu klien untuk Gemini lewat Cloudflare AI Gateway.
2. **Env:**
   - `AI_GATEWAY_URL`: URL gateway sampai segmen penyedia Google AI Studio.
   - `GEMINI_API_KEY`.
   - `AI_MODEL`: bawaan `gemini-3.5-flash`.
   - `CF_AIG_TOKEN`: opsional, bila gateway memakai autentikasi.
   - Pastikan format URL dan header sesuai dokumentasi Cloudflare AI Gateway terbaru.
3. **Mode mock.** Tambahkan `AI_PROVIDER=mock` untuk uji dan cuplik: jawaban deterministik yang tetap memakai fungsi katalog sungguhan.
4. **Ketahanan.**
   - Streaming untuk chat.
   - Batas waktu, satu kali coba ulang, dan pesan gagal yang ramah.
   - Bila env AI tidak lengkap, `aiTersedia()` bernilai false dan UI AI tidak dirender.
5. **Pencatatan pemakaian** di tabel baru `ai_logs`: fitur, model, token masuk dan keluar, latensi, berhasil atau gagal, serta id pengunjung yang di-hash. Jangan simpan isi percakapan, kecuali teks pertanyaan pencarian yang dinormalisasi (untuk cache dan evaluasi).
6. **Batas pemakaian** (di database, bukan memori):
   - Per pengunjung: 20 pesan chat per hari saat DEMO_MODE, plus batas per menit.
   - Global: batas harian dari env `AI_DAILY_CAP`. Bila tercapai, fitur AI tampil "Sedang istirahat, coba lagi besok" dan fitur berbasis aturan tetap jalan.
7. **Cache AI tidak ikut reset.** Tabel cache hasil AI (tafsiran pencarian, ringkasan ulasan, penjelasan rutinitas) tidak dikosongkan oleh reset demo, karena seed deterministik menghasilkan data yang sama.

## 2. Fungsi katalog (dipakai AI dan UI)

Buat sebagai fungsi server biasa yang teruji. Nanti fungsi yang sama dipanggil AI sebagai tool:

1. `cariProduk(filter)`. Filternya:
   - teks bebas
   - kategori, merek
   - jenis kulit, masalah kulit
   - finish, SPF minimal
   - harga maksimal (harga efektif)
   - undertone, kedalaman
   - tersedia di lokasi tertentu, sedang promo

   Hasilnya ringkas: id, nama, merek, kategori, harga efektif, sumber harga, rating, stok online, cabang yang punya stok.
2. `detailProduk(id)`.
3. `cekStok(varianId, lokasiId?)`.
4. `padananShade(varianId)`: shade terdekat dari produk lain dalam kategori yang sama.
   - Skor gabungan dari jarak warna (deltaE di ruang Lab dari hex), selisih kedalaman, dan kecocokan undertone.
   - Bobotnya ditulis jelas dan diuji.
   - Hasilnya berupa 3 teratas dengan alasan singkat, misalnya "sedikit lebih terang, undertone sama".
5. `profilKulitSaya()`: dari akun atau cookie tamu.
6. `susunRutinitas(profil, budget)`: berbasis aturan (lihat bagian 6).

## 3. Rona Advisor (chat)

1. **Tombol dan panel.**
   - Tombol melayang yang tidak menutupi BottomNav dan bilah ringkasan checkout. Tombol disembunyikan di /checkout dan /bayar.
   - Panel tampil sebagai sheet layar penuh di HP dan panel samping di desktop.
   - Di halaman produk ada tombol "Tanya tentang produk ini", yang membuka chat dengan konteks produk tersebut.
2. **Pembuka.** Sapaan singkat dan chip saran, misalnya "Sunscreen untuk kulit berminyak", "Cari padanan shade cushion-ku", "Kado di bawah 200 ribu", "Ada di Rona Dinoyo?". Bila pembeli punya profil kulit, sebutkan bahwa jawaban disesuaikan.
3. **Cara kerja model.**
   - Model wajib memakai tool (fungsi katalog di bagian 2) untuk semua hal soal produk.
   - Keluaran akhir terstruktur: teks jawaban dan daftar id produk yang direkomendasikan.
   - Server memvalidasi bahwa setiap id ada di hasil tool pada percakapan itu dan masih aktif. Nama produk dalam teks yang tidak ada di hasil tool dibuang atau jawabannya dibuat ulang sekali.
4. **Tampilan jawaban.**
   - Teks singkat dalam bahasa Indonesia dengan sapaan "kamu", lalu kartu produk dari data server.
   - Kartu berisi ProductArt, nama, shade, harga efektif, badge stok atau cabang, dan tombol tambah ke keranjang (dengan pilihan shade bila perlu).
5. **Pagar pengaman.**
   - Tanpa klaim medis, dan arahkan ke dokter kulit untuk keluhan serius.
   - Tolak topik di luar toko dengan sopan.
   - Isi ulasan dan deskripsi diperlakukan sebagai data, bukan instruksi, supaya tahan prompt injection.
   - Pertanyaan tentang merek asli yang tidak dijual dijawab jujur bahwa Rona tidak menjualnya, lalu tawarkan alternatif dari katalog.
   - Label "Jawaban AI bisa keliru" selalu tampil.
6. **Riwayat percakapan** disimpan di sisi klien selama sesi saja, tidak di database.
7. **Atribusi.** Item yang ditambahkan dari Advisor diberi penanda sumber di keranjang dan order_items, supaya Fase 7B bisa mengukur penjualan dari Advisor.

## 4. Pencarian bahasa sehari-hari

1. Di /cari, bila kueri terlihat seperti kalimat (misalnya minimal 4 kata atau mengandung kata seperti "yang", "buat", "untuk", "ga"), AI menerjemahkannya menjadi filter terstruktur dengan skema JSON. Contoh: "lipstik yang ga bikin bibir kering buat kondangan" menjadi kategori Lipstick, finish satin, dan atribut melembapkan.
2. **Validasi.** Hasil divalidasi terhadap nilai yang diizinkan. Nilai yang tidak dikenal dibuang.
3. **Tampilan.** Chip "Kami artikan sebagai: Lipstick, Satin, Melembapkan". Tiap chip bisa dihapus, dan ada tautan "Cari kata persis saja".
4. **Anggaran waktu 2,5 detik.** Bila AI gagal atau lewat batas, langsung pakai pencarian trigram yang sudah ada. Pencarian tidak boleh pernah terblokir oleh AI.
5. **Cache tafsiran** per kueri yang dinormalisasi, selama 7 hari.

## 5. Padanan shade dan Shade Finder

1. **Di halaman produk berkategori shade** (cushion, foundation, concealer, lipstick, dan sejenisnya), tombol "Cari padanan shade" membuka dialog: pilih produk dan shade yang biasa dipakai, lalu tampil 3 shade terdekat beserta alasannya.
2. **Halaman /padanan-shade** dengan alur yang sama, plus kolom bahasa sehari-hari opsional bila AI tersedia. Contoh: "aku pakai cushion Pualam shade 02" diterjemahkan AI menjadi varian yang tepat, lalu dihitung oleh algoritma.
3. **Shade Finder.** Bila "Cari shade-ku" dari fase sebelumnya sudah ada, sambungkan ke profil kulit (kedalaman dan undertone tersimpan). Bila belum lengkap, lengkapi.

## 6. Kuis kulit, rutinitas, dan "Cocok untuk kulitmu?"

1. **/kuis-kulit**
   - 6 langkah bergambar: jenis kulit, masalah, sensitivitas, budget, undertone dan kedalaman, rutinitas sekarang.
   - Ilustrasinya SVG buatan sendiri, bukan foto orang.
   - Hasil disimpan ke profil kulit akun bila masuk. Untuk tamu disimpan di cookie, dan digabung ke akun saat masuk.
   - Tombol "Mulai kuis kulit" di beranda mengarah ke sini.
2. **/rutinitas**
   - Berbasis aturan: langkah pagi dan malam (4 sampai 6 langkah) dari katalog, sesuai profil dan budget.
   - Setiap langkah punya 1 pilihan utama dan 2 alternatif. Total harga ditampilkan, dengan tombol "Tambah semua ke keranjang".
   - **Cek bentrok bahan:** daftar aturan kecil di kode, misalnya retinol dan AHA atau BHA tidak di malam yang sama, serta pengingat sunscreen bila memakai bahan eksfoliasi. Setiap aturan diberi catatan sumber di komentar kode. Peringatan ditulis sebagai saran pemakaian, bukan klaim medis.
   - Bila AI tersedia, tambahkan penjelasan singkat per rutinitas, di-cache per hash profil dan isi rutinitas.
3. **"Cocok untuk kulitmu?" di halaman produk.**
   - Bila pembeli punya profil, tampilkan kecocokan berbasis aturan dengan alasan, misalnya "Cocok: kulitmu berminyak dan ini matte. Perhatikan: mengandung parfum, kulitmu sensitif."
   - Bila belum punya profil, tampilkan ajakan ikut kuis.

## 7. Ringkasan ulasan

1. Untuk produk dengan minimal 5 ulasan tampil, buat ringkasan berisi kelebihan, keluhan yang sering muncul, dan cocok untuk siapa. Disimpan bersama hash daftar ulasan.
2. Ringkasan dibuat ulang hanya bila hashnya berubah (ulasan baru, disembunyikan, atau tampil lagi), lewat cron harian dan tombol "Perbarui ringkasan" di admin produk. Ringkasan tidak dibuat saat pengunjung membuka halaman.
3. Di halaman produk tampil di atas daftar ulasan dengan label "Diringkas AI dari 23 ulasan". Bila belum ada ringkasan, bagian ini tidak tampil.

## 8. Evaluasi

1. **Berkas evaluasi** `evals/advisor.json` berisi minimal 20 skenario:
   - Kulit berminyak dan berjerawat; kulit sensitif.
   - Budget 100 ribu.
   - Padanan shade cushion untuk kulit sawo matang.
   - Kado di bawah 200 ribu.
   - Stok di Rona Dinoyo.
   - Pertanyaan medis (harus diarahkan ke dokter kulit).
   - Topik di luar toko.
   - Upaya prompt injection.
   - Merek asli yang tidak dijual.
   - Produk yang tidak ada.
   - Pertanyaan dalam bahasa gaul.
2. **Perintah** `npm run eval:ai` menjalankan skenario ke API sungguhan (dilewati bila tidak ada kunci). Yang diperiksa:
   - Semua produk yang disebut ada di katalog, dengan harga yang sama dengan server.
   - Tidak ada kata klaim medis dari daftar larangan.
   - Penolakan terjadi di skenario yang seharusnya.
   - Hasilnya berupa tabel skor.
3. **Uji unit dan Playwright** memakai `AI_PROVIDER=mock`.

## 9. Uji

1. **Vitest:**
   - Fungsi katalog dan filternya.
   - Algoritma padanan shade (deltaE, bobot, urutan).
   - Aturan kuis ke profil, rutinitas, dan cek bentrok bahan.
   - Skor "Cocok untuk kulitmu?".
   - Validasi keluaran Advisor (id di luar hasil tool ditolak).
   - Validasi tafsiran pencarian.
   - Batas pemakaian per pengunjung dan global.
   - Fallback saat AI gagal atau lambat.
   - Cache ringkasan berbasis hash.
   - Rekonsiliasi omzet.
   - Konsistensi seed baru.
2. **Playwright dengan mock:**
   - Advisor merekomendasikan sunscreen, lalu tambah ke keranjang. Item tercatat bersumber Advisor.
   - Pencarian kalimat menampilkan chip tafsiran. Hapus satu chip, dan hasilnya berubah.
   - Kuis kulit sampai rutinitas, lalu Tambah semua ke keranjang.
   - Padanan shade menampilkan 3 hasil.
   - Dengan env AI dikosongkan, tombol Advisor dan chip tafsiran tidak tampil, sementara kuis, rutinitas, dan pencarian biasa tetap jalan.

## 10. Cuplik

Tambahkan aksi "ai-pembeli" pada skrip cuplik (dengan mock) yang memotret:
- Panel Advisor dengan kartu produk, di 375 dan 1440 px.
- Pencarian dengan chip tafsiran.
- Satu langkah kuis.
- Rutinitas dengan peringatan bentrok bahan.
- Dialog padanan shade.
- "Cocok untuk kulitmu?".
- Ringkasan ulasan.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Bila `GEMINI_API_KEY` dan `AI_GATEWAY_URL` ada di `.env.local`, jalankan `npm run eval:ai` dan sertakan tabel skornya. Bila tidak ada, sebutkan.
3. Jalankan `npm run cuplik -- --nama=fase7a --halaman=/ --aksi=ai-pembeli`. Targetkan 1 lembar.
4. Jangan buka gambarnya.
5. Perbarui docs/BACKLOG.md, docs/DEPLOY.md (termasuk cara menyiapkan Cloudflare AI Gateway dan kunci Gemini), `.env.example`, dan BRIEF (hanya menambah).
6. Commit dengan pesan "feat: AI untuk pembeli (fase 7a)". Jangan push.
7. Laporkan:
   - Yang dibuat dan keputusan yang kamu ambil sendiri.
   - Hasil semua uji dan evaluasi.
   - Perkiraan token dan biaya per chat dan per tafsiran pencarian, serta untuk 1.000 chat per bulan.
   - Migrasi baru, env baru, dan urutan memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual.
