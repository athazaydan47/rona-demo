# Keamanan

Dokumen ini menjelaskan apa yang dilindungi di Rona, bagaimana caranya, apa yang sudah diuji otomatis, dan apa yang masih harus ditambah sebelum kode ini dipakai toko sungguhan. Ditulis di Fase 8B (Oktober 2026).

Rona adalah toko demo. Semua produk, harga, pesanan, dan pelanggan fiktif, dan data direset tiap malam. Meski begitu, kontrolnya dibuat seperti untuk toko sungguhan, karena kode yang sama akan dipakai ulang untuk klien.

## Model ancaman

### Aset yang dilindungi

| Aset | Kenapa penting |
| --- | --- |
| Data pembeli: nama, nomor WA, email, alamat | Data pribadi. Di toko sungguhan diatur UU PDP. |
| Sesi pembeli dan staf | Siapa pun yang memegang sesi staf bisa mengubah harga, stok, dan pesanan. |
| Angka uang dan stok | Harga, diskon, voucher, poin, ongkir, dan stok tidak boleh bisa diatur dari browser. |
| Kuota dan biaya AI | Setiap panggilan Gemini berbayar. Penyalahgunaan bisa menghabiskan anggaran. |
| Rahasia server | Kunci database, Gemini, Blob, webhook, dan cron. |

### Pelaku yang diasumsikan

- **Pengunjung iseng dan bot.** Mengirim formulir berulang, menebak kode voucher atau nomor pesanan, mengunggah berkas aneh.
- **Pembeli yang curang.** Mengubah harga atau jumlah di permintaan, memakai voucher atau poin melebihi hak.
- **Staf dengan izin terbatas.** Memanggil aksi admin yang tidak diizinkan untuk perannya.
- **Penyerang XSS atau clickjacking.** Menyisipkan skrip dari luar atau membingkai panel admin.

### Di luar cakupan demo

Serangan DDoS skala besar, kompromi akun Vercel, Neon, atau Cloudflare, dan penyerang yang sudah memegang laptop pengembang. Bagian "Untuk toko sungguhan" di bawah menyebut apa yang perlu ditambah untuk itu.

## Kontrol yang ada

### Otentikasi dan sesi

- **Pembeli masuk dengan OTP WhatsApp.** Kode 6 digit, berlaku 5 menit, maksimal 5 percobaan salah per kode. Database hanya menyimpan HMAC kode. Di demo, kode tampil di layar, dan itu hanya aktif bila `DEMO_MODE=true`.
- **Token sesi acak 32 byte.** Database menyimpan SHA-256 dari token, bukan tokennya. Cookie sesi `httpOnly`, `SameSite=Lax`, `path=/`, dan `Secure` saat situs di balik https.
- **Staf masuk dengan email dan kata sandi.** Kata sandi di-hash dengan scrypt (memory-hard). Email yang salah 5 kali dalam 15 menit dikunci 15 menit, dan satu IP dibatasi 20 kegagalan per 15 menit. Pesan galat tidak membedakan email terdaftar atau tidak.
- **Atribut cookie diuji.** Uji Playwright `e2e/keamanan.spec.ts` masuk sebagai pembeli dan staf, lalu memeriksa atribut setiap cookie dan memastikan token sesi tidak muncul di HTML.

### Otorisasi

- Setiap server action dan route handler admin memeriksa sesi staf lalu izin perannya sebelum menyentuh data. Izin dihitung dari templat peran plus tambahan dan pengecualian per staf, dan cakupan lokasi membatasi staf cabang ke cabangnya.
- **Uji otomatis `src/lib/admin/otorisasi.integration.test.ts`** memanggil setiap aksi yang diekspor modul admin dan modul akun pembeli dengan beberapa bentuk argumen, dalam tiga keadaan: tanpa sesi, staf tanpa izin, dan pembeli tanpa sesi. Semua harus menolak, dan sidik jari database (jumlah baris dan waktu ubah di 20 tabel) harus sama sebelum dan sesudah. Aksi baru otomatis ikut diuji karena daftarnya diambil dari ekspor modul.
- Route handler admin (asisten, transkripsi, daftar ambil, foto, label, ekspor Excel) diuji menjawab 401 atau 403.

### Validasi masukan

