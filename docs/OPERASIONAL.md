# Operasional

Panduan menjaga Rona tetap hidup setelah tayang: cara tahu situs sehat, membaca log, memulihkan migrasi yang gagal, memulihkan database, memutar rahasia, dan apa yang terjadi saat Gemini atau Neon bermasalah. Langkah deploy ada di docs/DEPLOY.md, kontrol keamanan di docs/KEAMANAN.md.

## Cek cepat: apakah situs sehat?

```bash
curl -s https://<domain-mu>/api/sehat
```

Jawaban sehat (HTTP 200):

```json
{
  "ok": true,
  "db": { "ok": true, "latensiMs": 12 },
  "versi": { "aplikasi": "1.0.0", "commit": "abc123def456" },
  "seed": { "terpasang": 12, "kode": 12 },
  "demo": true,
  "cron": { "terakhirBerhasil": "2026-10-15T20:00:04.000Z", "ok": true, "peringatan": null },
  "dataUji": { "products": 0, "flash_sales": 0, "vouchers": 0 },
  "waktuServer": "2026-10-16T02:11:40.000Z"
}
```

Cara membacanya:

| Kolom | Artinya | Bila janggal |
| --- | --- | --- |
| `ok`, `db.ok` | Database terjangkau. HTTP 503 bila tidak. | Lihat "Neon bermasalah" di bawah. |
| `db.latensiMs` | Waktu `select 1` dari fungsi Vercel. Normalnya di bawah 50 ms. | Ratusan ms pertama kali setelah sepi berarti Neon baru bangun (cold start). |
| `versi.commit` | Commit yang sedang tayang. | Bila bukan commit terbaru, deploy terakhir gagal atau belum dipromosikan. |
| `seed.terpasang` dan `seed.kode` | Versi data demo di database dan di kode. | Bila berbeda, tekan "Reset data demo sekarang" di Dashboard Owner, atau tunggu reset 03.00 WIB. |
| `cron.ok` | Cron harian berhasil dalam 26 jam terakhir. | Lihat "Cron harian" di bawah. |
| `dataUji` | Jumlah produk, slot flash sale, dan voucher bernama uji. Harus 0. | Ada yang menjalankan uji ke database produksi. Jalankan `db:reset` ke produksi (dengan `CONFIRM_RESET=rona-demo`). |

`/api/sehat` aman dipasang di pemantau uptime gratis (misal UptimeRobot atau Better Stack) dengan interval 5 menit. Jawabannya tidak memuat data pribadi atau rahasia.

### Uji asap produksi

Setelah setiap rilis, jalankan uji hanya-baca terhadap situs tayang. Uji ini tidak masuk, tidak membuat pesanan, dan tidak mengubah data:

```bash
npm run uji:produksi -- --url=https://<domain-mu>
```

Yang diperiksa: beranda, halaman produk, pencarian salah ketik, 404 sungguhan, `/api/sehat` (termasuk tanpa data uji), `robots.txt`, header noindex, header keamanan, `security.txt`, dan route cron menolak tanpa rahasia. Masing-masing di ukuran HP dan desktop.

## Membaca log di Vercel

Buka proyek di Vercel, tab **Logs**. Log aplikasi ditulis sebagai satu baris JSON per kejadian, jadi bisa disaring dengan kata kunci `"event"`:

| Event | Kapan |
| --- | --- |
| `pesanan.dibuat` | Pesanan baru (nomor, total, metode kirim, metode bayar, akun atau tamu, jumlah item). |
| `pesanan.dibayar`, `pesanan.dibatalkan`, `pesanan.kedaluwarsa`, dan status lain | Setiap perubahan status (nomor, dari, aktor, alasan). |
| `cron.mulai`, `cron.selesai`, `cron.gagal` | Cron harian, dengan ringkasan langkah dan durasi. |
| `demo.reset` | Reset data demo (pemicu, durasi). |
| `ai.galat` | Panggilan Gemini gagal (fitur, kode galat, latensi). |
| `galat` | Galat server atau klien yang tidak tertangani. |
| `ai.galat` dengan fitur `link_video` | Link video gagal dibaca, dengan tahap dan status HTTP (tanpa URL). |
| `csp.pelanggaran` | Browser memblokir sesuatu karena CSP. Satu dua kali wajar (ekstensi browser); banyak berarti ada sumber baru yang perlu diizinkan. |

