# Deploy Rona Beauty (Vercel + Neon)

Panduan untuk menaruh demo ini online: aplikasi di Vercel (region Singapura, `sin1`) dan database PostgreSQL di Neon (region Singapura). Semua data toko fiktif, dan situs sudah diatur noindex.

## 1. Environment variable

Isi di Vercel (Settings, Environment Variables) untuk Production dan Preview. Untuk lokal, salin `.env.example` ke `.env.local`.

| Nama | Wajib? | Contoh aman | Dipakai di |
| --- | --- | --- | --- |
| `DATABASE_URL` | Wajib | `postgresql://neondb_owner:***@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Aplikasi, proxy, dan build. Pakai connection string **pooled** (host berakhiran `-pooler`). |
| `DATABASE_URL_UNPOOLED` | Opsional, disarankan | `postgresql://neondb_owner:***@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Skrip `db:deploy`, `db:reset`, `db:seed`, dan drizzle-kit. Koneksi **direct**. Bila kosong, skrip memakai `DATABASE_URL`. |
| `DEMO_MODE` | Wajib untuk demo | `true` | Tombol simulasi bayar dan simulasi staf, slot flash sale otomatis, pita demo. |
| `CRON_SECRET` | Wajib di produksi | string acak 32 karakter atau lebih | Route `/api/cron/kedaluwarsa`. Vercel Cron mengirimnya otomatis sebagai `Authorization: Bearer <CRON_SECRET>`. |
| `NEXT_PUBLIC_SITE_URL` | Disarankan | `https://rona-demo.vercel.app` | Tautan absolut di notifikasi, JSON-LD, gambar OG. Bila kosong, dipakai domain produksi Vercel otomatis. |
| `STUDIO_NAME` | Opsional | `Ciptalogy` | Kredit "Dibangun oleh" di footer dan Tentang Demo. |
| `STUDIO_URL` | Opsional | `https://contoh-studio.id` | Tautan kredit pembuat. |
| `PAYMENT_WEBHOOK_SECRET` | Opsional | string acak 32 karakter atau lebih | Route `/api/pembayaran/webhook` (HMAC). Tanpa ini route menjawab 503; tombol simulasi demo tetap jalan. |
| `SESSION_SECRET` | Wajib di produksi | string acak 32 karakter atau lebih (`openssl rand -base64 36`) | Kunci HMAC untuk kode OTP dan alamat IP di rate limit masuk (Fase 5). Tanpa ini di Vercel, halaman `/masuk` menampilkan "Masuk belum tersedia". Mengganti nilainya membuat kode OTP yang sedang berjalan tidak berlaku (sesi yang sudah masuk tetap aman). |
| `BLOB_READ_WRITE_TOKEN` | Opsional | otomatis dari Vercel Blob | Penyimpanan foto ulasan (Fase 5). Tanpa token di Vercel, unggah foto dinonaktifkan dengan pesan ramah dan ulasan teks tetap bisa dikirim. Di lokal foto disimpan di `.data/uploads`. |
| `DEMO_STAFF_PASSWORD` | Opsional | kata sandi demo pilihanmu | Kata sandi akun staf demo saat seed (bawaan `demo1234`). Dipakai panel admin Fase 6. |
| `ALLOW_CLOCK_OVERRIDE` | Jangan diisi di produksi | kosong | Hanya uji Playwright lokal: membuka `/api/demo/jam` untuk memajukan jam server. |
| `CONFIRM_RESET` | Hanya saat reset | `rona-demo` | Konfirmasi wajib untuk `db:reset` atau `db:seed` ke host selain localhost. Jangan disimpan di Vercel. |

Fase 7 akan menambah `AI_GATEWAY_URL`, `GEMINI_API_KEY`, dan `AI_MODEL`.

Cara mendapatkan `BLOB_READ_WRITE_TOKEN`: di dashboard Vercel buka **Storage, Create Database, Blob**, beri nama misal `rona-ulasan`, lalu **Connect** ke project `rona-demo` untuk Production dan Preview. Vercel menambahkan variabelnya otomatis; redeploy supaya terbaca.

## 2. Membuat database Neon

