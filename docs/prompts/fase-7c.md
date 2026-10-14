# Fase 7C: AI dari foto dan link (opsional untuk pembeli)

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md, docs/BRIEF.md bagian Fitur pembeda AI, lalu hasil Fase 7A: `src/lib/ai`, fungsi katalog (`cariProduk`, `padananShade`, `profilKulitSaya`), kuis kulit, Rona Advisor, batas pemakaian, dan `AI_PROVIDER=mock`. Baca juga docs/BACKLOG.md dan docs/DEPLOY.md.

Fase ini menambah dua jalan masuk baru untuk pembeli. **Keduanya sepenuhnya opsional**: tidak ada alur (belanja, checkout, kuis, akun) yang mewajibkan foto atau link. Jalur manual selalu tampil lebih dulu dan sama nyamannya.

Prinsip dari 7A tetap berlaku:
- Tidak mengarang. Produk hanya dari fungsi katalog, diperiksa ulang di server.
- Toko tetap jalan tanpa AI. Bila AI tidak tersedia, kedua fitur ini tidak tampil sama sekali.
- Tanpa klaim medis.
- Biaya terkendali.

Aturan produksi tetap berlaku: migrasi hanya menambah, env baru didokumentasikan, commit tanpa push.

## 0. Perbaikan dari review Fase 7A

1. **Jawaban Advisor jangan mengulang kartu.**
   - Saat ini teks jawaban menyebut ulang semua nama produk dan harga, lalu kartu yang sama tampil di bawahnya.
   - Ubah format keluaran: teks pembuka 1 sampai 2 kalimat yang menjelaskan alasan pilihan secara umum (misalnya "Tiga pilihan ringan untuk kulit berminyak, semuanya di bawah 100 ribu"), tanpa daftar nama dan harga.
   - Setiap produk yang direkomendasikan mendapat kolom `alasan` singkat (maksimal sekitar 90 karakter). Alasan ini divalidasi server (panjang, tanpa klaim medis) dan tampil di kartunya.
   - Terapkan juga di mode mock dan perbarui eval.
2. **Pencarian kalimat terlalu sempit.** "lipstik yang ga bikin bibir kering buat kondangan" hanya menghasilkan 1 produk dari 79, karena semua tafsiran menjadi filter wajib.
   - Kategori, merek, dan batas harga tetap filter wajib.
   - Atribut lunak (finish, manfaat seperti melembapkan, acara) menjadi penambah peringkat, bukan penyaring.
   - Bila hasil kurang dari 3, longgarkan bertahap dan beri tahu dengan jelas, misalnya "Kami longgarkan: tanpa Satin".
   - Chip tetap bisa dihapus. Buat uji untuk perilaku ini.
3. **Tombol melayang menutupi tombol penting.** Di /rutinitas 1440 px, tombol "Tanya Rona" menutupi tombol "Tambah semua ke keranjang".
   - Buat aturan global: tombol melayang selalu naik di atas bilah bawah yang menempel (rutinitas, bilah tambah keranjang di produk versi HP, ringkasan keranjang, menu bawah).
   - Tombol tidak pernah menutupi tombol aksi utama.
   - Periksa semua halaman di 375 dan 1440 px dan buat uji Playwright yang memastikan tidak ada tumpang tindih di halaman-halaman itu.
4. **Rutinitas.**
   - Tampilkan subtotal pagi dan malam.
   - Tambahkan pilihan "Mulai dari yang penting" (3 langkah inti: pembersih, pelembap, sunscreen) dengan total yang jauh lebih ringan, karena total 7 produk sekitar Rp 600 ribu terlalu berat untuk pemula.
   - Pastikan seed menyediakan minimal satu produk retinoid yang stok online-nya ada, supaya peringatan bentrok bahan bisa dipamerkan saat demo. Naikkan versi seed bila perlu.
5. **Hasil eval sungguhan 7A (Gemini, 14 Okt):** skor 19/22. Semua pemeriksaan produkAda, tanpaMedis, merek asli, di luar toko, dan injeksi-abaikan lulus. Yang perlu dibenahi:
   - **Pemeriksaan harga gagal di `budget-100-sunscreen` dan `kado-200`.** Teks jawaban menyebut harga yang berbeda dari harga efektif server (kemungkinan harga normal, harga sebelum flash, atau total paket yang dijumlahkan model). Butir 1 (teks tanpa daftar nama dan harga) seharusnya menutup kelas masalah ini secara struktural. Tambahkan juga penjaga: angka rupiah di teks jawaban harus sama dengan harga efektif salah satu produk yang direkomendasikan, atau dibuang. Total paket dihitung server, bukan model.
   - **`injeksi-harga` gagal di sesuaiHarapan** padahal jawabannya menolak dengan benar ("tidak dapat mengubah harga atau memberikan diskon"). Periksa apakah kriteria eval terlalu kaku. Bila ya, perbaiki kriterianya dan jelaskan di laporan. Jangan melonggarkan pemeriksaan lain.
   - **Token dan latensi terlalu tinggi.** Rata-rata 7.942 token per percakapan (kado-200 sampai 18 ribu), dan latensi 2,4 sampai 11 detik. Kurangi dengan cara:
     - Ringkas hasil tool: hanya kolom yang dipakai, maksimal 6 produk, JSON padat.
     - Kurangi putaran tool yang tidak perlu.
     - Atur tingkat berpikir model ke yang paling rendah yang masih lolos eval (cek parameter di dokumentasi Gemini terbaru).
     - Pastikan streaming menampilkan kata pertama secepat mungkin.
     - Target: rata-rata token di bawah 5.000, median latensi di bawah 6 detik, dan teks pertama muncul di bawah 2 detik.
     - Laporkan angka sebelum dan sesudah.
   - Setelah perbaikan, jalankan `npm run eval:ai` untuk skenario 7A dan 7C. Laporkan skor, token rata-rata per chat dan per tafsiran, serta biaya terukur. Cocokkan tarif dengan halaman harga resmi Google, bukan situs pihak ketiga.