Nomor WA dan email selalu disamarkan di log (`08***890`, `n***@contoh.com`). Bila `SENTRY_DSN` diisi, galat juga dikirim ke Sentry dengan penyaringan yang sama.

## Cron harian

Vercel Cron memanggil `/api/cron/kedaluwarsa` pukul 20.00 UTC (03.00 WIB) dengan header `Authorization: Bearer <CRON_SECRET>`. Isinya: membatalkan pesanan yang lewat batas bayar, menyelesaikan pesanan Dikirim yang lewat 3 hari, mengirim antrean email, memperbarui ringkasan ulasan AI, membuat Kabar Harian, membersihkan data batas laju lama, dan (bila `DEMO_DAILY_RESET=true`) mereset data demo.

Dashboard Owner menampilkan peringatan bila cron terakhir gagal, atau tidak ada cron yang berhasil selama lebih dari 26 jam.

Bila peringatan muncul:

1. Buka Vercel, **Settings, Cron Jobs**, lihat riwayat dan status terakhir.
2. Cari `cron.gagal` di Logs untuk pesan galatnya.
3. Jalankan manual:

   ```bash
   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain-mu>/api/cron/kedaluwarsa
   ```

4. Bila jawabannya 401, `CRON_SECRET` di Vercel berbeda dengan yang kamu pakai. Bila 503, `CRON_SECRET` belum diisi.

## Migrasi yang gagal

Migrasi berjalan otomatis di build produksi (lihat docs/DEPLOY.md). Semua migrasi Rona aditif: hanya menambah tabel, kolom, atau indeks, tidak menghapus atau mengganti nama. Jadi versi lama aplikasi tetap jalan di atas skema baru.

Bila build gagal dengan `MIGRASI GAGAL`:

1. **Situs tidak turun.** Vercel tetap menayangkan deploy terakhir yang berhasil.
2. Baca pesan di log build. Penyebab umum: Neon sedang tidur atau menolak koneksi, migrasi bentrok dengan data (misal kolom `not null` baru tanpa nilai bawaan), atau dua migrasi bernomor sama dari cabang berbeda.
3. Semua migrasi yang tertunda dijalankan dalam satu transaksi. Bila satu berkas gagal, seluruh migrasi build itu dibatalkan dan tidak ada yang tercatat di `drizzle.__drizzle_migrations`. Cek dengan:

   ```sql
   select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 5;
   ```

4. Perbaiki berkas migrasinya di repo (jangan mengubah migrasi yang sudah tercatat di produksi; buat migrasi baru bila perlu), lalu push lagi.
5. Darurat, misal hanya perlu mengubah teks sementara migrasi bermasalah: isi `SKIP_BUILD_MIGRATION=true` di Vercel, deploy, lalu hapus lagi. Kode baru yang butuh kolom baru akan galat sampai migrasinya jalan, jadi pakai hanya untuk perubahan yang tidak menyentuh skema.
6. Cadangan manual dari laptop: `npm run db:deploy` dengan `DATABASE_URL_UNPOOLED` produksi (lihat docs/DEPLOY.md bagian 3).

## Memulihkan database (Neon point-in-time restore)

Neon menyimpan riwayat perubahan sehingga database bisa dikembalikan ke waktu tertentu. Paket gratis hanya menyimpan riwayat singkat, hitungan jam sampai sekitar satu hari. Angkanya berubah mengikuti paket, jadi periksa di console Neon (pengaturan proyek, bagian riwayat atau restore window). Untuk toko sungguhan, pakai paket berbayar dengan masa simpan 7 sampai 30 hari.

Cara aman, tanpa menimpa data yang sedang dipakai:

