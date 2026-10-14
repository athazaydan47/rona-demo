// Label manusiawi untuk kunci hasil tool Asisten Admin. Model menerima kunci mentah (ringkas untuk token), tetapi tabel
// yang tampil ke staf selalu berjudul bahasa Indonesia: tidak ada camelCase atau snake_case yang bocor ke layar.
import { formatRupiah } from "@/lib/format";

export const KEY_LABELS: Record<string, string> = {
  nama: "Nama",
  produk: "Produk",
  merek: "Merek",
  kategori: "Kategori",
  pesanan: "Pesanan",
  unit: "Unit",
  penjualanBarangRp: "Penjualan barang",
  nilaiPesananRp: "Nilai pesanan",
  persenNilai: "Persen",
  omzetRp: "Omzet",
  rataRataPesananRp: "Rata-rata pesanan",
  shade: "Shade",
  sku: "SKU",
  lokasi: "Lokasi",
  tersedia: "Tersedia",
  dipesan: "Dipesan",
  peminat: "Peminat",
  dari: "Dari",
  ke: "Ke",
  jumlah: "Jumlah",
  alasan: "Alasan",
  nomor: "Nomor",
  status: "Status",
  cabang: "Cabang",
  dibuat: "Dibuat",
  totalRp: "Total",
  jumlahBarang: "Barang",
  nomorWa: "Nomor WA",
  metode: "Metode",
  kode: "Kode",
  judul: "Judul",
  potonganRp: "Potongan",
  kuota: "Kuota",
  terpakai: "Terpakai",
  slot: "Slot",
  mulai: "Mulai",
  terjual: "Terjual",
  hargaNormalRp: "Harga normal",
  hargaFlashRp: "Harga flash",
  diskonPersen: "Diskon",
  bintang: "Bintang",
  penulis: "Penulis",
  cuplikan: "Cuplikan",
  habis: "Habis",
  menipis: "Menipis",
  periode: "Periode",
  varian: "Varian",
  waktu: "Waktu",
  detail: "Detail",
  langkah: "Langkah",
};

// Kunci bergaya mesin: camelCase, snake_case, atau berakhiran Rp tanpa spasi.
export const looksMachine = (s: string) => /^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(s) || /^[a-z0-9]+(_[a-z0-9]+)+$/.test(s) || /^[A-Za-z]+Rp$/.test(s);

// "penjualanBarangRp" menjadi "Penjualan barang"; label yang sudah manusiawi dibiarkan.
export function humanizeHeader(key: string): string {
  const k = key.trim();
  if (KEY_LABELS[k]) return KEY_LABELS[k];
  if (!looksMachine(k)) return k;
  const words = k
    .replace(/Rp$/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : k;
}

export const isMoneyKey = (key: string) => /Rp$/.test(key.trim()) || /^(omzet|total|potongan|harga|penjualan|nilai)/i.test(humanizeHeader(key));

// Sel angka bulat di kolom rupiah diformat "Rp 129.000"; sel lain dibiarkan.
export function formatCell(key: string, cell: string): string {
  const c = cell.trim();
  if (isMoneyKey(key) && /^-?\d{4,}$/.test(c)) return formatRupiah(Number(c)).replace(/ /g, " ");
  return c;
}