## 1. Bantu isi kuis dari foto

1. **Titik masuk.** Di langkah pertama /kuis-kulit ada dua pilihan:
   - "Isi sendiri": utama, paling menonjol.
   - "Bantu isi dari foto (opsional)".
2. **Persetujuan sebelum unggah.** Tampilkan teks persetujuan singkat yang jujur, lalu centang wajib. Isi teksnya:
   - Foto hanya dipakai untuk memperkirakan kondisi kulit yang terlihat.
   - Foto tidak disimpan dan langsung dibuang setelah diproses.
   - Hasilnya hanya perkiraan dan bisa kamu ubah.
   - Ini bukan pemeriksaan medis.
   - Tautkan ke bagian foto di /kebijakan-privasi.
3. **Unggah.**
   - Kamera atau galeri, 1 foto wajah tanpa filter, dengan cahaya alami.
   - Di browser: diperkecil ke sisi terpanjang 1024 px dan metadata EXIF dibuang sebelum dikirim.
4. **Pemrosesan di server.**
   - Foto hanya ada di memori selama permintaan.
   - Tidak ditulis ke Blob, disk, database, atau log. `ai_logs` hanya mencatat fitur, token, latensi, dan berhasil atau gagal.
   - Buat uji yang memastikan tidak ada jalur penyimpanan.
5. **Keluaran AI terstruktur dengan skema ketat**, hanya kolom berikut beserta tingkat keyakinan (rendah, sedang, tinggi):
   - kilap atau minyak yang tampak
   - kesan kering atau mengelupas yang tampak
   - kemerahan yang tampak
   - noda atau jerawat yang tampak (ada atau tidak, tanpa jenis)
   - perkiraan kedalaman warna kulit 1 sampai 6
   - perkiraan undertone
   - kualitas foto (cukup, gelap, buram, berfilter, wajah tidak terlihat)
6. **Larangan, ditegakkan di skema dan di validasi server:**
   - Tanpa diagnosis atau nama kondisi kulit.
   - Tanpa menebak usia, jenis kelamin, etnis, atau identitas.
   - Tanpa saran pengobatan.
   - Keluaran di luar skema ditolak.
7. **Foto kurang baik.** Bila kualitas foto tidak cukup, minta foto ulang dengan tips singkat, atau tawarkan isi manual.
8. **Hasil mengisi kuis sebagai usulan.**
   - Setiap jawaban terisi diberi tanda "dari foto".
   - Pembeli tetap melewati dan mengonfirmasi setiap langkah. Jawaban berkeyakinan rendah tidak diisi otomatis.
   - Profil kulit yang tersimpan sama bentuknya dengan hasil kuis manual.
9. **Batas pemakaian:** 5 foto per pengunjung per hari, plus batas global harian bersama fitur AI lain.

## 2. Cari dupe dari video atau screenshot

1. **Titik masuk.**
   - Chip di Rona Advisor: "Lihat produk di video? Kirim link-nya".
   - Ikon kecil di kolom cari.
   - Halaman /cari-dari-video.
2. **Masukan yang didukung.**
   - **Link TikTok.** Server hanya memanggil endpoint oEmbed resmi TikTok untuk mendapat caption, nama kreator, dan URL gambar sampul. Jangan mengunduh atau mengurai videonya.
   - **Link YouTube atau YouTube Shorts.** Pakai oEmbed resmi YouTube untuk judul dan sampul. Bila dokumentasi Gemini terbaru mendukung URL YouTube publik sebagai masukan video, pakai itu. Bila tidak, cukup judul dan sampul.
   - **Screenshot** (1 sampai 3 gambar). Ini jalur universal untuk Instagram, Shopee, dan lainnya. Foto diproses di memori lalu dibuang, sama seperti bagian 1.
   - **Link lain,** termasuk Instagram, dijawab dengan ramah dan diarahkan ke screenshot.
3. **Keamanan pengambilan link.**
   - Hanya domain dalam daftar izin (tiktok.com, vt.tiktok.com, youtube.com, youtu.be) dan hanya ke endpoint oEmbed resmi.
   - Redirect diikuti maksimal sekali dan tetap harus berakhir di domain yang diizinkan.
   - Ada batas waktu dan ukuran respons.
   - Server tidak pernah mengambil URL sembarang (cegah SSRF). Buat uji untuk alamat lokal, IP privat, dan domain di luar daftar.
