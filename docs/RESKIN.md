# Reskin untuk klien

Langkah mengubah Rona menjadi toko klien: nama dan tampilan, konten, katalog, cabang, ongkir, pembayaran, WhatsApp, domain, dan deploy. Perkiraan waktu untuk satu pengembang yang sudah mengenal kode ini, dengan data klien yang rapi.

| Tahap | Perkiraan |
| --- | --- |
| Reskin tampilan dan konten, katalog, cabang, ongkir, deploy (langkah 1 sampai 9 dan 12) | 3 sampai 5 hari kerja |
| Payment gateway sungguhan (langkah 10) | 2 sampai 3 hari kerja, plus waktu verifikasi akun gateway |
| WhatsApp Business resmi (langkah 11) | 1 sampai 2 hari kerja, plus verifikasi bisnis dan persetujuan templat Meta (bisa 1 sampai 2 minggu) |

Jalankan langkah 10 dan 11 sejajar dengan yang lain, karena waktu tunggunya di pihak ketiga.

## Sebelum mulai: pertanyaan untuk klien

Kirim daftar ini di awal. Jawabannya menentukan hampir semua langkah di bawah.

**Merek dan tampilan**

1. Nama toko (pendek dan lengkap), tagline, dan satu kalimat deskripsi toko.
2. Logo (SVG bila ada) dan favicon. Bila belum ada logo, apakah logo teks dengan font pilihan cukup?
3. Warna merek (minimal warna utama). Font yang dipakai di materi mereka, bila ada.
4. Awalan nomor pesanan (misal `TOKO-2610-000123`).

**Kontak dan legal**

5. Nomor WhatsApp toko, email, alamat, Instagram, dan TikTok.
6. Kebijakan retur dan pengembalian dana. Jam layanan pelanggan.
7. Apakah sudah punya kebijakan privasi? Siapa yang bertanggung jawab atas data pelanggan?

**Katalog dan stok**

8. Daftar produk dalam bentuk spreadsheet: merek, kategori, nama, shade atau varian, SKU, harga normal, harga jual, berat, dan stok per lokasi (templat: `docs/templat-katalog.csv`).
9. Struktur kategori yang mereka pakai. Foto produk sendiri, atau memakai gambar ilustrasi `ProductArt`?
10. Siapa yang akan mengisi dan memperbarui stok: gudang, kasir cabang, atau owner?

**Cabang dan pengiriman**

11. Berapa cabang? Alamat, jam buka, hari libur, titik peta, dan apakah bisa Ambil di Toko.
12. Kota asal pengiriman. Kurir yang dipakai dan tarif per zona, atau tarif dari agregator?
13. Batas jam kirim hari ini, gratis ongkir (minimal belanja dan potongan), dan pengiriman instan dalam kota.

**Pembayaran dan notifikasi**

14. Payment gateway yang dipilih (misal Midtrans atau Xendit) dan metode yang diaktifkan: QRIS, virtual account, e-wallet, kartu.
15. Apakah sudah punya akun WhatsApp Business Platform resmi? Bila belum, siapa yang mengurus verifikasi bisnis di Meta?
16. Domain email pengirim (misal `halo@tokoklien.id`) untuk email transaksi.

**Fitur**

17. Fitur mana yang dipakai: AI untuk pembeli, AI dari foto dan link, AI untuk admin, flash sale, poin, Ambil di Toko, banyak cabang.
18. Siapa saja staf dan perannya (owner, admin online, staf cabang, gudang)?
19. Domain situs. Apakah sudah punya akun Vercel, Neon, dan Google Cloud, atau dibuatkan?

## 1. Konfigurasi merek (2 sampai 4 jam)

Satu berkas: `src/config/merek.ts`.

