# Studi kasus: Rona Beauty

Draf untuk situs portofolio Ciptalogy. Rona adalah **proyek demo**: toko kosmetik fiktif dengan 12 merek karangan, 79 produk, tiga cabang di Malang, dan data yang direset tiap malam. Tidak ada klien, pembeli, atau transaksi sungguhan. Tujuannya menunjukkan seperti apa toko online yang kami bangun untuk toko kosmetik lokal, dan menjadi mesin yang bisa dipakai ulang untuk klien.

## Masalah

Toko kosmetik multi-merek di kota menengah biasanya berjualan di tiga tempat sekaligus: toko fisik, marketplace, dan WhatsApp. Masalah yang berulang:

- **Pembeli ragu soal shade.** Warna di foto marketplace jarang sama dengan aslinya, dan pertanyaan "shade mana yang cocok untuk kulitku" dijawab satu per satu lewat chat.
- **Stok tidak sinkron antar cabang.** Pembeli datang ke cabang yang ternyata kosong, atau pesanan online diambil dari stok yang sudah terjual di toko.
- **Pemilik tidak punya angka harian yang bisa dipercaya.** Omzet, produk terlaris, dan stok menipis direkap manual dari beberapa sumber.
- **Promo sulit dikendalikan.** Flash sale, voucher, dan poin dihitung di banyak tempat sehingga harga di layar bisa berbeda dengan yang ditagih.

## Pendekatan

**Satu sumber angka.** Harga, diskon, voucher, poin, ongkir, dan stok dihitung oleh satu set fungsi di server dan dipakai di semua tempat: keranjang, checkout, pesanan, laporan, dan jawaban AI. Browser hanya menampilkan. Pesanan ditolak bila total yang dilihat pembeli berbeda dengan hitungan server, sehingga pembeli tidak pernah membayar harga yang tidak ia lihat.

**Stok per cabang dengan buku besar.** Setiap perubahan stok (pesan, bayar, batal, stok masuk, transfer, opname) lewat satu modul dan tercatat di buku besar. Saldo selalu bisa dijelaskan, dan pemeriksa otomatis memastikan buku besar sama dengan saldo.

**AI yang tidak mengarang.** Asisten belanja hanya merekomendasikan produk dari hasil pencarian katalog, dengan alasan singkat per produk. Setiap angka rupiah di jawabannya diperiksa terhadap harga sebenarnya. Asisten untuk pemilik hanya membaca data, dan setiap saran (transfer stok, flash sale) menjadi draf yang harus disetujui manusia. Toko tetap berjalan penuh tanpa AI.

**Dibangun bertahap dengan pagar mutu.** Pekerjaan dibagi menjadi 14 fase dengan prompt tertulis (tersimpan di `docs/prompts`), dikerjakan bersama agen AI (Claude Code). Setiap fase ditutup dengan lint, pemeriksaan tipe, uji, dan build yang bersih, dicek di lebar 375 px dan 1.440 px, lalu direview sebelum fase berikutnya.

**Siap dipakai ulang.** Nama, warna, font, teks, dan fitur toko ada di konfigurasi, sehingga reskin untuk klien diperkirakan 3 sampai 5 hari kerja di luar integrasi pembayaran dan WhatsApp resmi.

## Fitur utama

**Untuk pembeli**
- Pemilih shade dengan perbandingan warna, padanan shade dari produk lain, dan kuis kulit yang menghasilkan rutinitas.
- Pencarian tahan salah ketik dan pencarian kalimat ("cushion buat kulit sawo matang undertone warm").
- Asisten belanja AI dengan kartu produk yang bisa langsung ditambah ke keranjang.
- Cari produk mirip dari link TikTok atau YouTube, atau dari screenshot.
- Stok per cabang di halaman produk, checkout kirim atau Ambil di Toko, flash sale dengan kuota, voucher, dan poin.
- Akun dengan masuk lewat OTP WhatsApp, riwayat pesanan, alamat, wishlist, dan notifikasi stok kembali.