4. **Keluaran AI terstruktur:**
   - kategori dan jenis produk
   - perkiraan warna (hex) dan finish
   - merek dan nama produk bila terbaca jelas (sebagai teks)
   - kata kunci
   - tingkat keyakinan
5. **Pencocokan ke katalog** (berbasis fungsi 7A, bukan AI):
   - Bila merek dan nama cocok dengan produk Rona, tampilkan produk itu.
   - Bila tidak, tampilkan "Rona tidak menjual {nama yang terbaca}, ini yang paling mirip", lalu 3 alternatif dari `cariProduk` (kategori, finish) dan `padananShade` (jarak warna dari hex perkiraan). Setiap alternatif menyebut alasannya, misalnya "warna paling dekat" atau "finish sama, harga lebih hemat".
   - Bila produk tidak dikenali, minta screenshot yang lebih jelas.
6. **Tampilan sumber.**
   - Sampul dan caption dari oEmbed ditampilkan dengan atribusi kreator dan tautan ke video asli. Sampul tidak di-hosting ulang dan tidak disimpan.
   - Nama merek asli hanya muncul sebagai teks dari masukan pembeli, tidak pernah sebagai produk yang dijual.
7. **Cache** hasil ekstraksi (teks terstruktur saja) per hash URL selama 7 hari. Screenshot tidak di-cache.
8. **Batas pemakaian:** 10 permintaan per pengunjung per hari.

## 3. Privasi dan teks

1. Tambahkan bagian "Foto dan link yang kamu kirim" di /kebijakan-privasi. Bila halamannya belum ada, buat versi sederhana sekarang; Fase 8 akan melengkapinya.
2. Semua teks ditulis dalam bahasa Indonesia yang hangat dan singkat, dengan sapaan "kamu". Kata "opsional" selalu terlihat.

## 4. Evaluasi tanpa bergantung internet

1. **Buat set uji sintetis dari ProductArt sendiri.** Render beberapa produk Rona (lewat skrip render yang sudah ada untuk cuplik) sebagai gambar "screenshot", termasuk dengan latar dan teks caption buatan.
   - Ukur apakah alur dupe menemukan produk yang benar atau shade terdekat yang benar.
   - Tambahkan gambar produk generik tanpa merek untuk menguji jalur "tidak dijual, ini yang mirip".
2. **Foto wajah:** jangan memakai foto orang sungguhan di repo. Uji jalur foto memakai `AI_PROVIDER=mock` dan gambar sintetis sederhana. Evaluasi sungguhan dilakukan manual oleh Atha (catat di laporan).
3. `npm run eval:ai` diperluas dengan skenario 7C (dilewati bila tidak ada kunci) dan tabel skor.

## 5. Uji

1. **Vitest:**
   - Skema dan validasi keluaran foto (kolom terlarang ditolak).
   - Tidak ada jalur penyimpanan foto.
   - Pengisian kuis dari usulan (keyakinan rendah tidak diisi).
   - Pengambil oEmbed dengan daftar izin, redirect, batas waktu, dan uji SSRF.
   - Pencocokan dupe dan alasannya.
   - Cache per URL.
   - Batas pemakaian.
   - Fitur tersembunyi saat AI tidak tersedia.
2. **Playwright dengan mock:**
   - Kuis dengan "Bantu isi dari foto", lalu jawaban terisi bertanda, lalu konfirmasi, lalu rutinitas.
   - Kuis "Isi sendiri" tetap jalan seperti sebelumnya.
   - Tempel link TikTok tiruan (mock oEmbed), lalu tampil "tidak dijual, ini yang mirip" dengan 3 kartu dan tombol tambah ke keranjang.
   - Unggah screenshot ProductArt, lalu produk yang tepat ditemukan.

## 6. Cuplik

Tambahkan aksi "ai-foto" pada skrip cuplik (dengan mock) yang memotret:
- Pilihan isi kuis.
- Layar persetujuan foto.
- Kuis terisi dari foto.
- Halaman /cari-dari-video dengan hasil dupe di 375 dan 1440 px.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run eval:ai` bila kunci tersedia, dan sertakan tabel skor 7C.
3. Jalankan `npm run cuplik -- --nama=fase7c --halaman=/kuis-kulit --aksi=ai-foto`. Targetkan 1 lembar.
4. Jangan buka gambarnya.
5. Perbarui docs/BACKLOG.md, docs/DEPLOY.md, `.env.example`, dan BRIEF (hanya menambah).
6. Commit dengan pesan "feat: AI dari foto dan link (fase 7c)". Jangan push.
7. Laporkan:
   - Yang dibuat dan keputusan yang kamu ambil sendiri.
   - Hasil uji dan evaluasi.
   - Perkiraan biaya per foto dan per link.
   - Migrasi baru, env baru, dan urutan memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual (termasuk uji foto wajah sungguhan di HP).
