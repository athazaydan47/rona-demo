# Rona Beauty (Demo Store)

Toko kosmetik DEMO multi-merek untuk portofolio. Semua merek, produk, harga, cabang, dan pesanan adalah fiktif.
Brief lengkap ada di `docs/BRIEF.md`. Baca bagian yang relevan sebelum mengerjakan fase apa pun.

## Aturan wajib

- Semua teks UI berbahasa Indonesia dengan sapaan "kamu", hangat dan singkat.
- DILARANG memakai em-dash (karakter U+2014) di mana pun: teks UI, komentar kode, pesan commit, dokumen. Pakai koma, titik dua, atau kalimat baru.
- Uang disimpan sebagai bilangan bulat rupiah dan ditampilkan sebagai `Rp 129.000`. Waktu disimpan UTC, ditampilkan WIB (Asia/Jakarta), contoh `13 Okt 2026, 14.30 WIB`.
- Semua harga, diskon, voucher, poin, ongkir, dan stok dihitung ulang di server. Jangan pernah mempercayai angka dari browser.
- Perubahan stok selalu lewat modul inventory dan selalu menulis `stock_movements`.
- Jangan memakai nama, logo, atau foto merek kosmetik nyata. Pakai 12 merek fiktif di BRIEF dan komponen `ProductArt` untuk gambar produk.
- Fitur simulasi (OTP di layar, tombol simulasi bayar, akun demo, reset harian) hanya aktif bila `DEMO_MODE=true`.
- Rahasia hanya di `.env.local`. Jangan commit file env selain `.env.example`.
- JANGAN menghapus, memindahkan, atau menimpa `CLAUDE.md`, folder `docs/`, folder `public/images/lifestyle/`, atau file lain yang tidak kamu buat di sesi ini tanpa bertanya dulu.
- Jangan `git push`. Boleh commit di akhir fase dengan pesan konvensional (`feat:`, `fix:`, `chore:`).

## Stack

- Next.js (App Router, TypeScript), Tailwind CSS, komponen berbasis Radix gaya shadcn/ui, Motion, lucide-react
- PostgreSQL + Drizzle ORM. Lokal: `127.0.0.1:5432`, database `rona_demo`. Produksi: Neon.
- Pencarian: full-text Postgres + `pg_trgm`
- Uji: Vitest (logika) dan Playwright (alur)
- AI: Gemini lewat Cloudflare AI Gateway (fase 7)
- Hosting: Vercel

## Struktur yang diharapkan

- `src/app/` halaman toko, `src/app/admin/` panel admin
- `src/db/` skema, migrasi, seed
- `src/lib/pricing`, `src/lib/shipping`, `src/lib/inventory`, `src/lib/orders`, `src/lib/ai` untuk logika bisnis (fungsi murni sebisa mungkin, wajib diuji)
- `src/components/` komponen UI, termasuk `ProductArt`

## Perintah (dibuat di fase 1)

- `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
- `npm run db:reset` untuk migrasi ulang dan seed deterministik

## Definisi selesai untuk setiap fase

1. Lint, typecheck, test, dan build bersih.
2. Dicek di lebar 375 px dan 1440 px.
3. Laporan akhir berisi: apa yang dibuat, keputusan yang diambil sendiri, dan apa yang belum atau perlu dicek manual.

## Aturan cache

- Data katalog yang jarang berubah (nama, deskripsi, merek, kategori, atribut produk, artikel, pengaturan toko) boleh di-cache dengan `use cache` dan `cacheTag` per produk, kategori, dan merek. Helper tag terpusat ada di `src/lib/cache-tags.ts`; jangan menulis string tag secara langsung.
- Stok, harga efektif, flash sale, dan kuota tidak boleh basi: baca tanpa cache (di dalam `Suspense`) atau dengan `cacheLife` sangat pendek.
- Setiap modul yang mengubah data (admin, checkout, inventory, promo) wajib memanggil `revalidateTag` untuk tag yang terdampak lewat helper di `src/lib/cache-tags.ts`.
