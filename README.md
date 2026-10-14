# Rona Beauty (toko demo)

Toko kosmetik multi-merek lengkap untuk portofolio: etalase, katalog dengan pencarian tahan salah ketik, pemilih shade, keranjang, checkout kirim atau Ambil di Toko, pembayaran simulasi, akun pembeli dengan poin, panel admin dengan stok per cabang, laporan, dan asisten AI untuk pembeli dan staf.

**Ini proyek demo.** Semua merek, produk, harga, cabang, pelanggan, dan pesanan fiktif. Data direset tiap malam pukul 03.00 WIB. Pembayaran dan pesan WhatsApp hanya disimulasikan.

## Coba demonya

- Toko: buka beranda, tekan **Panduan** di pita atas untuk tur 5 menit.
- Masuk sebagai pembeli: **Masuk**, lalu **Masuk sebagai Pembeli Demo** (tanpa OTP).
- Panel admin: `/admin/masuk`, pilih salah satu akun demo (Owner, Admin Online, Staf Cabang Dinoyo, Gudang).
- Halaman `/tentang-demo` merangkum fitur per kelompok.

## Teknologi

- Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS, komponen berbasis Radix, Motion
- PostgreSQL (Neon) dengan Drizzle ORM, pencarian full-text dan `pg_trgm`
- Gemini lewat Cloudflare AI Gateway
- Vitest dan Playwright (Chrome dan WebKit, axe)
- Vercel (region Singapura), Vercel Blob, Resend

## Menjalankan di laptop

Butuh Node.js 22 atau lebih baru dan PostgreSQL lokal di `127.0.0.1:5432`.

```bash
npm install
cp .env.example .env.local          # isi DATABASE_URL, misal postgresql://localhost:5432/rona_demo
createdb rona_demo
npm run db:reset                    # migrasi dan seed deterministik
npm run dev                         # http://localhost:3000
```

Fitur AI butuh `AI_GATEWAY_URL` dan `GEMINI_API_KEY`. Tanpa itu, toko tetap jalan dan fitur AI disembunyikan. Untuk uji tanpa biaya, isi `AI_PROVIDER=mock`.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan. |
| `npm run build`, `npm run start` | Build dan server produksi. Build membaca database. |
| `npm run lint`, `npm run typecheck` | ESLint dan TypeScript. |
| `npm run test` | Vitest: logika murni dan integrasi di database `<nama>_uji`. |
| `npm run test:cakupan` | Vitest dengan laporan cakupan di `coverage/`. |
| `npm run test:e2e` | Playwright di build produksi, database `<nama>_e2e`. Jalankan `npm run build` dulu. |
| `npm run uji:produksi -- --url=<alamat>` | Uji asap hanya-baca terhadap situs tayang. |
| `npm run db:reset` | Migrasi ulang dan seed. Ke host selain lokal butuh `CONFIRM_RESET=rona-demo`. |
| `npm run cek:data` | Periksa konsistensi buku stok, poin, kuota, voucher, dan tidak ada data uji. |
| `npm run cek:404`, `npm run cek:rahasia` | Periksa 404 sungguhan, dan pindai riwayat git untuk rahasia. |
| `npm run impor:katalog -- --berkas=<csv> [--kering]` | Impor katalog klien dari CSV. |
| `npm run eval:ai`, `eval:asisten`, `eval:deskripsi` | Evaluasi AI dengan model sungguhan (atau `-- --mock`). |
| `npm run cuplik`, `npm run aset:portofolio` | Lembar tangkapan layar untuk review, dan gambar portofolio di `_portofolio/`. |
| `npm run demo:ukur-reset` | Ukur durasi reset data demo. |

## Struktur

```
src/app            halaman toko, panel admin (admin/(panel)), route API
src/components     komponen UI, termasuk ProductArt
src/config         merek, font, sakelar fitur
src/lib            logika bisnis: pricing, shipping, inventory, orders, reports, ai, asisten, security, content
src/db             skema, migrasi, seed, reset
e2e, e2e-produksi  uji Playwright lokal dan uji asap produksi
docs               dokumen proyek
```

## Dokumen

| Dokumen | Isi |
| --- | --- |
| [docs/BRIEF.md](docs/BRIEF.md) | Brief lengkap produk. |
| [docs/ARSITEKTUR.md](docs/ARSITEKTUR.md) | Diagram sistem, alur pesanan dan stok, aturan cache, satu sumber angka. |
| [docs/KEPUTUSAN.md](docs/KEPUTUSAN.md) | Keputusan penting per fase beserta alasannya. |
| [docs/KEAMANAN.md](docs/KEAMANAN.md) | Model ancaman, kontrol, batas laju, temuan, dan kebutuhan toko sungguhan. |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy ke Vercel dan Neon, env, pembaruan per fase. |
| [docs/OPERASIONAL.md](docs/OPERASIONAL.md) | Cek kesehatan, log, migrasi gagal, pemulihan database, rotasi rahasia, gangguan. |
| [docs/RESKIN.md](docs/RESKIN.md) | Langkah mengubah Rona menjadi toko klien, dengan perkiraan waktu dan pertanyaan untuk klien. |
| [docs/STUDI-KASUS.md](docs/STUDI-KASUS.md) | Draf studi kasus portofolio. |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Pekerjaan yang ditunda dan alasannya. |
| [CHANGELOG.md](CHANGELOG.md) | Catatan perubahan per fase. |
| [docs/panduan-admin](docs/panduan-admin) | Panduan admin, juga sumber jawaban Asisten Admin. |

## Aturan kerja

Aturan proyek ada di `CLAUDE.md`. Yang paling penting: teks UI berbahasa Indonesia dengan sapaan "kamu", angka uang dan stok selalu dihitung ulang di server, stok hanya berubah lewat modul inventory, dan tidak ada nama atau gambar merek kosmetik nyata.
