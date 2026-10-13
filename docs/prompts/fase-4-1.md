# Fase 4.1: Cuplik hemat dan siap deploy

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md, docs/BACKLOG.md, dan scripts/cuplik.mjs. Jangan mengubah fitur toko di luar daftar ini.

## 1. Cuplik hemat

Batas gambar per percakapan review terbatas, jadi lembar cuplik harus jauh lebih padat.

1. Mode baru "ringkas" menjadi default:
   - Sembunyikan footer, BottomNav, DemoRibbon, dan PromoBar di semua potretan (lewat CSS yang disuntikkan khusus saat memotret, bukan mengubah aplikasi).
   - Batasi tinggi tiap potretan: default 2400 px di 375 dan 1800 px di 1440. Bagian yang terpotong diberi label "dipotong, tinggi asli N px".
   - Sebelum memotret halaman penuh, gulir ke paling atas dan tunggu sampai header menempel kembali ke posisi awal, supaya header tidak muncul di tengah halaman.
2. Opsi `--penuh` mengembalikan perilaku lama (dengan footer dan tanpa batas tinggi).
3. Opsi `--lebar=375` atau `--lebar=1440` untuk memotret satu lebar saja.
4. Susun lembar sepadat mungkin: targetkan maksimal 3 lembar per perintah, tanpa mengorbankan keterbacaan teks utama.
5. Selalu laporkan jumlah lembar dan ukurannya.

## 2. Header di tengah formulir checkout

Di lembar cuplik fase 4, header situs muncul di tengah formulir checkout langkah 1 (375 dan 1440 px). Pastikan apakah ini artefak skrip cuplik atau bug nyata header menempel di halaman checkout. Uji di browser sungguhan lewat Playwright tanpa full-page capture (gulir sambil memotret viewport). Perbaiki sesuai temuan dan jelaskan penyebabnya di laporan.

## 3. Siap deploy (Vercel + Neon)

1. Buat docs/DEPLOY.md berisi:
   - Tabel semua environment variable: nama, wajib atau opsional, contoh nilai yang aman (tanpa rahasia asli), dipakai di mana.
   - Langkah membuat database Neon (region Singapura) dan perbedaan connection string pooled dan direct.
   - Urutan menjalankan migrasi dan seed ke database produksi.
   - Langkah import repo ke Vercel, isian environment variable, region, dan verifikasi setelah deploy (cek halaman utama, produk, alur beli, cek:404).
2. Koneksi database:
   - `DATABASE_URL` (pooled) dipakai aplikasi dan proxy. Proxy maksimal 1 koneksi.
   - `DATABASE_URL_UNPOOLED` (direct) dipakai drizzle-kit untuk migrasi bila tersedia; bila kosong, jatuh ke DATABASE_URL.
3. Skrip database untuk produksi:
   - `db:deploy`: menjalankan migrasi saja.
   - `db:reset` ke host selain localhost atau 127.0.0.1 wajib ditolak, kecuali env `CONFIRM_RESET=rona-demo` diisi. Pesan penolakannya harus jelas.
4. Buat vercel.json:
   - Region fungsi `sin1`.
   - Cron harian untuk route pembatalan pesanan kedaluwarsa (paket gratis Vercel membatasi frekuensi cron, jadi pengecekan saat halaman dibuka tetap jalan).
   - Pastikan route cron menerima header `Authorization: Bearer <CRON_SECRET>` yang dikirim Vercel Cron, selain cara yang sudah ada.
5. Build produksi tidak boleh bergantung pada localhost. Jalankan `npm run build` dengan DATABASE_URL yang bukan localhost (boleh database lokal lewat alamat lain atau variabel tiruan untuk memeriksa error) dan laporkan bagian mana yang butuh database saat build.
6. Karena semua data fiktif, seluruh situs noindex sekarang juga (robots.txt dan meta robots), jangan tunggu Fase 8.
7. Header keamanan dasar di next.config: X-Content-Type-Options, Referrer-Policy, X-Frame-Options (atau frame-ancestors), Permissions-Policy yang wajar.
8. Pastikan `.env.example` berisi semua kunci terbaru tanpa nilai rahasia.

## Selesai

1. Jalankan db:reset (lokal), lint, typecheck, test, build, dan uji Playwright.
2. Jalankan `npm run cuplik -- --nama=fase4-1 --halaman=/checkout --aksi=alur-beli --lebar=375`.
3. Jangan buka gambarnya.
4. Perbarui docs/BACKLOG.md.
5. Commit dengan pesan "chore: cuplik hemat dan siap deploy".
6. Laporkan: penyebab header di tengah formulir, jumlah dan ukuran lembar cuplik baru, daftar environment variable yang wajib, dan bagian build yang butuh database.
