# Deploy Rona Beauty (Vercel + Neon)

Panduan untuk menaruh demo ini online: aplikasi di Vercel (region Singapura, `sin1`) dan database PostgreSQL di Neon (region Singapura). Semua data toko fiktif, dan situs sudah diatur noindex.

## Alur normal: cukup push (sejak Fase 6B)

1. Bila fase baru menambah env, isi dulu di Vercel (lihat tabel di bagian 1 dan bagian Pembaruan per fase).
2. `git push` ke `main`. Build produksi Vercel menjalankan migrasi database sendiri sebelum `next build`.
3. Bila seed berubah, Dashboard Owner menampilkan "Data demo versi baru tersedia, reset sekarang?". Tekan "Reset data demo sekarang", atau tunggu reset harian 03.00 WIB.

Detail migrasi otomatis:

- Hanya berjalan bila `VERCEL_ENV=production`. Build preview dan build lokal melewatinya (preview memakai database yang sama dengan produksi).
- Memakai `DATABASE_URL_UNPOOLED` bila ada, selain itu `DATABASE_URL`.
- Dijalankan dengan advisory lock Postgres, jadi dua build bersamaan tidak memigrasi berbarengan.
- Log build mencatat migrasi yang akan dan sudah dijalankan, misal `Migrasi selesai: 0004_katalog_promo`.
- Bila migrasi gagal, build gagal dan versi lama tetap tayang.
- Darurat, misal Neon sedang bermasalah dan kamu hanya mengubah teks: isi `SKIP_BUILD_MIGRATION=true` di Vercel, lalu hapus lagi setelahnya.

Cara manual dari laptop (bagian 3) tetap ada sebagai cadangan darurat.

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
| `SESSION_SECRET` | Wajib di produksi | string acak 32 karakter atau lebih (`openssl rand -base64 36`) | Kunci HMAC untuk kode OTP dan alamat IP di rate limit masuk pembeli (Fase 5) dan staf (Fase 6A). Tanpa ini masuk staf dengan kata sandi juga ditolak. Tanpa ini di Vercel, halaman `/masuk` menampilkan "Masuk belum tersedia". Mengganti nilainya membuat kode OTP yang sedang berjalan tidak berlaku (sesi yang sudah masuk tetap aman). |
| `BLOB_READ_WRITE_TOKEN` | Opsional | otomatis dari Vercel Blob | Penyimpanan foto ulasan (Fase 5). Tanpa token di Vercel, unggah foto dinonaktifkan dengan pesan ramah dan ulasan teks tetap bisa dikirim. Di lokal foto disimpan di `.data/uploads`. |
| `DEMO_STAFF_PASSWORD` | Disarankan | kata sandi demo pilihanmu, minimal 10 karakter | Kata sandi empat akun staf demo (`owner@`, `admin@`, `dinoyo@`, `gudang@rona.demo`) saat seed dan reset harian. Bawaan `demo1234`. Di mode demo pengunjung masuk lewat tombol masuk cepat, jadi kata sandi ini hanya untuk masuk manual. |
| `DEMO_DAILY_RESET` | Opsional | `true` | Reset data demo tiap malam pukul 03.00 WIB lewat cron harian. Hanya berjalan bila `DEMO_MODE=true` juga. Kosongkan untuk mematikan. |
| `ALLOW_CLOCK_OVERRIDE` | Jangan diisi di produksi | kosong | Hanya uji Playwright lokal: membuka `/api/demo/jam` untuk memajukan jam server. |
| `EMAIL_PROVIDER` | Opsional | `preview` (bawaan) atau `resend` | Adapter email (Fase 6C). `preview` tidak mengirim apa pun; email tetap Menunggu dan terlihat di Kotak Notifikasi serta Notifikasi keluar. |
| `RESEND_API_KEY` | Hanya bila `resend` | `re_***` dari dashboard Resend | Dipanggil lewat REST API (fetch, tanpa SDK) dengan header Idempotency-Key per notifikasi. |
| `EMAIL_FROM` | Hanya bila `resend` | `Rona Beauty <halo@domain-terverifikasi.id>` | Alamat pengirim; domainnya wajib terverifikasi di Resend. |
| `EMAIL_ALLOWLIST` | Disarankan saat `DEMO_MODE=true` | `kamu@contoh.com,tim@contoh.com` | Mode demo: email sungguhan hanya ke alamat ini, alamat lain ditandai Dilewati supaya situs demo tidak dipakai untuk spam. Kosong berarti semua dilewati. |
| `AI_GATEWAY_URL` | Opsional | `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/google-ai-studio` | Fitur AI pembeli (Fase 7A). Kosong berarti fitur AI tersembunyi; fitur berbasis aturan tetap jalan. |
| `GEMINI_API_KEY` | Bersama `AI_GATEWAY_URL` | kunci dari Google AI Studio | Dikirim sebagai header `x-goog-api-key` lewat gateway. |
| `AI_MODEL` | Opsional | `gemini-3.5-flash` (bawaan) | Model Gemini. |
| `CF_AIG_TOKEN` | Wajib bila gateway terautentikasi | token dari pengaturan gateway | Header `cf-aig-authorization: Bearer <token>`. Tanpa ini gateway terautentikasi menjawab 401. |
| `AI_DAILY_CAP` | Disarankan | `1000` | Batas panggilan AI per hari WIB (semua fitur). Bila tercapai, AI tampil "sedang istirahat". |
| `AI_PROVIDER` | Jangan diisi di produksi | kosong | `mock` hanya untuk uji, Playwright, dan cuplik. |
| `SKIP_BUILD_MIGRATION` | Jangan diisi, kecuali darurat | kosong | Isi `true` untuk melewati migrasi otomatis di build produksi (Fase 6B). |
| `CONFIRM_RESET` | Hanya saat reset | `rona-demo` | Konfirmasi wajib untuk `db:reset` atau `db:seed` ke host selain localhost. Jangan disimpan di Vercel. |