1. Masuk ke console.neon.tech, buat project baru bernama `rona-demo`.
2. Pilih region **AWS Asia Pacific (Singapore)**, versi PostgreSQL 16 atau lebih baru.
3. Di dashboard project, buka **Connect**. Neon memberi dua jenis connection string:
   - **Pooled**: hostname mengandung `-pooler`. Lewat PgBouncer mode transaction, tahan banyak koneksi singkat dari fungsi serverless. Pakai untuk `DATABASE_URL`. Aplikasi sudah mematikan prepared statement supaya cocok dengan pooler.
   - **Direct**: hostname tanpa `-pooler`. Koneksi langsung ke Postgres, cocok untuk migrasi dan perintah DDL yang panjang. Pakai untuk `DATABASE_URL_UNPOOLED`.
4. Pastikan keduanya diakhiri `?sslmode=require`.

Ekstensi `pg_trgm` (untuk pencarian tahan salah ketik) dibuat otomatis oleh migrasi.

## 3. Migrasi dan seed ke database produksi

Jalankan dari laptop, di folder proyek. Isi **kedua** variabel di baris perintah; nilai di terminal mengalahkan `.env.local`, jadi database lokal tidak tersentuh.

Pertama kali (database kosong): migrasi lalu isi data demo.

```bash
export DATABASE_URL="<connection string pooled>"
export DATABASE_URL_UNPOOLED="<connection string direct>"
CONFIRM_RESET=rona-demo npm run db:reset
```

`db:reset` menghapus seluruh skema, menjalankan migrasi, lalu seed. Ke host selain localhost perintah ini ditolak tanpa `CONFIRM_RESET=rona-demo`.

Setiap ada migrasi baru (setelah fase berikutnya), cukup:

```bash
DATABASE_URL="<pooled>" DATABASE_URL_UNPOOLED="<direct>" npm run db:deploy
```

`db:deploy` hanya menjalankan migrasi, tidak menyentuh data. Untuk mengulang data demo dari nol (misal sebelum presentasi), jalankan lagi perintah `db:reset` di atas.

Jalankan migrasi **sebelum** deploy aplikasi yang membutuhkannya, karena build membaca database (lihat bagian 5).

## 4. Deploy ke Vercel

1. Dorong repo ke GitHub (privat tidak masalah).
2. Di vercel.com, **Add New, Project**, impor repo `rona-demo`. Framework terdeteksi Next.js; biarkan perintah build dan output bawaan.
3. Isi environment variable dari tabel di atas sebelum klik Deploy.
4. Region fungsi diatur oleh `vercel.json` ke `sin1` (Singapura), dekat dengan Neon. Cek di Settings, Functions bahwa region tertulis Singapore.
5. Cron harian ikut terpasang dari `vercel.json`: `/api/cron/kedaluwarsa` pukul 20.00 UTC (03.00 WIB). Route ini membatalkan pesanan tak dibayar yang lewat batas waktu dan (sejak Fase 5) menandai Selesai pesanan yang sudah 3 hari berstatus Dikirim. Paket gratis Vercel membatasi cron sekali sehari, karena itu keduanya juga dicek saat halaman bayar atau pesanan dibuka.

## Pembaruan ke Fase 5 (akun pembeli, poin, ulasan)

Migrasi baru: `drizzle/0002_akun.sql`. Isinya hanya menambah: tabel `otp_codes` dan `sessions`, kolom `read_at` di `notifications`, `idempotency_key` di `points_ledger`, kode wilayah di `addresses`, plus indeks (termasuk indeks unik `reviews_order_item_idx` dan `points_ledger_idempotency_idx`). Semua kolom baru boleh null, jadi aman dijalankan selagi versi Fase 4 masih tayang: versi lama tidak membaca kolom dan tabel baru.

Urutan yang disarankan:

1. **Env di Vercel**: tambahkan `SESSION_SECRET` (Production dan Preview). Opsional: sambungkan Vercel Blob untuk `BLOB_READ_WRITE_TOKEN`.
2. **Database Neon**, pilih salah satu:
   - Disarankan, data demo dibuat ulang termasuk akun Pembeli Demo lengkap (alamat, 5 pesanan, poin, wishlist, notifikasi). Semua pesanan lama di Neon hilang, dan selama sekitar setengah menit reset berjalan versi lama bisa menampilkan error:

     ```bash
     DATABASE_URL="<pooled>" DATABASE_URL_UNPOOLED="<direct>" CONFIRM_RESET=rona-demo npm run db:reset
     ```

   - Tanpa menghapus data: hanya migrasi. Akun Pembeli Demo belum ada, sehingga tombol "Masuk sebagai Pembeli Demo" menjawab "Akun demo belum disiapkan" sampai seed dijalankan.

     ```bash
     DATABASE_URL="<pooled>" DATABASE_URL_UNPOOLED="<direct>" npm run db:deploy
     ```

