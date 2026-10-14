// Sakelar fitur per klien (Fase 8B). Ubah nilai di FITUR untuk toko klien; untuk uji, env NEXT_PUBLIC_FITUR_NONAKTIF
// (daftar dipisah koma, misal "flashSale,poin") mematikan fitur tanpa mengubah berkas. Env ini dibaca saat build
// (ikut tertanam di kode klien), jadi setelah mengubahnya jalankan ulang npm run build.
//
// Bila sebuah fitur mati: menu, halaman, dan tool AI terkait ikut tersembunyi, dan server menolak aksinya
// (misal harga flash tidak dipakai, poin tidak bisa ditukar, metode Ambil di Toko ditolak).

export const DAFTAR_FITUR = ["aiPembeli", "aiFotoLink", "asistenAdmin", "flashSale", "poin", "ambilDiToko", "multiCabang"] as const;
export type Fitur = (typeof DAFTAR_FITUR)[number];

export const LABEL_FITUR: Record<Fitur, string> = {
  aiPembeli: "AI untuk pembeli (Advisor, tafsiran pencarian, ringkasan ulasan, rutinitas)",
  aiFotoLink: "AI dari foto dan link (kuis dari foto, cari dari video)",
  asistenAdmin: "AI untuk admin (Asisten Admin, Kabar Harian, penulis deskripsi, draf balasan)",
  flashSale: "Flash sale",
  poin: "Poin pembeli",
  ambilDiToko: "Ambil di Toko",
  multiCabang: "Banyak cabang (stok per cabang, transfer, Toko Kami)",
};

export const FITUR: Record<Fitur, boolean> = {
  aiPembeli: true,
  aiFotoLink: true,
  asistenAdmin: true,
  flashSale: true,
  poin: true,
  ambilDiToko: true,
  multiCabang: true,
};

// Ketergantungan: AI foto dan link butuh AI pembeli; Ambil di Toko butuh cabang.
const BUTUH: Partial<Record<Fitur, Fitur>> = { aiFotoLink: "aiPembeli", ambilDiToko: "multiCabang" };

export function parseNonaktif(raw: string | undefined): Set<Fitur> {
  const set = new Set<Fitur>();
  for (const s of (raw ?? "").split(",").map((x) => x.trim())) if ((DAFTAR_FITUR as readonly string[]).includes(s)) set.add(s as Fitur);
  return set;
}

// NEXT_PUBLIC_ supaya nilainya sama di server dan di peramban.
const NONAKTIF = parseNonaktif(process.env.NEXT_PUBLIC_FITUR_NONAKTIF);

export function fiturAktif(f: Fitur, fitur: Record<Fitur, boolean> = FITUR, nonaktif: Set<Fitur> = NONAKTIF): boolean {
  if (!fitur[f] || nonaktif.has(f)) return false;
  const butuh = BUTUH[f];
  return butuh ? fiturAktif(butuh, fitur, nonaktif) : true;
}

export const semuaFitur = (fitur: Record<Fitur, boolean> = FITUR, nonaktif: Set<Fitur> = NONAKTIF) => Object.fromEntries(DAFTAR_FITUR.map((f) => [f, fiturAktif(f, fitur, nonaktif)])) as Record<Fitur, boolean>;
