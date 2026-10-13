# Fase 4: Keranjang, checkout, pembayaran, pesanan

Model yang disarankan: Opus 5.

Baca dulu: CLAUDE.md (termasuk Aturan cache), docs/BRIEF.md bagian Keranjang, Checkout 3 langkah, Pembayaran sukses dan lacak, seluruh Logika bisnis (termasuk tabel transisi status dan Pengecualian Bayar di Toko), Model data, lalu docs/BACKLOG.md.

Ini fase logika uang. Kebenaran di atas segalanya: setiap angka uang dan stok dihitung ulang di server, setiap perubahan stok lewat modul inventory dan menulis stock_movements, dan setiap alur penting punya uji.

Pakai yang sudah ada: formatRupiah (dengan spasi tak putus), modul src/lib/pricing, src/lib/shipping (zona, berat tagih, kurir, adapter), src/lib/flash (termasuk ensureFlashSaleSlots), keranjang sisi klien dari Fase 2, ProductArt, dan komponen UI yang ada.

## 0. Fondasi waktu dan aturan tambahan

1. Buat helper waktu terpusat `src/lib/clock.ts` (fungsi `now()`) yang bisa diganti saat uji. Semua logika kedaluwarsa, cut-off, dan slot flash sale memakai helper ini, bukan `new Date()` langsung.
2. Tambahkan aturan berikut ke bagian Logika bisnis di docs/BRIEF.md (hanya menambah):
   - Gratis ongkir otomatis: bila subtotal setelah diskon minimal Rp 150.000, potongan ongkir sampai Rp 20.000. Tidak berlaku untuk kurir instan dan tidak relevan untuk Ambil di Toko.
   - Nomor pesanan berurutan per bulan: RONA-YYMM-000001, dibuat aman dari tabrakan saat ada pesanan bersamaan.

## 1. Keranjang di server

1. Tabel carts dan cart_items sesuai Model data. Tamu dikenali lewat cookie token httpOnly yang tahan lama; nanti di Fase 5 keranjang tamu digabung ke akun saat login (siapkan fungsi gabungnya sekarang, beserta uji).
2. Pindahkan isi keranjang sisi klien (localStorage dari Fase 2) ke server sekali saat pertama kali dimuat, lalu hapus versi lokal. Tombol tambah cepat, Tambah ke Keranjang, dan Tambah semua kini memanggil server action.
3. CartDrawer (laci dari kanan setelah menambah produk) dan halaman /keranjang:
   - Item per varian dengan ProductArt, nama, shade, harga satuan, ubah jumlah, hapus, Simpan untuk nanti.
   - Bilah progres gratis ongkir ("Tambah Rp 23.000 lagi untuk gratis ongkir").
   - Kolom kode voucher dengan pesan error yang jelas per alasan (kedaluwarsa, minimal belanja, kuota habis, tidak berlaku untuk produk ini, tidak bisa digabung flash sale).
   - Ringkasan: subtotal, diskon produk, diskon voucher, perkiraan ongkir "dihitung di checkout", total.
   - Validasi ulang harga dan stok setiap dibuka. Bila berubah (flash sale berakhir, stok berkurang, varian nonaktif), tampilkan pemberitahuan per item yang mudah dipahami dan sesuaikan jumlah otomatis.
4. Badge keranjang di header membaca jumlah dari server.

## 2. Mesin harga (src/lib/pricing)

Lengkapi sebagai fungsi murni yang menerima keranjang, waktu, voucher, poin, dan opsi pengiriman, lalu mengembalikan rincian lengkap per baris dan total.

- Urutan: harga efektif per varian (flash, promo, jual), subtotal, voucher, gratis ongkir otomatis, poin (maks 50% subtotal setelah voucher; UI poin baru muncul di Fase 5, logikanya sekarang), ongkir, total.
- Semua tipe dan syarat voucher di BRIEF.
- Batas beli flash sale per pembeli dan kuota slot.
- Pembulatan konsisten dalam rupiah bulat.