3. **Push** ke `main` supaya Vercel membangun versi Fase 5. Build membaca database, jadi langkah 2 harus selesai lebih dulu.
4. Verifikasi:
   - `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<domain-mu>/akun` menjawab `307` ke `/masuk?kembali=%2Fakun`.
   - Buka `/masuk`, minta kode untuk nomor apa pun: kode OTP demo tampil di layar.
   - Buka `/tentang-demo`, tekan "Masuk sebagai Pembeli Demo", lalu cek `/akun`, `/akun/pesanan`, dan `/akun/notifikasi`.
   - Pada pesanan Dikirim milik Pembeli Demo, tekan "Pesanan diterima", lalu tulis ulasan. Bila Blob belum disambungkan, kotak foto menampilkan pesan bahwa unggah foto belum tersedia.

## 5. Bagian build yang butuh database

`npm run build` membaca database untuk memprarender data katalog yang di-cache. Build gagal bila `DATABASE_URL` tidak bisa dihubungi. Yang dibaca saat build:

- `generateStaticParams` halaman produk: daftar slug produk aktif, lalu detail produk dan varian untuk tiap slug.
- Layout utama di semua halaman: pohon kategori (MegaMenu, footer), daftar cabang, dan pesan PromoBar dari tabel settings.
- Beranda dan `/merek`: daftar merek, jumlah produk per merek, produk terlaris per merek.
- Beranda dan `/jurnal`: daftar artikel.

Stok, harga efektif, flash sale, keranjang, dan pesanan tidak dibaca saat build; semuanya dibaca saat request.

## 6. Verifikasi setelah deploy

1. Buka halaman utama, pastikan kategori di MegaMenu, flash sale, dan produk tampil.
2. Buka satu halaman produk, misal `/p/pualam-velvet-matte-cushion-spf-50`, ganti shade dan cek stok per cabang.
3. Coba alur beli dari HP: tambah 2 produk, checkout ke Kota Malang, bayar QRIS, tekan "Simulasikan pembayaran berhasil", buka halaman pesanan.
4. Cek status 404 sungguhan untuk produk yang tidak ada:

   ```bash
   CUPLIK_URL=https://<domain-mu> npm run cek:404
   ```

5. Cek noindex dan header keamanan:

   ```bash
   curl -s https://<domain-mu>/robots.txt
   curl -sI https://<domain-mu>/ | grep -i -E "x-robots-tag|x-frame-options|x-content-type-options|referrer-policy|permissions-policy"
   ```

6. Uji route cron dengan rahasianya (harus menjawab `{"ok":true,...}`), dan tanpa rahasia (harus 401):

   ```bash
   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain-mu>/api/cron/kedaluwarsa
   curl -s -o /dev/null -w "%{http_code}\n" https://<domain-mu>/api/cron/kedaluwarsa
   ```

## Bila ada masalah

- **Build gagal dengan `ENOTFOUND` atau timeout database**: `DATABASE_URL` di Vercel salah atau database Neon sedang tidur lama; buka console Neon untuk membangunkan, lalu redeploy.
- **Error relasi atau kolom tidak ada**: migrasi belum dijalankan ke Neon. Jalankan `db:deploy` lalu redeploy.
- **Tombol simulasi tidak muncul**: `DEMO_MODE` belum `true` di Vercel.
- **Halaman masuk menampilkan "Masuk belum tersedia"**: `SESSION_SECRET` belum diisi (atau kurang dari 16 karakter) atau `DEMO_MODE` bukan `true`. Adapter WhatsApp sungguhan belum ada, jadi di luar mode demo masuk memang dinonaktifkan.
- **"Akun demo belum disiapkan"**: Neon hanya dimigrasi tanpa seed. Jalankan `db:reset` seperti di bagian Pembaruan ke Fase 5.
