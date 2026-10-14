// Satu sumber teks halaman bantuan dan kebijakan toko (Fase 8A): FAQ, cara belanja, syarat, pengiriman, privasi, kontak.
// Dipakai halaman /faq, /cara-belanja, /kebijakan/*, /hubungi, dan bisa dibaca fitur lain supaya tidak ada dua versi teks.
import { RETURN_POLICY } from "./return-policy";

export type HelpLink = { href: string; label: string };
export const HELP_LINKS: HelpLink[] = [
  { href: "/cara-belanja", label: "Cara belanja" },
  { href: "/cek-ongkir", label: "Cek ongkir" },
  { href: "/lacak", label: "Lacak pesanan" },
  { href: "/faq", label: "Pertanyaan umum" },
  { href: "/toko", label: "Toko kami" },
  { href: "/hubungi", label: "Hubungi kami" },
];
export const POLICY_LINKS: HelpLink[] = [
  { href: "/kebijakan/retur", label: "Kebijakan retur" },
  { href: "/kebijakan/privasi", label: "Kebijakan privasi" },
  { href: "/kebijakan/syarat", label: "Syarat dan ketentuan" },
  { href: "/kebijakan/pengiriman", label: "Pengiriman" },
];

export type Section = { title: string; paragraphs?: string[]; items?: string[] };

export const CARA_BELANJA: { title: string; text: string }[] = [
  { title: "Cari produk yang kamu mau", text: "Ketik nama produk, merek, atau kategori di kotak cari. Salah ketik sedikit tidak apa-apa. Kamu juga bisa menulis kalimat, misalnya \"sunscreen yang ga lengket buat kulit berminyak\", atau bertanya ke Rona Advisor." },
  { title: "Pilih shade dan cek stoknya", text: "Di halaman produk, pilih shade dengan swatch warna. Stok tiap cabang dan Gudang Online tampil apa adanya. Belum yakin shade-nya? Pakai Cari shade-ku atau Padanan Shade." },
  { title: "Masukkan ke keranjang", text: "Tekan Tambah ke Keranjang. Harga, promo, dan voucher selalu dihitung ulang di server saat checkout, jadi yang kamu lihat di keranjang itulah yang kamu bayar." },
  { title: "Checkout 3 langkah", text: "Alamat, Pengiriman, lalu Pembayaran. Pilih Kirim ke alamatmu atau Ambil di Toko di cabang yang punya stoknya. Ongkir muncul setelah kecamatan dipilih, lengkap dengan estimasi tiba." },
  { title: "Bayar dan lacak", text: "Bayar lewat QRIS, Virtual Account, atau Bayar di Toko untuk pesanan ambil. Setelah lunas, pesananmu bisa dilacak di halaman Lacak pesanan atau di akunmu." },
  { title: "Terima, lalu ulas", text: "Rekam video unboxing saat paket datang (jaga-jaga untuk retur). Setelah pesanan selesai, beri ulasan dan dapatkan poin." },
];