- Setiap masukan dari browser dibentuk dengan skema zod di batas aksi (`src/lib/validasi.ts`) sebelum masuk modul layanan. Skema membatasi tipe, panjang, dan rentang angka.
- Aturan isi tetap ditegakkan di modul layanan: slug unik, harga jual tidak melebihi harga normal, stok tidak negatif, dan seterusnya.
- **Angka uang tidak pernah dipercaya dari browser.** Harga, diskon flash sale, voucher, poin, dan ongkir dihitung ulang di server saat checkout. Browser hanya mengirim total yang ia lihat, dan pesanan ditolak dengan harga terbaru bila berbeda.
- **Stok hanya berubah lewat modul inventory**, di dalam transaksi dengan baris terkunci, dan selalu menulis `stock_movements`. Uji `src/lib/inventory/penjaga.integration.test.ts` memastikan setiap jalur yang bisa membuat stok negatif menolak tanpa menulis apa pun.

### Unggahan berkas

| Unggahan | Pemeriksaan |
| --- | --- |
| Foto ulasan dan foto produk admin | Jenis dibaca dari isi berkas (JPG, PNG, WebP), harus sama dengan tipe yang dikirim browser. Maksimal 2 MB, sisi terpanjang 1.600 px, sisi terpendek 160 px. Nama berkas acak dari server. |
| Foto kuis kulit dan screenshot cari dupe (AI) | Jenis dari isi berkas, maksimal 4 MB, dimensi 64 sampai 4.096 px. Hanya di memori selama satu permintaan, tidak disimpan di disk, Blob, database, atau log. |

Browser memperkecil foto sebelum mengirim, tetapi server memeriksa ulang semuanya.

### Batas laju

| Titik | Batas | Penyimpanan |
| --- | --- | --- |
| Minta OTP | 1 per 60 detik per nomor, 3 per 10 menit dan 10 per hari per nomor, 10 per 10 menit dan 30 per hari per IP | Postgres (`otp_codes`) |
| Verifikasi OTP | 5 percobaan salah per kode | Postgres |
| Masuk staf | 5 gagal per email per 15 menit (kunci 15 menit), 20 gagal per IP per 15 menit | Postgres |
| Lacak pesanan | 10 per IP dan 5 per nomor pesanan per 10 menit | Postgres (`rate_limits`) |
| Hitung ulang checkout (ongkir, harga) | 120 per IP per menit | Memori per instance |
| Kode voucher salah | 15 kode berbeda per IP per 10 menit, lalu voucher tidak diperiksa sama sekali sampai jendela berakhir | Postgres |
| Unggah foto ulasan | 20 per pembeli per jam | Postgres |
| Unggah foto admin | 60 per staf per jam | Postgres |
| Advisor dan chat AI pembeli | 5 per menit, 20 per hari per pengunjung saat demo | Postgres (`ai_logs`) |
| Foto kuis kulit, cari dupe | 5 dan 10 per pengunjung per hari | Postgres |
| Tafsiran shade AI | 20 per pengunjung per hari | Postgres |
| Asisten Admin, masukan suara | 80 dan 40 per staf per hari | Postgres |
| Semua panggilan AI | `AI_DAILY_CAP` per hari (bawaan 1.000), lalu fitur AI tampil "sedang istirahat" | Postgres |
| Saran pencarian, katalog JSON | 120 per IP per menit | Memori per instance |
| Laporan CSP, laporan galat klien | 30 dan 20 per IP per menit | Memori per instance |
| Webhook pembayaran | Tanda tangan HMAC-SHA256 wajib, dibandingkan waktu-konstan; idempoten per kunci | Rahasia `PAYMENT_WEBHOOK_SECRET` |
| Cron harian | `Authorization: Bearer <CRON_SECRET>` wajib | Rahasia `CRON_SECRET` |

Kunci batas laju tidak menyimpan IP atau nomor mentah. Semuanya di-HMAC dengan `SESSION_SECRET`. Jendela lama dihapus cron harian.

### Header dan Content Security Policy

Semua rute mengirim header berikut, dan uji Playwright memeriksanya di toko, admin, API, dan halaman 404:

