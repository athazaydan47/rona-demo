# Fase 8A: Poles pengalaman, gerak, kecepatan, dan konten

Model yang disarankan: Fable 5. Fase ini paling banyak soal rasa desain dan detail visual.

Baca dulu: CLAUDE.md, docs/BRIEF.md bagian Bedah cfbeauty.id (kelemahan dan perbaikannya), Design system (Warna, Huruf dan ukuran, Komponen inti, Gerak, Bahasa), Halaman pendukung, dan Skenario demo 5 menit. Baca juga seluruh docs/BACKLOG.md.

Tujuan fase ini: Rona terasa seperti produk jadi dari studio kelas atas, bukan template. Setiap interaksi halus, cepat, konsisten, dan tidak ada sudut yang terlupakan, baik di toko maupun di admin, di HP maupun desktop. Jangan menambah fitur besar baru. Fokus pada kualitas.

Aturan produksi tetap berlaku: migrasi hanya menambah, env baru didokumentasikan, commit tanpa push.

## 0. Perbaikan dari review fase sebelumnya

Bila bagian ini tidak berisi butir, lewati.

## 1. Audit menyeluruh dulu, baru perbaiki

1. **Jelajahi setiap halaman toko dan admin** di 375, 390, 768, dan 1440 px, sebagai tamu, Pembeli Demo, dan keempat peran staf.
2. **Tulis temuan di `docs/AUDIT-POLES.md`**, dikelompokkan:
   - Konsistensi visual: jarak, tipografi, warna, radius, bayangan, ikon.
   - Status kosong, memuat, dan error.
   - Teks: nada "kamu", typo, dan tidak ada em-dash.
   - Interaksi dan gerak.
   - Aksesibilitas.
   - Kecepatan.
3. **Tandai prioritas** tiap temuan, lalu kerjakan semua prioritas tinggi dan sedang. Prioritas rendah yang tidak sempat dicatat di BACKLOG dengan alasannya.

## 2. Gerak dengan Motion

Satukan semua gerak ke token yang sama di Design system:
- durasi (cepat, sedang, lambat)
- easing
- spring untuk elemen yang bisa diseret

Tidak ada animasi liar per komponen. Yang perlu dipoles:

1. **Tambah ke keranjang:** umpan balik yang jelas, berupa ikon ProductArt kecil terbang ke ikon keranjang (atau alternatif yang halus di HP), badge berdenyut sekali, lalu laci terbuka dengan spring yang tenang.
2. **Laci, dialog, sheet di HP, dan menu mega:** masuk dan keluar halus, dengan latar meredup. Fokus terkunci di dalam. Bisa ditutup dengan geser ke bawah untuk sheet HP.
3. **Pemilih shade:** pergantian swatch dan gambar ProductArt bertransisi lembut (crossfade atau morph warna), tanpa lompatan tata letak.
4. **Daftar dan grid produk:** muncul bertahap saat masuk layar, sekali saja dan halus. Pergantian filter melakukan animasi tata letak tanpa berkedip.
5. **Hitung mundur flash sale:** angka berganti dengan flip halus. Bilah kuota beranimasi saat berubah.
6. **Kerangka memuat:** berpindah ke konten dengan crossfade, tanpa pergeseran tata letak.
7. **Admin:**
   - Kartu kanban diseret dengan bayangan terangkat dan kembali dengan spring bila ditolak.
   - Sorotan pesanan baru di dashboard.
   - Angka ringkasan berhitung naik saat berubah.
   - Toast konsisten.
8. **Chat Advisor dan Asisten Admin:** gelembung masuk halus, indikator mengetik, dan teks streaming tanpa melompat.
9. **Aturan:**
   - Hormati `prefers-reduced-motion` di semua gerak (ganti dengan fade singkat atau tanpa animasi).
   - Tidak ada animasi yang memblokir interaksi.
   - Target 60 fps di HP Android kelas menengah. Uji dengan CPU throttling 4x di Playwright atau DevTools, dan laporkan bila ada yang patah.

## 3. Kecepatan

1. **Target Lighthouse mobile** untuk beranda, katalog, produk, keranjang, dan checkout:
   - Performance minimal 90.
   - Accessibility minimal 95.
   - Best Practices minimal 95.
   - LCP di bawah 2,5 detik dan CLS di bawah 0,05 pada profil 4G.
   Ukur di build produksi lokal dan laporkan angkanya sebelum dan sesudah.
2. **Ukuran HTML halaman.** Di BACKLOG tercatat sekitar 850 KB. Cari penyebabnya (data yang ikut terserialisasi, komponen klien yang terlalu besar) dan turunkan dengan target yang jelas.
3. **Anggaran JavaScript per route.** Pisahkan kode yang berat (Leaflet, grafik admin, editor) supaya hanya dimuat saat dibutuhkan.
4. **Bug prefetch halaman produk.** Selidiki akar error 500 setelah admin menyimpan produk dengan `partialPrefetching`, yang di Fase 6B diatasi dengan `instant = false`. Bila akar masalahnya bisa diperbaiki dengan aman, kembalikan prefetch instan. Bila belum bisa, jelaskan alasannya dan biarkan.
5. **Font dan gambar.**
   - Subset font, preload hanya yang dipakai di atas lipatan, dan `font-display` yang tepat.
   - Gambar dan foto Blob lewat optimasi next/image dengan ukuran yang benar.
