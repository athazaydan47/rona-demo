// chat asisten satu pintu (Fase 8C): jenis kartu dan aksi yang dipertukarkan antara server dan panel chat. Hanya tipe
// dan konstanta, aman diimpor dari komponen klien. Semua isi kartu dibangun server dari fungsi toko yang sama dengan
// halaman biasa (katalog, rutinitas, padanan shade, lacak, ongkir, cabang, promo, bantuan), bukan dari teks model.
import type { Packaging } from "@/db/schema/enums";
import type { FitResult } from "@/lib/skin/rules";
import type { QuizAnswers } from "@/lib/skin/profile";
import type { KartuPesananData } from "@/lib/orders/lacak";
import type { KotaTujuan } from "@/lib/regions";
import { MEREK } from "@/config/merek";

export type VarianKartu = { id: number; shadeName: string; hex: string; price: number; normalPrice: number; inStock: boolean };
export type ProdukKartu = {
  id: number;
  name: string;
  slug: string;
  brandName: string;
  brandColor: string;
  packaging: Packaging;
  price: number;
  normalPrice: number;
  primaryHex: string;
  variantCount: number;
  variants: VarianKartu[];
  stokOnline: number;
  cabang: string[];
  alasan?: string;
  varianPilihan?: number | null;
};

export type SumberVideo = { platform: "tiktok" | "youtube"; url: string; title: string; author: string | null; authorUrl: string | null; thumbnailUrl: string | null };
export type DupeTipe = "cocok" | "mirip" | "tidak_ada_sejenis" | "tidak_dikenali";

export type LangkahRutinitas = { key: string; label: string; options: { productId: number; variantId: number; slug: string; name: string; brandName: string; brandColor: string; packaging: Packaging; hex: string; price: number; normalPrice: number; onlineStock: number }[] };
export type RutinitasKartu = { pagi: LangkahRutinitas[]; malam: LangkahRutinitas[]; inti: LangkahRutinitas[]; warnings: { id: string; text: string }[]; intiWarnings: { id: string; text: string }[]; defaultMode: "lengkap" | "inti"; ringkasan: string };

export type ShadeHasil = { produk: ProdukKartu; shade: string; hex: string; alasan: string };
export type OngkirKartu = { kota: string; provinsi: string; zona: string; beratGram: number; opsi: { kode: string; nama: string; harga: number; eta: string }[]; ambilDiToko: boolean; gratisOngkir: string | null };
export type CabangKartu = { slug: string; nama: string; alamat: string; telepon: string; hariIni: string; bukaSekarang: boolean; rute: string; bisaAmbil: boolean };
export type FlashKartu = { nama: string; berjalan: boolean; mulai: string; selesai: string; selesaiIso: string; item: { produk: ProdukKartu; hargaFlash: number; sisa: number }[] };
export type VoucherKartu = { kode: string; judul: string; deskripsi: string; minimal: number };

export type Kartu =
  | { jenis: "produk"; produk: ProdukKartu[]; total: number | null }
  | { jenis: "dupe"; sumber: SumberVideo | null; tipe: DupeTipe; namaTerbaca: string | null; jenisProduk: string | null; produk: ProdukKartu[] }
  | { jenis: "unggah"; alasan: string }
  | { jenis: "video" }
  | { jenis: "rutinitas"; data: RutinitasKartu }
  | { jenis: "shade"; sumber: { produk: string; shade: string; hex: string }; hasil: ShadeHasil[] }
  | { jenis: "pilih_shade"; teks?: string }
  | { jenis: "pesanan"; data: KartuPesananData }
  | { jenis: "form_lacak"; masuk: boolean; nomor?: string; pesanan?: { nomor: string; status: string }[] }
  | { jenis: "ongkir"; data: OngkirKartu }
  | { jenis: "pilih_kota"; pilihan: KotaTujuan[] }
  | { jenis: "cabang"; cabang: CabangKartu[] }
  | { jenis: "promo"; flash: FlashKartu | null; voucher: VoucherKartu[] }
  | { jenis: "info"; judul: string; paragraf: string[]; tautan: { href: string; label: string } | null }
  | { jenis: "cocok"; produk: { id: number; nama: string; slug: string }; fit: FitResult | null }
  | { jenis: "kuis"; awal: QuizAnswers; foto: boolean };

export type TopikBantuan = "retur" | "bayar" | "kirim" | "faq" | "kontak";

// Aksi terstruktur dari chip dan kartu interaktif: selalu ditangani berbasis aturan, tanpa model.
export type Aksi =
  | { jenis: "rekomendasi" }
  | { jenis: "kuis" }
  | { jenis: "rutinitas" }
  | { jenis: "video" }
  | { jenis: "shade"; varianId?: number }
  | { jenis: "lacak"; nomor?: string; wa?: string }
  | { jenis: "ongkir"; kota?: string; kode?: string }
  | { jenis: "cabang" }
  | { jenis: "promo" }
  | { jenis: "bantuan"; topik: TopikBantuan }
  | { jenis: "cocok"; produkId?: number };

export type Chip = { label: string; aksi: Aksi };

// Peristiwa yang dialirkan route sebagai NDJSON.
export type TanyaEvent = { type: "status"; text: string } | { type: "pembuka"; text: string } | { type: "delta"; text: string } | { type: "reset" } | { type: "done"; ok: boolean; teks: string; kartu: Kartu[]; chips: Chip[] };

// Chip pintu masuk di layar pembuka. Chip yang butuh AI atau fitur tertentu disaring di panel.
export const CHIP_PEMBUKA: (Chip & { butuh?: "aiFoto" | "multiCabang" })[] = [
  { label: "Rekomendasi sesuai kulitku", aksi: { jenis: "rekomendasi" } },
  { label: "Cari yang mirip dari video", aksi: { jenis: "video" }, butuh: "aiFoto" },
  { label: "Cari padanan shade", aksi: { jenis: "shade" } },
  { label: "Lacak pesananku", aksi: { jenis: "lacak" } },
  { label: "Cek ongkir", aksi: { jenis: "ongkir" } },
  { label: "Jam buka cabang", aksi: { jenis: "cabang" }, butuh: "multiCabang" },
  { label: "Promo hari ini", aksi: { jenis: "promo" } },
];

export const CHIP_PRODUK = (produkId: number): Chip[] => [
  { label: "Cocok buat kulitku?", aksi: { jenis: "cocok", produkId } },
  { label: "Cari padanan shade", aksi: { jenis: "shade" } },
  { label: "Cek ongkir", aksi: { jenis: "ongkir" } },
];

// Judul hasil cari dupe (satu sumber untuk halaman Cari dari video dan kartu dupe di chat asisten).
export function judulDupe(d: { tipe: DupeTipe; namaTerbaca: string | null; jenisProduk: string | null }): string {
  if (d.tipe === "cocok") return `Ada di ${MEREK.nama}: ${d.namaTerbaca}`;
  if (d.tipe === "mirip") return d.namaTerbaca ? `${MEREK.nama} tidak menjual ${d.namaTerbaca}, ini yang paling mirip` : `Ini yang paling mirip di ${MEREK.nama}${d.jenisProduk ? ` untuk ${d.jenisProduk}` : ""}`;
  if (d.tipe === "tidak_ada_sejenis") return `${MEREK.nama} belum punya produk sejenis ini`;
  return "Produknya belum bisa kami kenali";
}