**Untuk pemilik dan staf**
- Dashboard harian, papan pesanan sesuai alur status, label kirim, dan daftar ambil.
- Stok per cabang: stok masuk, transfer, opname, dan buku stok.
- Katalog, promo (flash sale, harga promo, voucher, banner), pengaturan toko dan cabang.
- Laporan penjualan dengan ekspor Excel dari angka yang sama dengan layar.
- Asisten Admin yang menjawab pertanyaan seperti "omzet minggu ini dibanding minggu lalu" dengan angka yang sama dengan Laporan, Kabar Harian tiap pagi, dan penulis deskripsi produk.
- Empat peran (owner, admin online, staf cabang, gudang) dengan izin yang bisa diatur per orang dan log aktivitas.

## Angka teknis

| Hal | Angka |
| --- | --- |
| Uji logika dan integrasi (Vitest) | 514 uji di 65 berkas |
| Uji alur pengguna (Playwright, Chrome dan WebKit) | 61 uji, termasuk aksesibilitas axe di 390 px dan 1.440 px, perayap tautan, gerak dikurangi, dan keamanan |
| Uji asap produksi hanya-baca | 8 pemeriksaan di HP dan desktop |
| Cakupan uji logika harga dan stok | harga 100%, inventory 97%, poin 100%, ongkir 98% (baris) |
| Evaluasi AI dengan model sungguhan | Advisor 22/22, tafsiran pencarian 6/6, foto dan link 15/15, Asisten Admin 122/122 pertanyaan di 4 peran |
| Lighthouse HP, Performance (4G tersimulasi, build lokal) | beranda 91, katalog 85, produk 96 lewat HTTP/1.1; 93, 93, 94 lewat HTTP/2 seperti di Vercel. Aksesibilitas 97 sampai 100. |
| Waktu reset data demo | 2,6 detik di laptop (989 kueri). Dari Vercel ke Neon belum diukur. |
| Data demo | 79 produk, 228 varian, 4 lokasi, riwayat 1.350 pesanan dari 150 pelanggan |
| Biaya AI | sekitar Rp 75 per pertanyaan Asisten Admin, sekitar Rp 29 per Kabar Harian |
| Keamanan | CSP ditegakkan, uji otorisasi untuk semua aksi admin, `npm audit` produksi nol temuan |

## Pelajaran

- **Pisahkan data uji sejak hari pertama.** Uji sempat menulis ke database yang juga dipakai untuk tangkapan layar, sehingga produk bernama "Uji" muncul di gambar review. Sekarang uji memakai database sendiri, dan alat tangkapan layar menolak jalan bila menemukan data uji.
- **Uji yang menyentuh database sungguhan menemukan bug yang tidak terlihat di uji unit.** Pembatas laju lolos uji unit, tetapi gagal begitu dijalankan ke Postgres karena cara driver mengirim tanggal. Uji integrasi kecil menemukannya sebelum rilis.
- **Ukur kecepatan dengan beberapa cara.** Simulasi Lighthouse di laptop (HTTP/1.1) dan kondisi Vercel (HTTP/2) memberi angka berbeda untuk halaman yang sama. Keputusan diambil setelah melihat keduanya, bukan satu angka.
- **AI paling berguna saat dibatasi.** Jawaban terbaik datang dari model yang hanya boleh memakai hasil tool dan diperiksa angkanya, bukan dari prompt yang panjang.
- **Konfigurasi merek harus dijaga uji.** Uji yang menolak nama merek di luar konfigurasi membuat reskin benar-benar cukup mengubah satu tempat.

## Yang belum

Rona belum memakai payment gateway dan WhatsApp Business resmi (keduanya butuh akun milik toko), katalog dihitung di memori (cukup untuk puluhan produk, perlu dipindah ke SQL untuk ribuan), dan belum diuji oleh pembeli sungguhan. Daftar lengkapnya ada di docs/BACKLOG.md bagian "Untuk toko sungguhan".