Variabel AI (Fase 7A) dijelaskan di bagian Pembaruan ke Fase 7A.

Cara mendapatkan `BLOB_READ_WRITE_TOKEN`: di dashboard Vercel buka **Storage, Create Database, Blob**, beri nama misal `rona-ulasan`, lalu **Connect** ke project `rona-demo` untuk Production dan Preview. Vercel menambahkan variabelnya otomatis; redeploy supaya terbaca.

## 2. Membuat database Neon

1. Masuk ke console.neon.tech, buat project baru bernama `rona-demo`.
2. Pilih region **AWS Asia Pacific (Singapore)**, versi PostgreSQL 16 atau lebih baru.
3. Di dashboard project, buka **Connect**. Neon memberi dua jenis connection string:
   - **Pooled**: hostname mengandung `-pooler`. Lewat PgBouncer mode transaction, tahan banyak koneksi singkat dari fungsi serverless. Pakai untuk `DATABASE_URL`. Aplikasi sudah mematikan prepared statement supaya cocok dengan pooler.
   - **Direct**: hostname tanpa `-pooler`. Koneksi langsung ke Postgres, cocok untuk migrasi dan perintah DDL yang panjang. Pakai untuk `DATABASE_URL_UNPOOLED`.
4. Pastikan keduanya diakhiri `?sslmode=require`.

Ekstensi `pg_trgm` (untuk pencarian tahan salah ketik) dibuat otomatis oleh migrasi.

## 3. Migrasi dan seed ke database produksi (manual, cadangan darurat)

Sejak Fase 6B migrasi berjalan otomatis saat build produksi. Langkah di bagian ini hanya untuk database Neon yang masih kosong, atau bila build otomatis tidak bisa dipakai.

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

Bila migrasi dijalankan manual, lakukan **sebelum** deploy aplikasi yang membutuhkannya, karena build membaca database (lihat bagian 5).

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

## Pembaruan ke Fase 6A (panel admin inti)

Migrasi baru: `drizzle/0003_admin.sql`. Isinya menambah tabel `staff_sessions`, `staff_locations`, dan `staff_login_attempts`, kolom `actor_name`, `summary`, `location_id` di `audit_logs` (semua boleh kosong atau punya nilai bawaan), indeks baru, dan satu langkah data: lokasi staf cabang lama disalin ke `staff_locations`. Tidak ada kolom yang dihapus atau diubah, jadi aman dijalankan selagi versi Fase 5 masih tayang.