6. **Neon cold start.** Ukur waktu respons pertama setelah database tidur. Bila terasa (lebih dari 1 detik), pastikan halaman katalog yang di-cache tetap tampil cepat dan tampilkan kerangka memuat untuk bagian dinamis.

## 4. Aksesibilitas

1. Kontras warna memenuhi WCAG AA di semua teks dan komponen, termasuk badge dan teks kecil abu-abu.
2. Fokus selalu terlihat, urutan tab masuk akal, dan semua aksi bisa dengan keyboard, termasuk pemilih shade, kanban (alternatif keyboard untuk pindah status), dan pohon kategori.
3. Label dan nama aksesibel untuk semua ikon, tombol, dan input. Pesan error terhubung ke kolomnya.
4. Tambahkan pemeriksaan axe di Playwright untuk halaman utama toko dan admin, dengan target nol pelanggaran serius dan kritis.

## 5. Konten dan halaman pendukung

1. **Lengkapi semua halaman di footer dan menu bantuan** dengan isi yang rapi, singkat, dan masuk akal untuk toko fiktif:
   - Cara Belanja.
   - Pertanyaan Umum (FAQ dengan akordeon).
   - Kebijakan Retur, termasuk aturan video unboxing yang ditulis rapi.
   - Kebijakan Privasi: data yang dikumpulkan, foto dan link dari 7C, cookie, hak pengguna sesuai UU PDP, dan kontak.
   - Syarat dan Ketentuan.
   - Toko Kami (3 cabang, peta, jam buka, tombol rute Google Maps).
   - Cek Ongkir.
   - Kontak.
   - Halaman ini juga menjadi sumber tool `panduan_admin` atau FAQ bila relevan. Satu sumber teks, tidak dua.
2. **Nol tautan mati.** Perluas `npm run cek:404` menjadi perayap tautan internal untuk seluruh situs toko, lalu jalankan.
3. **Halaman 404 dan 500** yang sesuai identitas Rona, dengan pencarian dan tautan ke kategori populer.
4. **Status kosong, memuat, dan error** di setiap halaman toko dan admin yang ditemukan di audit. Setiap status punya kalimat yang membantu dan satu aksi berikutnya.
5. **Periksa ulang seluruh teks** untuk nada, ejaan, dan konsistensi istilah. Contohnya: "Ambil di Toko" selalu ditulis sama, dan "Pesanan" tidak bercampur dengan "Order". Pastikan tidak ada em-dash di mana pun.

## 6. Pengalaman demo

1. **/tentang-demo menjadi halaman etalase:**
   - Apa ini dan siapa pembuatnya (dari env studio).
   - Fitur yang bisa dicoba, dikelompokkan untuk pembeli, admin, dan AI.
   - Tombol masuk cepat.
   - Stack singkat.
   - Ajakan menghubungi studio via WA.
2. **Panduan demo** (bisa dibuka dari pita demo):
   - Daftar centang berisi 8 sampai 10 hal untuk dicoba, mengikuti Skenario demo 5 menit di BRIEF.
   - Tercentang otomatis saat langkahnya dilakukan, disimpan di localStorage dengan try/catch.
   - Bisa ditutup dan tidak mengganggu.
3. **Pita demo dan footer studio:** teks final yang jujur dan ringkas.

## 7. Uji dan regresi

1. Seluruh uji Vitest dan Playwright tetap hijau.
2. Tambahkan proyek Playwright WebKit (mewakili Safari iPhone) untuk alur beli dan alur admin utama.
3. Pemeriksaan axe dan perayap tautan masuk ke perintah uji.
4. Uji gerak: dengan `prefers-reduced-motion`, tidak ada animasi transform yang berjalan.

## 8. Cuplik

Jalankan cuplik ringkasan dalam mode ringkas, maksimal 3 lembar, untuk halaman utama toko dan admin setelah dipoles:
- beranda
- katalog
- produk
- keranjang
- checkout
- akun
- tentang-demo
- dashboard
- pesanan
- stok
- laporan

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright (termasuk WebKit, axe, dan perayap tautan).
2. Laporkan tabel Lighthouse sebelum dan sesudah untuk 5 halaman toko.
3. Jalankan `npm run cuplik -- --nama=fase8a --halaman=/,/c/bibir,/keranjang,/tentang-demo,/admin`. Sesuaikan daftar halaman dengan sintaks skrip yang ada. Maksimal 3 lembar.
4. Jangan buka gambarnya.
5. Perbarui docs/BACKLOG.md, docs/AUDIT-POLES.md, dan BRIEF bagian Gerak (hanya menambah token yang dipakai).
6. Commit dengan pesan "feat: poles pengalaman, gerak, kecepatan, konten (fase 8a)". Jangan push.
7. Laporkan:
   - Ringkasan audit dan yang diperbaiki.
   - Keputusan yang kamu ambil sendiri.
   - Hasil uji, angka Lighthouse, dan ukuran HTML serta JS sebelum dan sesudah.
   - Status bug prefetch.
   - Urutan memperbarui produksi.
   - File cuplik, dan apa yang perlu aku cek manual di HP sungguhan.