- `kunci`: kunci teknis huruf kecil, misal `tokoklien`. Dipakai sebagai awalan cookie, penyimpanan browser, nama berkas unduhan, dan header webhook. Tentukan sekali di awal, karena mengubahnya nanti membuat sesi dan keranjang pengunjung lama tidak terbaca.
- `nama`, `namaLengkap`, `subLogo`, `tagline`, `deskripsi`, `deskripsiFooter`, `kategoriToko`.
- `prefiksPesanan`: huruf kapital, misal `TOKO`.
- `asisten`: nama asisten AI dan label tombolnya.
- `kontak`: WhatsApp (kode negara tanpa plus), email, alamat, kota, Instagram, TikTok.
- `domainDemo`: domain email akun staf demo.
- `studio`: kredit pembuat di footer (bisa juga lewat env `STUDIO_NAME`, `STUDIO_URL`, `STUDIO_WA`).
- `pitaDemo`: teks pita demo. Tidak tampil bila `DEMO_MODE` bukan `true`.
- `palet`: 16 warna. Yang paling terlihat: `aksen` (tombol dan tautan), `kopi` (teks), `porselen` (latar), `blush` (latar lembut). Varian `...Teks` harus lolos kontras AA di latar terang. Uji aksesibilitas Playwright akan gagal bila tidak.
- `productArt`: warna latar dan sudut gambar produk ilustrasi.

Font ada di `src/config/font.ts`. Ganti dua pemanggilan `next/font/google` (judul dan teks). Nama variabel CSS jangan diubah.

Logo toko berupa teks dari `nama` dan `subLogo`. Untuk logo gambar, ganti komponen logo di header, footer, dan panel admin (cari `MEREK.nama` di `src/components/layout`). Ganti `src/app/favicon.ico`.

Periksa: `npm run test` menjalankan `src/config/merek.test.ts`, yang gagal bila nama merek lama masih tertanam di `src` di luar konfigurasi, konten, dan seed.

Di luar `src`, nama merek dan nama cabang demo masih muncul di uji Playwright (`e2e`), skenario evaluasi AI (`evals`), skrip cuplik (`scripts`), dan panduan admin (`docs/panduan-admin`). Sesuaikan bersama data seed klien, lalu jalankan seluruh uji. Perkiraan tambahan: 2 sampai 3 jam.

## 2. Konten (setengah sampai 1 hari)

Teks toko dipisah dari komponen:

| Berkas | Isi |
| --- | --- |
| `src/lib/content/bantuan.ts` | Delapan halaman bantuan: cara belanja, cek ongkir, FAQ, hubungi, kebijakan, dan lainnya. |
| `src/lib/content/return-policy.ts` | Kebijakan retur. |
| `src/lib/content/toko.ts` | Teks halaman Toko kami. |
| `src/lib/content/notifikasi.ts` | Templat notifikasi WA dan email (pesanan dibuat, dibayar, dikirim, stok kembali, dan lainnya). |
| `src/lib/content/demo.ts` | Teks halaman Tentang demo dan panduan demo. Tidak dipakai di luar mode demo. |
| `src/lib/content/visual.ts` | Contoh packshot untuk lingkaran kategori, MegaMenu, dan hero beranda. |
| `src/db/seed/content.ts` | Artikel jurnal. |
| `docs/panduan-admin/` | Panduan admin yang dibaca Asisten Admin. Sesuaikan bila alur toko klien berbeda. |

Gaya bahasa: sapaan "kamu", hangat dan singkat, tanpa em-dash. Panduan gaya bahasa yang dipakai semua tulisan AI (deskripsi, balasan ulasan, Kabar Harian) diatur Owner di Admin, Pengaturan. Nilai bawaannya ada di `src/lib/settings/index.ts` (`DEFAULT_STYLE`).

## 3. Sakelar fitur (15 menit)

`src/config/fitur.ts`, objek `FITUR`:

| Fitur | Bila dimatikan |
| --- | --- |
| `aiPembeli` | Advisor, tafsiran pencarian, ringkasan ulasan AI, dan saran rutinitas AI hilang. Kuis kulit dan pencarian biasa tetap ada. Ikut mematikan `aiFotoLink`. |
| `aiFotoLink` | Bantuan foto di kuis dan cari dari video hilang. |
| `asistenAdmin` | Asisten Admin, penulis deskripsi, draf balasan ulasan, dan narasi AI Kabar Harian hilang. Kabar Harian tetap dengan narasi templat. |
| `flashSale` | Menu, blok beranda, tab promo admin, dan harga flash di server mati. |
| `poin` | Halaman poin, penukaran di checkout, dan bonus ulasan mati. |
| `ambilDiToko` | Metode Ambil di Toko ditolak server dan hilang dari checkout. |
| `multiCabang` | Stok per cabang, transfer stok, dan halaman Toko kami hilang. Ikut mematikan `ambilDiToko`. |