- `Content-Security-Policy` (ditegakkan): `default-src 'self'`, skrip hanya dari situs sendiri, gambar hanya dari situs sendiri plus Vercel Blob, ubin OpenStreetMap, dan sampul TikTok atau YouTube. `frame-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. Pelanggaran dilaporkan ke `/api/csp-laporan`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`.
- `Permissions-Policy`: kamera, pembayaran, dan USB mati. Mikrofon hanya untuk situs sendiri (masukan suara Asisten Admin).
- `Strict-Transport-Security` dua tahun di Vercel.
- `X-Robots-Tag: noindex, nofollow`, karena seluruh isi toko fiktif.
- Header `X-Powered-By` dimatikan.

**Kenapa skrip inline masih diizinkan.** Next.js dengan Cache Components memprarender kerangka halaman (PPR) dan menyisipkan payload RSC sebagai skrip inline. Nonce per permintaan tidak bisa dipakai karena kerangka statis tidak membawa nonce. Jadi `script-src` memakai `'self' 'unsafe-inline'`: skrip dari domain lain tetap diblokir, tetapi skrip inline tidak. Mitigasinya adalah React yang meng-escape semua isi, tidak ada `dangerouslySetInnerHTML` dengan data pengguna, dan validasi masukan. Bila Next mendukung hash untuk payload PPR, ganti ke hash.

**Cara CSP diterapkan.** CSP dijalankan dulu dalam mode laporan (`CSP_MODE=report-only`) dan diaudit di 400 pemeriksaan halaman: toko, admin, peta Leaflet, foto Blob, panel AI. Hasilnya nol pelanggaran, lalu CSP ditegakkan. Uji Playwright membuka panel Advisor, peta Toko kami, peta checkout, dan panel Asisten Admin dengan pemantau pelanggaran. Uji kontrol memastikan pemantau benar-benar menangkap skrip dari domain luar.

### Rahasia

- Rahasia hanya di `.env.local` (lokal) dan Environment Variables Vercel. Hanya `.env.example` yang di-commit.
- `npm run cek:rahasia` memindai seluruh riwayat git untuk pola kunci Google, Resend, Vercel Blob, GitHub, kunci privat, connection string Postgres berkata sandi, nilai env rahasia, dan berkas env yang pernah ter-commit. Hasil Fase 8B: tidak ada rahasia di riwayat. Riwayat tidak pernah ditulis ulang otomatis.
- `SESSION_SECRET` wajib di produksi. Kode menolak nilai di bawah 16 karakter, dan yang disarankan 32 karakter acak. Tanpa nilai yang sah, halaman masuk menampilkan "Masuk belum tersedia".

### Dependensi

`npm audit --omit=dev` (paket yang ikut ke produksi): **0 kerentanan**. Fase 8B memaksa `uuid` ke versi 11 lewat `overrides` untuk menutup celah moderat di dependensi tidak langsung.

Sisa temuan hanya di alat pengembangan, tidak ikut ke server produksi:

| Paket | Tingkat | Kenapa diterima |
| --- | --- | --- |
| `braces` lewat `eslint-config-next` | high (5 baris rantai yang sama) | Celahnya stack exhaustion bila pola glob bersarang dalam dikirim penyerang. Polanya hanya dari konfigurasi lint di repo. Belum ada versi `braces` 3.x yang diperbaiki. |
| `esbuild` lewat `drizzle-kit` | moderate | Server pengembangan esbuild bisa dibaca situs lain. `drizzle-kit` hanya dipakai untuk membuat migrasi, tidak menjalankan server. |

### Log dan privasi

- Log server terstruktur (JSON) untuk pesanan dibuat, dibayar, dan batal, reset demo, cron, dan galat AI. Nomor WA dan email disamarkan sebelum ditulis (`src/lib/log.ts`).
- Pelacakan galat opsional lewat `SENTRY_DSN`. Bila kosong, tidak ada SDK yang dimuat. Bila diisi, galat dikirim setelah nomor WA dan email disamarkan dan query URL dibuang, tanpa cookie, header, atau isi permintaan.
- `/api/sehat` hanya menjawab status database, versi, seed, cron, dan jumlah data uji. Uji memastikan tidak ada alamat database, kunci, atau nomor WA di jawabannya.
- Log aktivitas admin menyimpan data mentah di database dan menampilkan nama yang mudah dibaca. Nomor WA dan email di halaman Pelanggan disamarkan.

### Pemisahan data uji