1. Console Neon, proyek Rona, **Branches**, **Create branch**.
2. Pilih data dari titik waktu di masa lalu, isi waktu sebelum kejadian (ingat: console memakai zona waktu browser, data disimpan UTC). Nama menu bisa sedikit berbeda mengikuti versi console Neon.
3. Buka branch baru itu dan periksa datanya dengan SQL Editor. Misal pesanan yang hilang: `select number, status, updated_at from orders where number = 'RONA-2610-000123';`
4. Pilihan pemulihan:
   - **Ambil sebagian data**: salin baris yang dibutuhkan dari branch pemulihan ke branch utama dengan SQL.
   - **Kembalikan semuanya**: di branch utama pilih **Restore**, lalu waktu yang sama. Neon membuat cadangan otomatis dari keadaan sebelum restore, jadi langkah ini bisa dibatalkan.
5. Bila restore penuh, cek `/api/sehat`, lalu jalankan `npm run uji:produksi`.
6. Hapus branch pemulihan setelah selesai (branch menghabiskan kuota penyimpanan).

Untuk demo, cara tercepat setelah data rusak biasanya cukup "Reset data demo sekarang" di Dashboard Owner.

## Memutar rahasia

Putar rahasia bila bocor, bila orang yang memegangnya keluar dari tim, dan untuk toko sungguhan secara terjadwal (misal tiap 6 bulan).

| Rahasia | Cara memutar | Dampak saat diganti |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Console Neon, **Roles**, reset password `neondb_owner`, salin connection string baru ke Vercel, redeploy. | Deploy lama langsung kehilangan akses. Redeploy segera. |
| `SESSION_SECRET` | Buat nilai baru (`openssl rand -base64 36`), isi di Vercel, redeploy. | Kode OTP yang sedang berjalan tidak berlaku. Batas laju per IP mulai dari nol. Sesi pembeli dan staf tetap (token sesi tidak bergantung rahasia ini). |
| `CRON_SECRET` | Nilai baru di Vercel, redeploy. Vercel Cron otomatis memakai nilai baru. | Tidak ada. |
| `PAYMENT_WEBHOOK_SECRET` | Ganti di Vercel dan di dashboard payment gateway pada waktu yang sama. | Webhook di antara dua langkah itu ditolak. Gateway sungguhan akan mencoba ulang. |
| `GEMINI_API_KEY` | Google AI Studio, buat kunci baru, isi di Vercel, redeploy, lalu hapus kunci lama. | Tidak ada bila urutannya benar. |
| `CF_AIG_TOKEN` | Cloudflare, AI Gateway, buat token baru, isi di Vercel, redeploy, cabut token lama. | Sama. |
| `BLOB_READ_WRITE_TOKEN` | Vercel, Storage, Blob, buat token baru, isi env, redeploy, cabut token lama. | Foto yang sudah ada tetap tampil (URL publik). |
| `RESEND_API_KEY` | Resend, API Keys, buat kunci baru, isi env, redeploy, hapus kunci lama. | Email di antrean dikirim ulang oleh cron berikutnya. |
| Kata sandi staf | Owner mengatur ulang di Admin, Staf. | Sesi staf itu tetap sampai keluar. Owner bisa menonaktifkan akun untuk memutus semua sesinya. |

Setelah memutar rahasia karena bocor, jalankan `npm run cek:rahasia` untuk memastikan rahasia lama tidak ada di riwayat git. Bila ada, rahasia itu sudah diputar sehingga tidak berbahaya lagi. Menulis ulang riwayat git hanya bila benar-benar perlu, dan selalu dengan persetujuan pemilik repo.

## Bila Gemini atau AI Gateway bermasalah

Toko tetap jalan tanpa AI. Yang terjadi:

- **Advisor, tafsiran pencarian, foto kuis, cari dupe, Asisten Admin** menampilkan pesan ramah ("sedang istirahat" atau "coba lagi sebentar") dan tombol alternatif. Pencarian kembali ke pencarian kata biasa, kuis kulit dan rutinitas tetap jalan tanpa foto.
- **Ringkasan ulasan** memakai ringkasan terakhir yang tersimpan, atau tidak tampil.
- **Kabar Harian** tetap dibuat dengan narasi templat.
- Setiap galat tercatat sebagai `ai.galat` di log dan terlihat di Laporan, tab **Kesehatan AI** (tingkat galat dan latensi 30 hari).