Untuk mencoba tanpa mengubah berkas: `NEXT_PUBLIC_FITUR_NONAKTIF=flashSale,poin npm run build`. Uji `src/config/fitur-mati.test.ts` memastikan semua fitur bisa dimatikan bersamaan.

## 4. Data awal toko (setengah hari, sekali saja)

Seed saat ini adalah data demo lengkap: 12 merek fiktif, 79 produk, riwayat 90 hari, pembeli demo, dan ulasan. Untuk toko sungguhan:

1. Buat seed minimal (sekali, bisa dipakai klien berikutnya): kategori, lokasi, pengaturan toko, dan satu akun Owner. Ambil bagian yang dibutuhkan dari `src/db/seed/all.ts`, tanpa produk, riwayat, ulasan, dan pembeli demo.
2. Ganti `src/db/seed/categories.ts` dengan struktur kategori klien (dua tingkat). Slug sub kategori dipakai di CSV impor.
3. Ganti `src/db/seed/locations.ts` dengan gudang online dan cabang klien. Slug lokasi dipakai di kolom stok CSV (`stok_<slug lokasi>`).
4. Set `DEMO_MODE=false` di produksi. Ini mematikan tombol simulasi bayar, OTP di layar, akun demo, pita demo, dan reset harian.

## 5. Impor katalog (setengah sampai 1 hari)

1. Kirim `docs/templat-katalog.csv` ke klien. Satu baris = satu varian. Baris dengan nama produk (atau `slug_produk`) yang sama digabung menjadi satu produk.
2. Kolom wajib: `merek`, `kategori` (slug sub kategori), `produk`, `kemasan`, `shade`, `hex`, `sku`, `harga_normal`, `harga_jual`, `berat_gram`. Opsional: deskripsi singkat, bahan aktif, jenis dan masalah kulit, finish, SPF, netto, BPOM, status, dan `stok_<slug lokasi>`.
3. Periksa tanpa menulis:

   ```bash
   npm run impor:katalog -- --berkas=katalog-klien.csv --kering
   ```

   Hasilnya daftar baris yang gagal beserta alasannya (misal "hex harus kode warna 6 digit", "SKU sudah dipakai di baris 12"). Kirim balik ke klien atau perbaiki bersama.
4. Tulis ke database:

   ```bash
   npm run impor:katalog -- --berkas=katalog-klien.csv --buat-merek
   ```

   Produk dibuat lewat aturan yang sama dengan formulir admin. Stok awal masuk lewat modul inventory, jadi tercatat di riwayat stok dan log aktivitas. Produk yang slug-nya sudah ada dilewati, jadi aman dijalankan ulang.
5. Produk baru berstatus draf kecuali kolom `status` diisi `aktif`. Periksa di admin, lalu aktifkan.
6. Foto produk diunggah dari admin. Tanpa foto, produk memakai gambar ilustrasi `ProductArt`.

## 6. Cabang dan jam buka (1 jam)

Admin, Pengaturan, Cabang: alamat, telepon, titik peta, jam buka per hari, tanggal libur, dan apakah bisa Ambil di Toko. Jam buka dipakai untuk label "Siap diambil hari ini" dan batas kirim hari ini.

## 7. Kurir, tarif, dan zona (2 sampai 4 jam)

- Admin, Pengaturan, Kurir: kurir aktif dan tarif per zona, gratis ongkir, batas jam kirim, dan jam pengiriman instan.
- Zona dihitung dari kota tujuan relatif ke kota asal di `src/lib/regions.ts` (`dalam_kota`, `jatim`, `jawa`, `luar_jawa`). Untuk kota asal lain, ubah konstanta kota dan provinsi asal, lalu sesuaikan nama zona bila perlu.
- Data kecamatan baru lengkap untuk Jawa Timur (`src/data`). Lengkapi bila klien banyak mengirim ke provinsi lain.
- Bila klien ingin tarif otomatis dari agregator kurir, buat adapter yang mengisi pilihan kurir di `src/lib/checkout/actions.ts` (`quoteCheckoutAction`). Ongkir tetap dihitung di server.