Urutan yang disarankan:

1. **Env di Vercel** (Production dan Preview):
   - `DEMO_STAFF_PASSWORD`: kata sandi akun staf demo, minimal 10 karakter.
   - `DEMO_DAILY_RESET=true` bila ingin data demo bersih lagi tiap malam.
   - Pastikan `SESSION_SECRET`, `CRON_SECRET`, dan `DEMO_MODE=true` sudah ada dari fase sebelumnya.
2. **Database Neon**: reset supaya akun staf demo yang baru (termasuk `gudang@rona.demo`), lokasi staf, dan hash kata sandi baru tersedia:

   ```bash
   DATABASE_URL="<pooled>" DATABASE_URL_UNPOOLED="<direct>" DEMO_STAFF_PASSWORD="<sama dengan di Vercel>" CONFIRM_RESET=rona-demo npm run db:reset
   ```

   Bila hanya `db:deploy`, data lama tetap ada tapi akun `gudang@rona.demo` belum ada; tombol masuk cepat Gudang akan menjawab "Akun demo belum disiapkan" sampai reset berikutnya (manual atau harian).
3. **Push** ke `main`.
4. Verifikasi:
   - `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<domain-mu>/admin` menjawab `307` ke `/admin/masuk?kembali=%2Fadmin`.
   - Buka `/admin/masuk`, tekan "Owner", cek Dashboard, Pesanan, Stok, Staf dan izin, dan Log aktivitas.
   - Panggil cron sekali secara manual dan lihat bagian `reset` pada jawabannya:

     ```bash
     curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain-mu>/api/cron/kedaluwarsa
     ```

### Reset harian demo

Cron harian (`vercel.json`, 20.00 UTC atau 03.00 WIB) menjalankan berurutan: batalkan pesanan kedaluwarsa, tandai Selesai pesanan yang 3 hari Dikirim, lalu reset data demo bila `DEMO_MODE=true` dan `DEMO_DAILY_RESET=true`. Reset tidak menjalankan migrasi: semua tabel data dikosongkan dalam satu transaksi lalu diisi ulang dengan seed yang sama, jadi pengunjung tidak pernah melihat database kosong. Foto ulasan di Vercel Blob (prefix `ulasan/`) ikut dihapus. Route cron diberi `maxDuration = 60` detik.

Owner juga punya tombol "Reset data demo sekarang" di Dashboard (hanya saat `DEMO_MODE=true`, paling sering sekali per 5 menit). Semua sesi pembeli dan staf ikut keluar setelah reset.

Mengukur durasi reset terhadap database Neon (data di database itu akan diganti):

```bash
DATABASE_URL="<pooled>" DEMO_MODE=true CONFIRM_RESET=rona-demo npm run demo:ukur-reset
```

Hasil di laptop: sekitar 0,8 detik ke Postgres lokal dan sekitar 3 detik dengan latensi tiruan 1 ms per arah (410 kueri). Dari Vercel `sin1` ke Neon Singapura latensinya sejenis, jadi masih jauh di bawah batas 60 detik.

Sejak Fase 6B reset juga mengisi riwayat penjualan 90 hari (sekitar 1.300 pesanan dari 150 pelanggan) dengan sisipan massal: 445 kueri, sekitar 2 detik lokal, 4,4 detik dengan latensi tiruan 1 ms per arah, 22 detik dengan 10 ms per arah.

## Pembaruan ke Fase 6B (katalog, promo, pengaturan, data riwayat)

Migrasi baru: `drizzle/0004_katalog_promo.sql`. Isinya hanya menambah kolom: `locations.closed_dates` (bawaan daftar kosong), `products.image_url` (boleh kosong), `flash_sales.source` (bawaan `otomatis`), `banners.art` (boleh kosong), dan `banners.cta_label` (bawaan teks kosong). Tidak ada kolom yang dihapus atau diubah. Versi Fase 6A yang masih tayang tidak membaca kolom baru, dan baris yang ia tulis mendapat nilai bawaan, jadi aman.

Ini fase pertama dengan migrasi otomatis, tapi skrip migrasinya ikut di deploy ini. Urutan persis:

1. **Env di Vercel**: tidak ada env wajib baru. Jangan isi `SKIP_BUILD_MIGRATION`. Pastikan `DATABASE_URL_UNPOOLED` ada di environment Production (disarankan untuk migrasi).
2. **Push** ke `main`. Di log build Vercel harus muncul `Migrasi produksi memakai DATABASE_URL_UNPOOLED.` lalu `Migrasi selesai: 0004_katalog_promo`. Bila migrasi gagal, build gagal dan versi 6A tetap tayang.
3. **Reset data demo** supaya riwayat 90 hari, banner ProductArt, dan pengaturan baru terisi: buka `/admin`, masuk sebagai Owner, tekan "Reset data demo sekarang" (Dashboard juga menampilkan pemberitahuan versi seed baru). Atau tunggu reset harian.
4. Verifikasi:
   - Dashboard Owner berisi grafik dan angka dari riwayat, pemberitahuan versi seed hilang setelah reset.
   - `/admin/produk`, `/admin/kategori`, `/admin/promo`, dan `/admin/pengaturan` terbuka untuk Owner.
   - Beranda menampilkan karusel banner di bawah hero.
   - Simpan satu produk di admin, lalu buka halaman produknya dan satu halaman produk lain: keduanya harus tetap tampil.

Bila build otomatis tidak bisa dipakai, jalankan cara manual di bagian 3 (`db:deploy` lalu push).

## Pembaruan ke Fase 6C (ulasan, pelanggan, laporan, email)

Migrasi baru: `drizzle/0005_ulasan_email.sql`. Isinya hanya menambah:

- nilai enum `dilewati` pada `notification_status` (`ADD VALUE IF NOT EXISTS`, aman diulang),
- kolom `attempts` (bawaan 0), `last_error`, `claimed_at`, `provider_id` di `notifications`,
- kolom `hidden_reason` dan `hidden_at` di `reviews`,
- indeks `notifications_status_idx`.

Tidak ada kolom yang dihapus atau diubah, dan nilai enum baru tidak dipakai di migrasi yang sama, jadi aman dijalankan otomatis saat build selagi versi 6B masih tayang. Versi 6B tidak membaca kolom baru dan tidak pernah menulis status `dilewati`.

Urutan persis:

1. **Env di Vercel** (Production): tidak ada yang wajib. Untuk mengirim email sungguhan, isi `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (domain terverifikasi di Resend), dan `EMAIL_ALLOWLIST` berisi alamatmu sendiri selama `DEMO_MODE=true`. Tanpa itu email tetap mode pratinjau seperti sebelumnya.
2. **Push** ke `main`. Log build harus menampilkan `Migrasi selesai: 0005_ulasan_email`.
3. **Reset data demo** dari Dashboard Owner (pemberitahuan versi seed 7 muncul) supaya ulasan bintang 1 dan 2 contoh tersedia untuk moderasi.
4. Verifikasi:
   - `/admin/laporan`, `/admin/ulasan`, `/admin/pelanggan`, `/admin/notifikasi` terbuka untuk Owner, dan tidak ada lagi menu "Segera".
   - Unduh Excel dari Laporan: file `laporan-rona-YYYYMMDD-YYYYMMDD.xlsx` dengan 10 sheet.
   - Bila Resend aktif: balas ulasan milik akun yang emailnya ada di `EMAIL_ALLOWLIST`, lalu cek status Terkirim di Notifikasi keluar. Panggil cron sekali dan lihat bagian `email` pada jawabannya.

### Email transaksional

Notifikasi kanal email dikirim setelah respons selesai (`after()` dari Next) dari aksi checkout, perubahan status pesanan, stok masuk dan transfer (kabar stok kembali), konfirmasi diterima, simulasi demo, webhook pembayaran, dan balasan ulasan. Cron harian mengirim yang masih menunggu dan mencoba ulang yang gagal, maksimal 3 kali; error permanen dari penyedia (misal alamat tidak valid) langsung berhenti. Setiap baris diklaim dulu sebelum dikirim dan kunci idempoten `rona-notif-<id>` dikirim ke Resend, jadi satu notifikasi tidak terkirim dua kali walau dua proses berjalan bersamaan. Owner bisa menekan "Kirim ulang" di Notifikasi keluar untuk email yang gagal.

### WhatsApp Business Platform (belum diimplementasikan)

Kanal WhatsApp tetap pratinjau di Kotak Notifikasi. Antarmuka `WhatsAppSender` ada di `src/lib/email/whatsapp.ts`. Untuk toko sungguhan dibutuhkan:

1. **Verifikasi bisnis Meta** (Business Manager): dokumen legal usaha, domain situs, dan nama tampilan yang disetujui.
2. **Nomor khusus** untuk WhatsApp Business Platform (Cloud API). Nomor yang sudah dipakai di aplikasi WhatsApp biasa harus dilepas dulu.
3. **Template pesan yang disetujui Meta** (kategori Utility, bahasa Indonesia), satu per notifikasi yang ada:
   - `pesanan_dibuat`: nomor pesanan, total, batas bayar, tautan bayar.
   - `pesanan_dibayar`: nomor pesanan, total.
   - `pesanan_siap_diambil`: nomor pesanan, nama cabang, alamat cabang.
   - `pesanan_dikirim`: nomor pesanan, kurir, nomor resi, tautan lacak.
   - `pesanan_selesai`: nomor pesanan, ajakan menulis ulasan.
   - `pesanan_dibatalkan`: nomor pesanan, alasan.
   - `stok_kembali`: nama produk dan shade, tautan produk.
   - `ulasan_dibalas`: nama produk, potongan balasan, tautan produk.
   - `kode_masuk` (kategori Authentication): kode OTP.
4. **Kebijakan percakapan**: sistem tidak memulai chat duluan ke nomor yang belum pernah berinteraksi atau belum memberi izin (opt-in saat checkout). Ide masuk lewat WA yang dimulai pembeli: pembeli mengirim kode pendek ke nomor toko, toko membalas tautan masuk sekali pakai dalam jendela 24 jam, jadi tidak perlu template OTP berbayar.
5. Env yang nanti dibutuhkan: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET` (verifikasi webhook status kirim).