Langkah:

1. Cek status Google AI (status.cloud.google.com) dan Cloudflare (cloudflarestatus.com).
2. Bila galat 429 (kuota), cek pemakaian di Google AI Studio dan batas di Cloudflare AI Gateway. Turunkan `AI_DAILY_CAP` bila perlu.
3. Bila model dihentikan Google, ganti `AI_MODEL` di Vercel ke model yang masih tersedia, lalu redeploy. Jalankan `npm run eval:ai` dan `npm run eval:asisten` dari laptop dengan model baru sebelum mengganti di produksi.
4. Untuk mematikan AI sementara tanpa deploy kode: kosongkan `GEMINI_API_KEY` di Vercel lalu redeploy. Untuk mematikan fitur tertentu secara permanen, pakai sakelar fitur (docs/RESKIN.md).

## Bila link TikTok gagal dibaca

Gejala: pembeli menempel link TikTok di Tanya Rona atau Cari dari video, lalu ditawari kirim screenshot.

1. Buka Laporan, Kesehatan AI, tabel "Link video yang gagal dibaca, per tahap". Tahap `oembed` dengan status 503 atau 429 berarti endpoint oEmbed TikTok menolak permintaan; server sudah mencoba ulang sampai 6 kali. Tahap `halaman` dengan jenis `ditolak` berarti TikTok membalas tantangan bot karena IP server sedang ditandai.
2. Cek dari server produksi: `curl -s https://<domain-mu>/api/sehat/tiktok`.
3. Diagnosis dari laptop dengan link yang dikirim pembeli: `npm run cek:tiktok -- <link>`. Hasilnya tiap tahap beserta status HTTP dan lamanya.
4. Bila hanya gagal dari Vercel tetapi berhasil dari laptop, TikTok memblokir IP Vercel. Tidak ada yang perlu diubah segera, karena pembeli tetap bisa mengirim screenshot; catat di BACKLOG bila berlangsung lama.
5. Bila gagal juga dari laptop dengan tahap `tautan_pendek` atau `tidak_ditemukan`, videonya dihapus atau privat. Bila link contoh di panduan demo yang gagal, ganti `CONTOH_LINK_TIKTOK` di `src/lib/content/demo.ts`.

## Bila Neon bermasalah

- **Halaman katalog** (beranda, kategori, produk, merek, artikel) tetap tampil dari cache selama datanya belum kedaluwarsa. Bagian stok, harga efektif, dan flash sale menampilkan kerangka lalu galat ramah.
- **Keranjang, checkout, masuk, akun, dan admin** tidak bisa dipakai. `/api/sehat` menjawab 503.
- **Build gagal** selama Neon tidak terjangkau, karena build memprarender katalog dari database. Deploy yang sedang tayang tidak terdampak.

Langkah:

1. Cek status Neon (neonstatus.com) dan console Neon untuk proyek Rona (compute aktif, kuota tidak habis).
2. Paket gratis menidurkan compute saat sepi. Permintaan pertama setelah tidur bisa lambat beberapa ratus ms. Itu normal.
3. Bila kuota bulanan habis (compute hours atau penyimpanan), naikkan paket atau tunggu siklus berikutnya.
4. Bila batas koneksi tercapai saat ramai, pastikan `DATABASE_URL` memakai host `-pooler`.
5. Setelah pulih, cek `/api/sehat`, lalu `npm run uji:produksi`.

## Rutin mingguan untuk demo

- Buka `/api/sehat`: `cron.ok` true, `dataUji` nol.
- Buka Laporan, Kesehatan AI: tingkat galat di bawah 5%, biaya sesuai perkiraan.
- Lihat Log aktivitas: reset demo harian tercatat.
- Jalankan `npm audit --omit=dev` di laptop. Bila ada temuan high, perbarui paketnya.