Minimal 25 uji Vitest, termasuk: flash sale berakhir di tengah checkout, kuota voucher habis, kuota voucher per pembeli, voucher persen dengan batas maksimal, voucher yang tidak boleh digabung flash sale, voucher cakupan merek atau kategori, gratis ongkir otomatis tepat di batas Rp 150.000, gratis ongkir tidak berlaku kurir instan, poin melebihi batas, total tidak pernah negatif.

## 3. Checkout 3 langkah (/checkout)

1. **Penerima dan alamat**: nama, nomor WA (validasi format Indonesia), email opsional. Alamat: provinsi, kota atau kabupaten, kecamatan, kode pos, alamat lengkap, pin peta opsional (Leaflet + OpenStreetMap). Atau pilih **Ambil di Toko**: tampilkan hanya cabang yang stoknya cukup untuk SEMUA item, dengan estimasi siap diambil.
   - Data wilayah: ambil dari dataset wilayah Indonesia yang terbuka, lalu simpan di repo sebagai data seed (JSON atau tabel), bukan dipanggil dari API luar saat runtime. Jawa Timur lengkap sampai kecamatan; provinsi lain cukup sampai kota atau kabupaten (kecamatan diisi bebas). Bila dataset tidak bisa diunduh, buat subset realistis dan catat di BACKLOG. Tiap kota dipetakan ke zona ongkir.
2. **Pengiriman**: kurir muncul setelah kecamatan atau kota dipilih, dengan harga, estimasi tiba, dan badge "Dikirim hari ini" bila sebelum 15.00 WIB pada Senin sampai Sabtu. Catatan untuk penjual.
3. **Pembayaran**: QRIS, Virtual Account (BCA, BNI, BRI, Mandiri), atau Bayar di Toko (hanya untuk Ambil di Toko). Voucher, ringkasan akhir, tombol Buat Pesanan.

Ringkasan pesanan selalu terlihat: kolom kanan menempel di desktop, ringkasan yang bisa dibuka di bawah layar HP. Stepper bisa kembali ke langkah sebelumnya tanpa kehilangan isian. Pesan error ditampilkan di dekat kolomnya.

## 4. Pembuatan pesanan (src/lib/orders)

Satu transaksi database:

1. Kunci baris inventory yang terlibat dengan SELECT FOR UPDATE, berurutan berdasarkan id supaya tidak terjadi deadlock.
2. Hitung ulang harga dengan mesin harga dan bandingkan dengan yang dilihat pembeli. Bila berbeda, batalkan dan kembalikan pesan yang jelas.
3. Cek stok tersedia (stok fisik dikurangi dipesan) di lokasi sumber. Sumber pesanan kirim: Gudang Online. Sumber ambil di toko: cabang yang dipilih.
4. Tambah kolom dipesan, tulis stock_movements jenis pesan, kurangi kuota flash sale, catat pemakaian voucher.
5. Buat order (dengan salinan alamat dan rincian harga), order_items (salinan nama, shade, harga, sumber harga), payment, dan nomor pesanan berurutan.
6. Kosongkan keranjang.

Uji integrasi: dua pembeli berebut stok terakhir secara bersamaan, hanya satu yang berhasil dan pesan untuk yang gagal jelas.

## 5. Pembayaran simulasi

1. QRIS: render QR dari payload dummy beserta nominal. VA: nomor dummy per bank. Masa berlaku 15 menit.
2. Halaman /bayar/[nomor]: hitung mundur, QR atau nomor VA dengan tombol salin, cara bayar per bank (akordeon), status yang diperbarui otomatis.
3. Satu pintu konfirmasi pembayaran bergaya webhook (route handler) dengan kunci idempoten, aman dipanggil dua kali tanpa dobel memproses.
4. Saat DEMO_MODE=true: tombol "Simulasikan pembayaran berhasil" di /bayar, dan tombol "Simulasikan staf: tandai lunas dan sudah diambil" di halaman pesanan Bayar di Toko. Di luar DEMO_MODE kedua tombol tidak ada dan route-nya menolak.
5. Saat dibayar: stok dipesan diubah jadi potongan stok fisik dan stock_movements jenis keluar.