## Pembaruan ke Fase 7A (AI untuk pembeli)

Migrasi baru: `drizzle/0006_ai_pembeli.sql`. Isinya hanya menambah tabel `ai_logs`, `ai_cache`, dan `review_summaries`, serta kolom `source` (boleh kosong) di `cart_items` dan `order_items`. Aman dijalankan otomatis saat build selagi versi 6C masih tayang: versi lama tidak membaca tabel dan kolom baru. Ketiga tabel AI tidak ikut dikosongkan reset demo.

### Menyiapkan Cloudflare AI Gateway dan kunci Gemini

1. **Kunci Gemini.** Buka aistudio.google.com, menu **Get API key**, buat kunci untuk project Google Cloud milikmu. Simpan sebagai `GEMINI_API_KEY`.
2. **Gateway.** Di dashboard Cloudflare buka **AI, AI Gateway, Create Gateway**, beri nama misal `rona-demo`. Catat *account ID* (di URL dashboard) dan nama gateway.
3. **URL.** Isi `AI_GATEWAY_URL` dengan `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/google-ai-studio`, tanpa garis miring di akhir. Aplikasi menambahkan `/v1beta/models/<model>:generateContent` sendiri.
4. **Autentikasi gateway (disarankan).** Di pengaturan gateway, nyalakan **Authenticated Gateway** dan buat token. Isi `CF_AIG_TOKEN` dengan token itu. Bila Authenticated Gateway menyala tapi `CF_AIG_TOKEN` kosong, setiap panggilan ditolak 401 (kode 2009) dan fitur AI menampilkan pesan gagal yang ramah.
5. **Pengaman biaya di gateway.** Nyalakan **Rate limiting** (misal 60 permintaan per menit) dan **Logging**. Caching gateway boleh dimatikan; aplikasi sudah meng-cache tafsiran pencarian, penjelasan rutinitas, dan ringkasan ulasan di database.
6. **Cek dari laptop** (ganti nilai dalam kurung sudut):

   ```bash
   curl -s "<AI_GATEWAY_URL>/v1beta/models/gemini-3.5-flash:generateContent" \
     -H "x-goog-api-key: <GEMINI_API_KEY>" -H "cf-aig-authorization: Bearer <CF_AIG_TOKEN>" \
     -H "content-type: application/json" \
     -d '{"contents":[{"role":"user","parts":[{"text":"Jawab satu kata: halo"}]}]}'
   ```

   Jawaban berisi `candidates` berarti siap. Lalu jalankan `npm run eval:ai` di laptop dengan env yang sama untuk tabel skor Advisor.

