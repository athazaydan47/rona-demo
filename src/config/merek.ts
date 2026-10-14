// Konfigurasi merek (Fase 8B): satu-satunya tempat nama toko, palet, kontak, studio, dan teks demo. Untuk toko klien,
// ubah berkas ini (plus src/config/font.ts dan src/config/fitur.ts), konten di src/lib/content, dan seed di src/db/seed.
// Langkah lengkapnya ada di docs/RESKIN.md. Uji src/config/merek.test.ts memastikan nama merek tidak tertanam di kode lain.

export type Palet = {
  porselen: string; // latar halaman
  putih: string; // kartu, laci, dialog
  kopi: string; // teks utama
  abuHangat: string; // teks sekunder
  garis: string; // garis dan border
  aksen: string; // warna utama: tombol, tautan aktif
  aksenGelap: string; // tombol saat ditekan, teks aksen kecil
  blush: string; // latar lembut, chip terpilih
  sage: string;
  emas: string;
  sukses: string;
  peringatan: string;
  bahaya: string;
  peringatanTeks: string; // varian teks AA untuk latar terang
  sageTeks: string;
  emasTeks: string;
};

export const MEREK = {
  // Kunci teknis huruf kecil tanpa spasi: awalan cookie, localStorage, nama berkas unduhan, dan header webhook.
  // Mengubahnya membuat sesi, keranjang, dan wishlist pengunjung lama tidak terbaca lagi.
  kunci: "rona",
  nama: "Rona", // nama pendek: logo, sapaan "tim Rona"
  namaLengkap: "Rona Beauty",
  subLogo: "Beauty", // teks kecil di samping logo toko
  tagline: "Temukan rona terbaikmu.",
  deskripsi: "Toko kosmetik demo multi-merek dengan data fiktif: shade yang pas, stok per cabang, dan rekomendasi dari katalog sendiri.",
  deskripsiFooter: "Toko kosmetik multi-merek dengan tiga cabang di Malang dan toko online. Cocok dulu, baru beli.",
  kategoriToko: "toko kosmetik",
  // Awalan nomor pesanan, misal RONA-2610-000123. Hanya huruf kapital.
  prefiksPesanan: "RONA",
  // Asisten belanja AI untuk pembeli.
  asisten: { nama: "Rona Advisor", tombol: "Tanya Rona" },
  kontak: {
    whatsapp: "6281200000000",
    email: "halo@rona.demo",
    alamat: "Jl. Veteran No. 8 (fiktif)",
    kota: "Malang",
    instagram: "",
    tiktok: "",
  },
  // Domain email akun staf demo (owner@, admin@, dinoyo@, gudang@).
  domainDemo: "rona.demo",
  // Kredit pembuat; env STUDIO_NAME, STUDIO_URL, dan STUDIO_WA mengalahkan nilai ini.
  studio: { nama: "Studio", url: "", wa: "" },
  pitaDemo: "Toko demo: produk, harga, dan pesanan fiktif, direset tiap malam.",
  palet: {
    porselen: "#faf7f5",
    putih: "#ffffff",
    kopi: "#2a1f1d",
    abuHangat: "#6e615d",
    garis: "#eae2de",
    aksen: "#b8475d",
    aksenGelap: "#93364a",
    blush: "#f4dcdf",
    sage: "#8fa58e",
    emas: "#c9a35c",
    sukses: "#2f7a55",
    peringatan: "#c77d1a",
    bahaya: "#b3261e",
    peringatanTeks: "#8a5512",
    sageTeks: "#4f6a4e",
    emasTeks: "#866a36",
  } satisfies Palet,
  // Gaya ProductArt: latar packshot (dicampur dengan warna shade) dan sudut kartu gambar.
  productArt: { latarAtas: "#FAF7F5", latarBawah: "#EFE6E1", sudut: 16 },
} as const;

export type Merek = typeof MEREK;

// Nama variabel CSS per warna palet, sama dengan token @theme di src/app/globals.css (misal --color-aksen).
export const TOKEN_WARNA: Record<keyof Palet, string> = {
  porselen: "porselen",
  putih: "putih",
  kopi: "kopi",
  abuHangat: "abu-hangat",
  garis: "garis",
  aksen: "aksen",
  aksenGelap: "aksen-gelap",
  blush: "blush",
  sage: "sage",
  emas: "emas",
  sukses: "sukses",
  peringatan: "peringatan",
  bahaya: "bahaya",
  peringatanTeks: "peringatan-teks",
  sageTeks: "sage-teks",
  emasTeks: "emas-teks",
};

// CSS yang menimpa token warna dari konfigurasi, disisipkan root layout di <head>.
export function temaCss(palet: Palet = MEREK.palet) {
  const vars = (Object.keys(TOKEN_WARNA) as (keyof Palet)[]).map((k) => `--color-${TOKEN_WARNA[k]}:${palet[k]}`).join(";");
  return `:root{${vars}}`;
}

// Nomor pesanan: PREFIKS-YYMM-urutan (urutan minimal 6 digit).
export const POLA_NOMOR_PESANAN = new RegExp(`^${MEREK.prefiksPesanan}-(\\d{4})-(\\d{6,})$`);
export const POLA_NOMOR_PESANAN_DI_TEKS = new RegExp(`${MEREK.prefiksPesanan}-\\d{4}-\\d{6}`, "i");
export const contohNomorPesanan = (urut = 123) => `${MEREK.prefiksPesanan}-2610-${String(urut).padStart(6, "0")}`;

// Kunci penyimpanan browser dan cookie berawalan kunci merek.
export const kunciLokal = (nama: string) => `${MEREK.kunci}.${nama}`;
export const namaCookie = (nama: string) => `${MEREK.kunci}_${nama}`;
export const namaEvent = (nama: string) => `${MEREK.kunci}:${nama}`;