Uji Vitest memakai database `<nama>_uji` dan Playwright memakai `<nama>_e2e`, keduanya disiapkan ulang setiap kali uji jalan. Database kerja `rona_demo` hanya berisi seed. `npm run cek:data`, `npm run cuplik`, dan `npm run aset:portofolio` menolak jalan bila menemukan data bernama uji. `npm run uji:produksi` memeriksa lewat `/api/sehat` bahwa produksi tidak punya produk, slot flash sale, atau voucher bernama uji.

## Temuan dan perbaikan Fase 8B

| Temuan | Dampak | Perbaikan |
| --- | --- | --- |
| Pembatas laju di Postgres mengirim objek `Date` lewat SQL mentah yang tidak diserialisasi driver | Lacak pesanan, unggah foto, dan tafsiran shade akan galat 500 begitu dipakai | Ditulis ulang dengan query builder, diuji di Postgres sungguhan, ditambah uji Playwright lacak pesanan |
| Quote checkout menjawab apakah kode voucher ada, tanpa batas | Kode voucher bisa ditebak beruntun | Batas kode berbeda yang salah per IP, lalu voucher tidak diperiksa sama sekali; batas hitung ulang per IP |
| Proxy memberi atribut `Secure` saat `NODE_ENV=production`, beda dengan cookie lain | Di Safari lewat http lokal, sesi hilang saat diperpanjang | Semua cookie memakai satu aturan `cookieSecure()` |
| Belum ada CSP lengkap | Skrip luar bisa dimuat bila ada celah XSS | CSP ditegakkan setelah audit mode laporan |
| Aksi admin hanya diuji per modul | Aksi baru tanpa pemeriksaan izin bisa lolos | Uji otorisasi menyeluruh berbasis ekspor modul |
| Masukan aksi tidak divalidasi seragam | Muatan raksasa atau tipe aneh sampai ke modul layanan | Skema zod di semua batas aksi |
| Foto AI hanya dicek jenis dan ukuran berkas | Gambar rusak atau berdimensi ekstrem dikirim ke Gemini | Dimensi dibaca dari isi berkas |
| Pembaca panduan admin memakai path dinamis | Seluruh proyek ikut di-trace ke fungsi server | Path statis, fungsi hanya membawa `docs/panduan-admin` |
| Header `X-Powered-By: Next.js` | Membocorkan kerangka | Dimatikan |
| `uuid` rentan di dependensi tidak langsung | Celah moderat di paket produksi | Dipaksa ke versi 11 |

## Untuk toko sungguhan

Sebelum kode ini menerima pesanan dan uang sungguhan:

1. **Payment gateway resmi** (misal Midtrans atau Xendit). Buat adapter yang membuat tagihan saat pesanan dibuat dan memverifikasi tanda tangan webhook gateway, lalu memanggil `confirmPayment` yang sudah idempoten. Matikan tombol simulasi dengan `DEMO_MODE=false`.
2. **WhatsApp Business Platform resmi** untuk OTP dan notifikasi, dengan templat yang disetujui Meta. Antarmuka `OtpSender` dan `WhatsAppSender` sudah disiapkan. Jangan memakai WA pribadi atau gateway tidak resmi, karena nomornya bisa diblokir.
3. **Cadangan dan pemulihan.** Aktifkan riwayat point-in-time Neon dengan masa simpan yang cukup (paket berbayar), dan latih pemulihan sekali sebelum buka. Lihat docs/OPERASIONAL.md.
4. **Kebijakan privasi dan UU PDP.** Tulis kebijakan privasi sungguhan, tentukan masa simpan data pelanggan, sediakan cara menghapus akun, dan buat perjanjian pemrosesan data dengan Vercel, Neon, Google, Cloudflare, dan Resend.
5. **Domain sendiri dengan HSTS preload**, dan matikan `X-Robots-Tag: noindex` setelah data fiktif diganti.
6. **Perlindungan bot di tepi.** Aktifkan Vercel Firewall atau Cloudflare di depan situs. Batas laju di memori hanya berlaku per instance.
7. **Dua faktor untuk staf**, terutama Owner, dan rotasi kata sandi akun bawaan.
8. **Pemantauan aktif.** Isi `SENTRY_DSN`, pasang pemantau uptime ke `/api/sehat`, dan pasang peringatan anggaran AI di Cloudflare atau Google.
9. **Uji penetrasi singkat** oleh pihak lain sebelum peluncuran.
10. **Rotasi rahasia terjadwal** (lihat docs/OPERASIONAL.md) dan pembatasan akses akun Vercel dan Neon dengan 2FA.