### Urutan memperbarui produksi

1. **Env di Vercel** (Production): `AI_GATEWAY_URL`, `GEMINI_API_KEY`, `CF_AIG_TOKEN` (bila gateway terautentikasi), `AI_MODEL=gemini-3.5-flash`, `AI_DAILY_CAP=1000`. Jangan isi `AI_PROVIDER`.
2. **Push** ke `main`. Log build harus menampilkan `Migrasi selesai: 0006_ai_pembeli`.
3. **Reset data demo** dari Dashboard Owner (seed versi 8: sebaran pelanggan riwayat baru, alamat tersimpan, profil kulit).
4. **Ringkasan ulasan**: panggil cron sekali (`curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain-mu>/api/cron/kedaluwarsa`); lihat bagian `summaries` pada jawabannya. Atau tekan "Perbarui ringkasan" di halaman admin produk. Ringkasan tidak pernah dibuat saat pengunjung membuka halaman.
5. Verifikasi:
   - Tombol "Tanya Rona" muncul di kanan bawah (tidak di /checkout dan /bayar). Tanya "Sunscreen untuk kulit berminyak di bawah 100 ribu": jawaban berisi kartu produk dengan harga yang sama dengan halaman produk.
   - `/cari?q=lipstik yang ga bikin bibir kering buat kondangan` menampilkan "Kami artikan sebagai".
   - `/kuis-kulit`, `/rutinitas`, `/padanan-shade` berjalan.
   - Kosongkan sementara `AI_GATEWAY_URL` di Preview untuk memastikan toko tetap jalan tanpa AI.

### Biaya dan batas pemakaian

Pemakaian tercatat di tabel `ai_logs` (fitur, model, token masuk dan keluar, latensi, berhasil atau gagal, hash pengunjung; isi percakapan tidak disimpan). Batas: 20 pesan Advisor per pengunjung per hari saat DEMO_MODE, 5 per menit, dan `AI_DAILY_CAP` untuk semua fitur. Perkiraan biaya ada di laporan Fase 7A dan BACKLOG.

## 5. Bagian build yang butuh database

`npm run build` (di Vercel produksi didahului migrasi otomatis) membaca database untuk memprarender data katalog yang di-cache. Build gagal bila `DATABASE_URL` tidak bisa dihubungi. Yang dibaca saat build:

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
- **Error relasi atau kolom tidak ada**: migrasi belum dijalankan ke Neon. Cek log build produksi (bagian migrasi); bila dilewati, pastikan `SKIP_BUILD_MIGRATION` kosong lalu redeploy, atau jalankan `db:deploy` manual.
- **Build gagal dengan `MIGRASI GAGAL`**: versi lama tetap tayang. Baca pesan di log build, perbaiki migrasinya, lalu push lagi. Build lain yang berjalan bersamaan menunggu kunci advisory, tidak ikut memigrasi.
- **Tombol simulasi tidak muncul**: `DEMO_MODE` belum `true` di Vercel.
- **Halaman masuk menampilkan "Masuk belum tersedia"**: `SESSION_SECRET` belum diisi (atau kurang dari 16 karakter) atau `DEMO_MODE` bukan `true`. Adapter WhatsApp sungguhan belum ada, jadi di luar mode demo masuk memang dinonaktifkan.
- **"Akun demo belum disiapkan"**: Neon hanya dimigrasi tanpa seed. Jalankan `db:reset` seperti di bagian Pembaruan ke Fase 5 atau 6A.
- **Masuk staf menjawab "Terlalu banyak percobaan gagal"**: 5 kali salah untuk satu email mengunci email itu 15 menit (20 kali gagal per IP juga dikunci). Tunggu, atau pakai tombol masuk cepat di mode demo.
- **Reset harian tidak jalan**: cek `DEMO_MODE=true` dan `DEMO_DAILY_RESET=true` di Vercel, lalu lihat Log aktivitas dengan filter aksi "Reset data demo".
