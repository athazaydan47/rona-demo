# Audit poles Fase 8A

Audit pengalaman toko dan panel admin sebelum Rona dianggap "jadi". Cara kerjanya:

- `scripts/audit-poles.mjs` membuka 55 halaman (29 toko sebagai tamu, 11 halaman akun sebagai Pembeli Demo, 15 halaman admin untuk Owner, Admin Online, Staf Cabang Dinoyo, dan Gudang) di lebar 375, 390, 768, dan 1440 px: 400 pemeriksaan. Setiap pemeriksaan mencatat status HTTP, galat konsol, overflow mendatar, tanda pisah panjang, istilah tidak konsisten ("Order", "Anda"), teks mentah (undefined, NaN, [object), isi utama kosong, gambar tanpa alt, sasaran sentuh di bawah 32 px di HP, dan pelanggaran axe (WCAG 2.1 AA) di 390 dan 1440 px. Hasil mentah: `_review/audit-poles.json`.
- Perayap tautan `npm run cek:404` (187 halaman dari beranda, nol tautan mati).
- Pembacaan kode untuk hal yang tidak terukur otomatis (nada bahasa, konsistensi istilah, keadaan kosong, muat, dan galat).
- Lembar cuplik `fase8a` untuk pemeriksaan visual manual (lihat laporan fase).

Hasil putaran pertama (sebelum perbaikan): 236 dari 400 pemeriksaan punya temuan, hampir semuanya dua hal yang berulang di banyak halaman: sasaran sentuh kecil (logo dan tautan teks) dan kontras badge hijau. Tidak ada status salah, halaman kosong, teks mentah, gambar tanpa alt, atau galat konsol selain 404 yang memang diharapkan.

Prioritas: **tinggi** mengganggu alur atau melanggar aturan proyek, **sedang** terasa oleh pengguna yang teliti atau pembaca layar, **rendah** kosmetik. Semua tinggi dan sedang diperbaiki di fase ini; rendah masuk `docs/BACKLOG.md` dengan alasan.

## 1. Konsistensi visual

| Prioritas | Temuan | Halaman | Status |
| --- | --- | --- | --- |
| Sedang | Tombol beli di halaman produk meluap 191 px ke kanan pada 768 px karena kolom kanan sempit sementara grid memakai 4 kolom sejak `sm` | /p/[slug] @768 | Diperbaiki: grid kembali 3 kolom di `md`, 4 kolom lagi di `lg` |
| Sedang | Label "Sedang berlangsung" dan tautan "Coba Advisor" di kartu gelap memakai `text-emas-teks` (3,15:1 di atas kopi) setelah perbaikan kontras global yang terlalu rata | /, /flash-sale | Diperbaiki: di latar kopi kembali `text-emas` (6,76:1); `-teks` hanya untuk latar terang |
| Sedang | Istilah "Ambil di toko" ditulis dengan tiga kapitalisasi berbeda (ringkasan checkout, rincian pesanan, halaman toko, FAQ) | checkout, pesanan, /toko, /faq | Diperbaiki: selalu "Ambil di Toko" |
| Rendah | Kartu produk di beranda dan katalog memuat daftar varian lengkap untuk tambah cepat (field `inStock`, `price`, `normalPrice`, `shadeName` muncul 291 kali di payload beranda) | /, /c/* | Backlog: payload sekitar 30 KB, bukan penyumbang utama; dipangkas bersama pemindahan katalog ke SQL |
| Rendah | Komponen `ComingSoon` dan `AdminComingSoon` tidak lagi dipakai halaman mana pun setelah /advisor dan /toko diisi | - | Backlog: berkas lama, tidak dihapus tanpa izin |

## 2. Keadaan kosong, muat, dan galat

| Prioritas | Temuan | Halaman | Status |
| --- | --- | --- | --- |
| Tinggi | Halaman 404 memakai `not-found` bawaan tanpa identitas Rona, tanpa pencarian dan tanpa jalan kembali | semua | Diperbaiki: 404 bermerek dengan kotak pencarian, 5 kategori populer, tombol beranda; produk yang tidak ada tetap 404 sungguhan |
| Tinggi | Tidak ada `error.tsx` dan `global-error.tsx`: galat render menampilkan layar Next polos | semua | Diperbaiki: halaman 500 bermerek dengan Coba lagi, beranda, hubungi; kode digest ditampilkan kecil |
| Tinggi | /advisor dan /toko masih "Segera hadir"; tautan footer ke Cara Belanja, FAQ, Cek Ongkir, Hubungi, dan kebijakan 404 (temuan Fase 5) | footer | Diperbaiki: delapan halaman bantuan dari satu sumber teks `src/lib/content/bantuan.ts` dan `toko.ts`; /kebijakan-privasi dialihkan permanen ke /kebijakan/privasi |
| Sedang | Isi 404 bisa terkirim dengan status 200 bila halaman memakai `notFound()` di dalam Suspense; perayap lama hanya mengecek status | - | Diperbaiki: perayap memeriksa HTML yang tampak (bukan payload RSC) untuk judul 404 |
| Sedang | Keadaan muat di katalog memakai kerangka tanpa transisi ke isi, dan kartu baru "melompat" masuk | /c/* | Diperbaiki: kartu masuk bertahap (maksimal 8 langkah) saat filter berganti dan halaman berikutnya dimuat; kerangka dipertahankan dengan proporsi sama |
| Rendah | Audit otomatis tidak menemukan halaman dengan isi utama kosong atau teks mentah; keadaan kosong akun (pesanan, poin, Kabari aku, notifikasi) dan admin sudah punya kalimat dan satu aksi | - | Tidak ada tindakan |

## 3. Teks

| Prioritas | Temuan | Halaman | Status |
| --- | --- | --- | --- |
| Tinggi | Kepala tabel jawaban Asisten Admin bocor sebagai `camelCase` (misal `penjualanBarangRp`) dan angka rupiah tidak diformat | /admin (asisten) | Diperbaiki: peta label manusiawi `src/lib/asisten/label.ts`, sel rupiah diformat, angka rata kanan; uji unit menjaga tidak ada camelCase atau snake_case |
| Tinggi | Draf balasan ulasan menyapa dengan nama lengkap pembeli dan bisa menyebut data pesanan | /admin/ulasan | Diperbaiki: sapaan `Kak <nama depan>`, nama tampilan ulasan "Zahra K.", penjaga menolak nomor WA, nominal, nomor pesanan, alamat, dan nama lengkap |
| Sedang | Pemeriksa klaim deskripsi hanya mengecek persen, jam, dan SPF; "2 bulan" lolos karena "2" ada di "12 jam" | /admin/produk | Diperbaiki: semua satuan (persen, jam, ml, gram, hari, minggu, bulan, kali, SPF, PA) dan angka harus muncul utuh di acuan; `npm run eval:deskripsi` 11 produk termasuk acuan minim |
| Sedang | Teks pita demo dan footer studio belum final | semua | Diperbaiki: "Toko demo: produk, harga, dan pesanan fiktif, direset tiap malam." plus tombol Panduan |
| Rendah | Audit tidak menemukan tanda pisah panjang, kata "Order", atau "Anda" di 400 pemeriksaan; grep di `src` dan `docs` juga nol | - | Tidak ada tindakan |

## 4. Interaksi dan gerak

| Prioritas | Temuan | Halaman | Status |
| --- | --- | --- | --- |
| Tinggi | Asisten Admin menebak periode pada pertanyaan perbandingan tanpa periode (eval owner-31) | /admin (asisten) | Diperbaiki: bertanya balik dengan chip pilihan cepat (hari ini vs kemarin, minggu ini vs minggu lalu, bulan ini vs bulan lalu) |
| Tinggi | Kanban hanya bisa diseret dengan mouse; di HP dan keyboard tidak ada cara memindah kartu selain membuka detail | /admin/pesanan | Diperbaiki: daftar "Pindahkan ke..." berisi hanya status tujuan yang sah di setiap kartu (HP dan desktop) |
| Sedang | Tidak ada token gerak; durasi dan easing ditulis lepas per komponen | - | Diperbaiki: `src/lib/motion.ts` dan `--durasi-*`, `--ease-pegas` di CSS; bagian Gerak di /design dan BRIEF |
| Sedang | Badge keranjang tidak bereaksi saat produk "mendarat"; laci keranjang memakai easing bawaan | semua | Diperbaiki: badge berdenyut dengan pegas, laci memakai durasi lambat dan ease lembut |
| Sedang | Sheet HP (tambah cepat, filter) hanya bisa ditutup lewat tombol X atau overlay | /c/*, kartu produk | Diperbaiki: usap ke bawah dari pegangan, elemen mengikuti jari lalu kembali dengan pegas |
| Sedang | Hitung mundur mengganti angka seketika; bilah kuota melompat saat angka berubah | /, /flash-sale, /p/[slug] | Diperbaiki: flip halus per kotak angka, lebar bilah bertransisi |
| Sedang | Dashboard: pesanan baru hanya berubah warna latar; angka statistik melompat | /admin | Diperbaiki: sorotan "cahaya" 2,4 detik dan angka naik bertahap (CountUp) |
| Sedang | Gelembung obrolan Advisor dan Asisten muncul tanpa transisi, indikator menunggu hanya spinner | advisor, asisten | Diperbaiki: gelembung masuk 8 px, indikator tiga titik dengan teks status |
| Sedang | Kartu kanban tidak memberi umpan balik saat dilepas di kolom yang tidak sah | /admin/pesanan | Diperbaiki: kartu terangkat saat diseret, bergoyang kembali bila ditolak |
| Rendah | Animasi layout antar posisi kartu saat filter berubah (kartu yang tetap ada "berpindah") tidak dibuat | /c/* | Backlog: filter berganti lewat navigasi server dan kunci grid, jadi kartu dipasang ulang; animasi layout lintas pemasangan butuh LayoutGroup dan id stabil, biayanya tidak sebanding untuk grid 24 kartu |

## 5. Aksesibilitas

| Prioritas | Temuan | Halaman | Status |
| --- | --- | --- | --- |
| Tinggi | Badge hijau (`#DFF0E6` + sukses) 4,39:1 di bawah AA; dipakai di 20-an status admin dan akun | admin, akun | Diperbaiki: latar `#EAF6EF` (4,69:1) |
| Tinggi | Harga coret `text-abu-hangat/80` 3,79:1 | katalog, produk, flash sale | Diperbaiki: `text-abu-hangat` penuh (5,95:1) |
| Tinggi | `text-abu-hangat/70` (3,1:1) untuk nama lokasi di matriks stok dan "Tidak ada slot" di promo | /admin/stok, /admin/promo | Diperbaiki: abu-hangat penuh |
| Tinggi | `aria-label` pada `div`/`span` tanpa role (titik shade, bintang ulasan admin, penanda belum dibaca) | katalog, /admin/ulasan, /akun/notifikasi | Diperbaiki: `role="img"` |
| Tinggi | `li` di dalam `ul` ber-role `radiogroup` (pemilih shade) dan `tabpanel` (kanban HP) | /p/[slug], /admin/pesanan | Diperbaiki: pemilih shade memakai `div`; kanban HP memakai `ul role=list` berlabel |
| Tinggi | Pemilih shade tidak bisa dijelajahi dengan panah keyboard; setiap swatch ikut urutan Tab | /p/[slug] | Diperbaiki: pola radio (panah memindah fokus dan memilih, hanya yang terpilih di urutan Tab) |
| Tinggi | Pesan galat formulir checkout tidak tertaut ke inputnya | /checkout | Diperbaiki: `aria-describedby` ke galat atau petunjuk |
| Sedang | Tautan di notifikasi akun berwarna rona di latar hijau atau krem (4,36 dan 4,44:1) | /akun/notifikasi | Diperbaiki: rona-gelap |
| Sedang | Jam di pratinjau WA Kabar Harian `#667781` di latar hijau 4,04:1 | /admin/kabar | Diperbaiki: `#4b5b62` (6,15:1) |
| Sedang | Galeri HP ber-role `region` tanpa isi yang bisa difokus | /p/[slug] | Diperbaiki: `tabIndex=0` pada penggulir |
| Sedang | Penanda peta Leaflet `role=button` tanpa nama | /toko | Diperbaiki: `title` dan `alt` nama cabang |
| Sedang | Sasaran sentuh di bawah 32 px: logo toko dan admin (30-31 px), tautan "Kembali ke Dashboard", "Semua pesanan", "Lihat pesanan", nav halaman bantuan, titik banner (10 px), tautan jejak navigasi (16 px) | banyak | Diperbaiki: tinggi minimal 32 sampai 44 px lewat `min-h` dan padding |
| Sedang | Kontras teks umum: sage, emas, dan peringatan asli di bawah 3,3:1 di latar terang | badge, stok, kuota | Diperbaiki (awal fase): token `-teks` (5 sampai 6,2:1) hanya untuk teks di latar terang |
| Sedang | Panel admin dirender di dalam `main` toko sehingga ada dua `main` dan landmark ganda (axe moderate, 120 pemeriksaan) | admin | Diperbaiki: pembungkus admin tidak lagi `main`, isi admin berada di `main` root |
| Rendah | `heading-order` (h3 setelah h1 di beberapa bagian beranda dan checkout) dan `region` (promo bar di luar landmark) bernilai moderate | /, /checkout | Backlog: urutan heading mengikuti hierarki visual kartu, promo bar sengaja ringan; tidak dibaca sebagai hambatan oleh pembaca layar |
| Rendah | Audit tap target masih mengecualikan tautan inline di dalam kalimat (misal "kebijakan privasi" di paragraf) | - | Backlog: tautan di dalam kalimat mengikuti ukuran teks sesuai praktik umum |

## 6. Kecepatan

| Prioritas | Temuan | Halaman | Status |
| --- | --- | --- | --- |
| Tinggi | HTML beranda 2.458 KB, produk 995 KB, katalog 499 KB: payload RSC menyalin sekitar 100 pohon SVG ProductArt | /, /p/[slug], /c/* | Diperbaiki: `ProductArt` menjadi `<img src="/art?...">` (SVG di-cache setahun, immutable); SVG inline hanya untuk galeri, hero, OG. Beranda 787 KB, produk 430 KB, katalog 190 KB sebelum penyempurnaan lanjutan (angka akhir di laporan fase) |
| Tinggi | Lighthouse mobile beranda Performa 69, LCP 6,0 s; produk 79, LCP 5,3 s | /, /p/[slug] | Diperbaiki (lihat tabel sebelum dan sesudah di laporan fase) |
| Sedang | Banner hero memakai `<img>` biasa tanpa ukuran responsif | / | Diperbaiki: `next/image` dengan `fill`, `sizes`, dan `priority` untuk banner pertama; pola host Blob diizinkan |
| Sedang | Catatan BACKLOG Fase 6B menyebut "prefetch 500" seolah prefetch dimatikan lewat `instant = false` | /p/[slug] | Diperiksa: di Next 16.4 `instant` hanya mengatur validasi navigasi instan saat pengembangan, bukan prefetch; prefetch produksi berjalan (terukur 5 prefetch per halaman katalog, navigasi ke produk 0,9 s) dan 500 lama sudah hilang sejak params dibaca sebelum Suspense dengan `generateStaticParams`. Dibiarkan `false` karena halaman memang memblokir untuk 404 sungguhan |
| Sedang | Leaflet, editor, dan grafik admin ikut bundel awal? | checkout, /toko, admin | Diperiksa: Leaflet sudah `dynamic()`/`import()` di checkout, buku alamat, dan peta toko; grafik dashboard dan laporan adalah SVG tangan tanpa pustaka; tidak ada editor teks kaya. Ukuran JS per rute ada di laporan fase |
| Rendah | Neon cold start belum diukur dari Vercel; halaman katalog yang di-cache tidak menunggu DB | - | Backlog: diukur saat deploy berikutnya lewat `/api/kesehatan`; kerangka Suspense sudah ada untuk stok, harga, dan flash |
