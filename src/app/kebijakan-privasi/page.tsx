import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kebijakan privasi", description: "Data apa yang disimpan Rona Beauty (toko demo), termasuk foto dan link yang kamu kirim ke fitur AI." };

// Versi sederhana (Fase 7C). Fase 8 melengkapi bagian lain.
export default function PrivacyPage() {
  return (
    <section className="container-rona max-w-3xl py-10 md:py-16">
      <p className="text-xs font-semibold tracking-wide text-rona uppercase">Kebijakan privasi</p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">Data kamu di Rona Beauty</h1>
      <p className="mt-4 text-abu-hangat">
        Rona Beauty adalah toko demo dengan data fiktif (
        <Link href="/tentang-demo" className="font-semibold text-rona hover:underline">
          tentang demo
        </Link>
        ). Meski begitu, kami memperlakukan data yang kamu masukkan dengan hati-hati. Halaman ini versi ringkas dan akan dilengkapi.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-kopi">
        <section>
          <h2 className="font-serif text-2xl">Yang kami simpan</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Akun dan pesanan: nama, nomor HP, alamat, dan isi pesanan yang kamu buat.</li>
            <li>Profil kulit dari kuis: jenis kulit, masalah kulit, sensitivitas, budget, warna kulit, dan rutinitas. Tersimpan di akunmu, atau di perangkat ini (cookie) bila belum masuk.</li>
            <li>Pemakaian fitur AI: jenis fitur, jumlah token, lama proses, dan berhasil atau tidak, dengan penanda pengunjung yang sudah diacak. Isi percakapan Rona Advisor tidak disimpan di database Rona; riwayatnya hanya ada di browsermu. Log gateway penyedia AI bisa mencatat teks percakapan untuk memantau gangguan.</li>
          </ul>
        </section>

        <section id="foto" className="scroll-mt-28">
          <h2 className="font-serif text-2xl">Foto dan link yang kamu kirim</h2>
          <p className="mt-2">Semua fitur ini opsional. Kuis kulit, pencarian, dan belanja tetap bisa dipakai tanpa foto atau link.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Foto wajah untuk bantu isi kuis</strong> hanya dipakai untuk memperkirakan kondisi kulit yang terlihat (kilap, kesan kering, kemerahan, noda, warna kulit, undertone). Foto diperkecil dan metadatanya (misal lokasi) dibuang di
              perangkatmu sebelum dikirim, diproses di memori, lalu langsung dibuang. Foto tidak disimpan di server, database, penyimpanan berkas, atau log.
            </li>
            <li>AI tidak menilai usia, jenis kelamin, etnis, atau identitas, dan tidak memberi diagnosis atau saran pengobatan. Hasilnya hanya usulan jawaban kuis yang bisa kamu ubah. Ini bukan pemeriksaan medis.</li>
            <li>
              <strong>Screenshot untuk cari dupe</strong> diperlakukan sama: diproses lalu dibuang, tidak disimpan.
            </li>
            <li>
              <strong>Link TikTok atau YouTube</strong>: kami hanya mengambil judul atau caption, nama kreator, dan alamat gambar sampul dari layanan oEmbed resmi platform itu. Video tidak diunduh. Sampul ditampilkan langsung dari server
              platform dan tidak disimpan. Hasil pengenalan produk (teks saja, misal kategori dan warna) disimpan 7 hari per link supaya link yang sama tidak diproses ulang.
            </li>
            <li>Foto, screenshot, dan teks dikirim ke penyedia AI (Google Gemini, lewat Cloudflare AI Gateway) hanya untuk diproses saat itu. Untuk foto dan screenshot, isi permintaan tidak dicatat di log gateway.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Pertanyaan</h2>
          <p className="mt-2">Karena ini toko demo, tidak ada layanan pelanggan sungguhan. Untuk pertanyaan tentang demo ini, lihat halaman Tentang demo.</p>
        </section>
      </div>
    </section>
  );
}