export const FAQ: { q: string; a: string }[] = [
  { q: "Apakah ini toko sungguhan?", a: "Bukan. Rona Beauty adalah toko demo dengan data fiktif: merek, produk, harga, cabang, ulasan, dan pesanan di sini dibuat untuk memamerkan fitur. Tidak ada barang yang dikirim dan tidak ada uang yang berpindah. Lihat halaman Tentang demo." },
  { q: "Bagaimana cara tahu shade yang cocok untukku?", a: "Pakai Cari shade-ku di halaman produk (pilih kedalaman dan undertone kulitmu), atau Padanan Shade untuk mencari shade yang mirip dengan produk yang sudah kamu pakai. Hasilnya berupa 3 shade terdekat beserta alasannya." },
  { q: "Apakah produk yang habis bisa dipesan?", a: "Belum bisa, tapi kamu bisa menekan Kabari aku di shade yang habis. Kami beri tahu lewat WhatsApp atau email saat stoknya kembali. Kamu juga bisa melihat shade lain yang tersedia dan stok di cabang lain." },
  { q: "Bisa ambil di toko?", a: "Bisa. Pilih Ambil di Toko saat checkout di cabang yang punya stok semua barangmu. Pesanan sebelum pukul 16.00 WIB saat toko buka biasanya siap diambil sekitar 2 jam setelah dipesan. Bayar di tempat juga tersedia untuk pesanan ambil." },
  { q: "Kapan pesanan dikirim?", a: "Pesanan yang lunas sebelum pukul 15.00 WIB (Senin sampai Sabtu) dikirim hari itu juga dari Gudang Online. Estimasi tiba tampil saat kamu memilih kurir." },
  { q: "Bagaimana cara membayar?", a: "QRIS, Virtual Account BCA, BNI, BRI, dan Mandiri, atau Bayar di Toko untuk pesanan ambil. Di demo ini pembayaran disimulasikan: tekan tombol simulasi bayar di halaman pembayaran." },
  { q: "Bisa pakai voucher dan poin bersamaan?", a: "Bisa. Voucher dipakai dulu, lalu poin memotong sisa belanja. Poin didapat dari pesanan yang selesai dan dari ulasan pertama. Semua perhitungan dilakukan di server saat checkout." },
  { q: "Bagaimana kalau barang yang datang rusak atau salah?", a: `Ajukan retur maksimal 2 x 24 jam setelah paket sampai, dengan video unboxing tanpa jeda dari paket masih tersegel. ${RETURN_POLICY.scope} Baca selengkapnya di Kebijakan retur.` },
  { q: "Apakah foto yang kukirim ke fitur AI disimpan?", a: "Tidak. Foto untuk bantu isi kuis dan screenshot untuk cari dupe hanya diproses di memori lalu dibuang. Rinciannya ada di Kebijakan privasi bagian foto dan link." },
  { q: "Bagaimana cara masuk akun?", a: "Masuk dengan nomor WhatsApp dan kode OTP. Di demo ini kode OTP tampil di layar, atau pakai tombol Masuk sebagai Pembeli Demo di halaman Tentang demo." },
];

export const PENGIRIMAN: Section[] = [
  { title: "Dari mana pesanan dikirim", paragraphs: ["Semua pesanan kirim berangkat dari Gudang Online di Malang. Stok cabang tidak dikirim ke alamat; cabang melayani Ambil di Toko."] },
  { title: "Kurir dan estimasi", items: ["JNE REG, JNE YES, J&T EZ, dan SiCepat REG untuk seluruh Indonesia.", "Kurir Instan untuk Kota Malang, Senin sampai Sabtu pukul 08.00 sampai 17.00 WIB.", "Estimasi tiba tampil di checkout setelah kecamatan dipilih. Ongkir dihitung per kg dengan toleransi 300 gram."] },
  { title: "Kapan dikirim", items: ["Lunas sebelum 15.00 WIB, Senin sampai Sabtu: dikirim hari itu juga.", "Lunas setelah cut-off atau hari Minggu: dikirim hari kerja berikutnya.", "Nomor resi muncul di halaman pesanan dan dikirim lewat notifikasi."] },
  { title: "Gratis ongkir", paragraphs: ["Belanja di atas batas minimal mendapat potongan ongkir otomatis sampai nilai maksimal yang berlaku. Voucher gratis ongkir mengikuti syarat masing-masing voucher."] },
  { title: "Kemasan", paragraphs: ["Semua produk dikemas dengan bubble wrap dan segel. Simpan video unboxing supaya retur mudah diproses bila ada masalah."] },
];

export const SYARAT: Section[] = [
  { title: "Tentang layanan ini", paragraphs: ["Rona Beauty adalah toko demo. Semua produk, harga, stok, cabang, dan transaksi bersifat fiktif dan dapat direset setiap hari. Dengan memakai situs ini, kamu memahami bahwa tidak ada barang yang dikirim dan tidak ada pembayaran sungguhan."] },
  { title: "Akun", items: ["Akun dibuat dengan nomor WhatsApp dan kode OTP. Jaga kerahasiaan kode OTP.", "Kamu bertanggung jawab atas aktivitas di akunmu. Keluar dari semua perangkat tersedia di halaman Profil."] },
  { title: "Harga, promo, dan stok", items: ["Harga yang berlaku adalah harga saat pesanan dibuat, dihitung ulang di server.", "Flash sale punya kuota dan batas per pembeli. Voucher punya masa berlaku, kuota, dan minimal belanja.", "Stok dipesan saat pesanan dibuat dan dilepas bila pesanan kedaluwarsa atau dibatalkan."] },
  { title: "Pesanan dan pembayaran", items: ["Pesanan yang belum dibayar sampai batas waktunya dibatalkan otomatis.", "Pesanan ambil di toko yang tidak diambil dalam 3 hari setelah siap bisa dibatalkan oleh toko.", "Pesanan yang sudah dikirim otomatis dianggap selesai 3 hari setelah tanggal kirim bila tidak ada laporan."] },
  { title: "Retur", paragraphs: [`${RETURN_POLICY.window} ${RETURN_POLICY.scope}`] },
  { title: "Konten dan AI", items: ["Ulasan yang melanggar aturan (kasar, promosi, atau tidak terkait produk) bisa disembunyikan oleh moderator.", "Jawaban Rona Advisor dan fitur AI lain bisa keliru; produk dan harga selalu diambil dari katalog, bukan dari jawaban AI."] },
];