## 6. Kedaluwarsa

1. Route yang dilindungi CRON_SECRET untuk membatalkan pesanan tak dibayar yang lewat batas waktu: melepas stok dipesan (stock_movements jenis lepas), mengembalikan kuota flash sale dan pemakaian voucher.
2. Pengecekan malas: setiap kali pesanan atau halaman bayar dibuka, cek kedaluwarsa dulu.
3. Pengecualian Bayar di Toko sesuai BRIEF (sampai jam tutup cabang pada hari kerja berikutnya).

## 7. State machine status pesanan

Implementasikan tabel transisi di BRIEF persis. Transisi tidak sah ditolak. Setiap transisi mencatat waktu, pelaku (sistem, pembeli, staf demo), dan alasan bila batal. Simpan riwayat untuk ditampilkan di lini masa.

## 8. Halaman setelah beli

1. Halaman sukses: nomor pesanan, ringkasan, langkah berikutnya, ajakan untuk tamu "Simpan pesanan ini ke akunmu" (tautan ke halaman segera hadir sampai Fase 5).
2. /pesanan/[nomor]: OrderTimeline, rincian item dan biaya, alamat atau cabang pengambilan, nomor resi bila ada (di demo dibuat dummy saat status Dikirim), tombol hubungi toko via WA. Tamu hanya bisa membuka pesanannya lewat tautan bertoken atau setelah verifikasi nomor WA.
3. /lacak: nomor pesanan + nomor WA, lalu tampilkan status tanpa login.

## 9. Notifikasi (outbox)

Setiap transisi penting (pesanan dibuat, dibayar, siap diambil, dikirim, selesai, dibatalkan) menulis baris ke tabel notifications berisi pratinjau pesan WA dan email dalam bahasa Indonesia yang hangat dan singkat. Belum dikirim ke mana pun. Siapkan fungsi pembacanya untuk Kotak Notifikasi Fase 5.

## 10. Uji

1. Vitest: mesin harga (minimal 25 kasus), state machine (semua transisi sah dan contoh yang ditolak), kedaluwarsa (dengan clock palsu), nomor pesanan berurutan, idempotensi konfirmasi pembayaran, gabung keranjang tamu.
2. Uji integrasi dengan database lokal: rebutan stok terakhir, kedaluwarsa melepas stok dan kuota.
3. Playwright:
   - Tamu membeli 2 produk berbeda shade dengan voucher, kirim ke Kota Malang, bayar QRIS simulasi, status jadi Dibayar, stok fisik berkurang.
   - Ambil di Toko Rona Dinoyo dengan Bayar di Toko, simulasi staf menandai lunas dan diambil, status jadi Selesai.
   - Pesanan dibiarkan kedaluwarsa (clock dimajukan), status Dibatalkan dan stok kembali.

## 11. Cuplik

Tambahkan aksi baru "alur-beli" pada skrip cuplik: secara otomatis menambah 2 produk ke keranjang, lalu memotret CartDrawer, /keranjang, ketiga langkah checkout, /bayar, halaman sukses, dan /pesanan, di 375 px dan 1440 px.

## Selesai

1. npm run db:reset, lint, typecheck, test (termasuk integrasi), build, dan uji Playwright.
2. Jalankan: `npm run cuplik -- --nama=fase4 --halaman=/keranjang --aksi=alur-beli`
3. Jangan buka gambarnya.
4. Perbarui docs/BACKLOG.md bila ada temuan.
5. Commit dengan pesan "feat: keranjang, checkout, pembayaran, pesanan (fase 4)".
6. Laporkan: yang dibuat, keputusan yang kamu ambil sendiri, hasil semua uji (jumlah dan yang dilewati), file cuplik, dan yang perlu aku cek manual.