## 8. Staf dan peran (1 jam)

Admin, Staf: buat akun untuk setiap staf dengan peran dan lokasi. Templat izin per peran ada di `src/lib/admin/permissions.ts`. Owner bisa menambah atau mencabut izin per orang.

## 9. Email transaksi (1 jam, plus propagasi DNS)

Daftarkan domain pengirim di Resend, tambahkan catatan DNS yang diminta, lalu isi `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, dan `EMAIL_FROM` di Vercel. Kosongkan `EMAIL_ALLOWLIST` di luar mode demo.

## 10. Payment gateway sungguhan (2 sampai 3 hari)

Yang sudah ada:

- `confirmPayment` di `src/lib/orders/service.ts`: satu pintu konfirmasi pembayaran yang idempoten, memeriksa nominal dan kedaluwarsa, lalu mengubah status dan memotong stok.
- Route webhook `/api/pembayaran/webhook` dengan tanda tangan HMAC dan perbandingan waktu-konstan.

Yang perlu dibuat:

1. Adapter gateway, misal `src/lib/pembayaran/midtrans.ts`, dengan dua fungsi: membuat tagihan saat pesanan dibuat (mengembalikan QRIS, nomor virtual account, atau tautan bayar), dan memverifikasi tanda tangan notifikasi gateway.
2. Panggil pembuatan tagihan setelah `placeOrder` berhasil, simpan referensi gateway di tabel `payments`.
3. Ubah halaman `/bayar/[nomor]` untuk menampilkan data dari gateway, bukan kode QRIS demo.
4. Ubah route webhook: verifikasi dengan cara gateway, petakan status gateway ke `confirmPayment` (lunas) atau pembatalan (gagal atau kedaluwarsa).
5. Uji di sandbox gateway: lunas, gagal, kedaluwarsa, notifikasi ganda, nominal tidak cocok.

## 11. WhatsApp Business resmi (1 sampai 2 hari, plus waktu Meta)

- OTP: implementasikan `OtpSender` di `src/lib/auth/otp.ts`.
- Notifikasi pesanan: implementasikan `WhatsAppSender` di `src/lib/email/whatsapp.ts` dengan templat yang disetujui Meta.
- Asisten Admin lewat WA (opsional): `src/lib/asisten/pintu/wa.ts` sudah menerjemahkan pesan masuk ke otak asisten yang sama. Yang belum ada: pemetaan nomor WA ke akun staf dan sambungan ke penyedia.
- Aturan: hanya templat resmi untuk pesan keluar, tidak ada siaran massal, dan kegagalan kirim tidak memblokir pesanan.

## 12. Domain dan deploy (2 sampai 4 jam)

Ikuti docs/DEPLOY.md. Ringkasnya:

1. Proyek Neon baru (region Singapura) dan proyek Vercel baru (region `sin1`).
2. Isi semua env dari `.env.example`. Rahasia baru untuk setiap klien, jangan menyalin dari Rona.
3. Push. Build produksi menjalankan migrasi. Jalankan seed minimal sekali, lalu impor katalog ke database produksi.
4. Hubungkan domain klien di Vercel, isi `NEXT_PUBLIC_SITE_URL` dengan domain itu, redeploy.
5. Untuk toko sungguhan, hapus `X-Robots-Tag: noindex` di `next.config.ts` dan ubah `src/app/robots.ts` supaya situs bisa diindeks.
6. Perbarui `/.well-known/security.txt` (email dari `MEREK.kontak.email`).
7. Verifikasi: `npm run uji:produksi -- --url=https://domain-klien`, lalu cek manual alur beli sampai bayar di sandbox gateway.

## 13. Serah terima

- Lengkapi bagian "Untuk toko sungguhan" di docs/KEAMANAN.md: cadangan Neon, kebijakan privasi, dua faktor staf.
- Pasang pemantau uptime ke `/api/sehat` dan isi `SENTRY_DSN`.
- Latih Owner memakai Pengaturan, Stok, Pesanan, dan Laporan. Panduan admin ada di `docs/panduan-admin`, dan Asisten Admin menjawab dari panduan itu.