export const PRIVASI: Section[] = [
  { title: "Data yang kami kumpulkan", items: ["Akun dan pesanan: nama, nomor WhatsApp, email (opsional), alamat, dan isi pesanan yang kamu buat.", "Profil kulit dari kuis atau formulir: jenis kulit, masalah kulit, sensitivitas, budget, warna kulit, dan rutinitas. Tersimpan di akunmu, atau di perangkat ini (cookie) bila belum masuk.", "Pemakaian fitur AI: jenis fitur, jumlah token, lama proses, dan berhasil atau tidak, dengan penanda pengunjung yang sudah diacak. Isi percakapan Rona Advisor tidak disimpan di database Rona; riwayatnya hanya ada di browsermu.", "Catatan teknis: alamat IP yang diacak untuk membatasi percobaan OTP, dan log kesalahan tanpa data pribadi."] },
  { title: "Foto dan link yang kamu kirim", items: ["Semua fitur ini opsional. Kuis kulit, pencarian, dan belanja tetap bisa dipakai tanpa foto atau link.", "Foto wajah untuk bantu isi kuis hanya dipakai untuk memperkirakan kondisi kulit yang terlihat. Foto diperkecil dan metadatanya dibuang di perangkatmu sebelum dikirim, diproses di memori, lalu langsung dibuang. Tidak disimpan di server, database, penyimpanan berkas, atau log.", "AI tidak menilai usia, jenis kelamin, etnis, atau identitas, dan tidak memberi diagnosis atau saran pengobatan. Hasilnya hanya usulan jawaban kuis yang bisa kamu ubah.", "Screenshot untuk cari dupe diperlakukan sama: diproses lalu dibuang.", "Link TikTok atau YouTube: kami hanya mengambil judul atau caption, nama kreator, dan alamat gambar sampul dari layanan oEmbed resmi platform itu. Video tidak diunduh, sampul tidak disimpan. Hasil pengenalan produk (teks saja) disimpan 7 hari per link.", "Foto, screenshot, dan teks dikirim ke penyedia AI (Google Gemini lewat Cloudflare AI Gateway) hanya untuk diproses saat itu. Untuk foto dan screenshot, isi permintaan tidak dicatat di log gateway."] },
  { title: "Cookie", items: ["Cookie sesi untuk akun pembeli dan staf, cookie keranjang, cookie profil kulit tamu, dan penanda pengunjung acak untuk batas pemakaian AI.", "Penyimpanan browser (localStorage) untuk wishlist tamu, riwayat pencarian, riwayat chat, dan panduan demo. Tidak ada cookie iklan atau pelacak pihak ketiga."] },
  { title: "Hakmu sesuai UU Pelindungan Data Pribadi", items: ["Mengakses dan memperbaiki datamu lewat halaman Akun.", "Menghapus profil kulit dan alamat tersimpan kapan saja dari halaman Akun.", "Meminta penghapusan akun beserta datanya lewat kontak di bawah. Data pesanan yang wajib disimpan untuk pembukuan dianonimkan.", "Menarik persetujuan pemakaian foto: tidak ada yang perlu ditarik karena foto tidak pernah disimpan."] },
  { title: "Kontak", paragraphs: ["Karena ini toko demo, tidak ada petugas pelindungan data sungguhan. Untuk pertanyaan tentang demo ini, hubungi studio pembuatnya lewat halaman Hubungi kami."] },
];
