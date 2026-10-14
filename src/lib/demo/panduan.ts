import { MEREK, kunciLokal, namaEvent } from "@/config/merek";
import { fiturAktif, type Fitur } from "@/config/fitur";
// Panduan demo (Fase 8A): daftar centang mengikuti Skenario demo 5 menit di BRIEF. Langkah tercentang otomatis dari
// halaman yang dibuka (pathname dan query) atau dari peristiwa yang dikirim komponen lewat tandaiLangkah().
// Kemajuan disimpan di localStorage (dibungkus try/catch karena penyimpanan bisa diblokir).
export type LangkahId = "hp" | "flash" | "cari" | "shade" | "advisor" | "checkout" | "bayar" | "admin" | "kanban" | "penutup";

export type Langkah = { id: LangkahId; judul: string; detail: string; href?: string; fitur?: Fitur };

const SEMUA_LANGKAH: Langkah[] = [
  { id: "hp", judul: "Buka di HP-mu sendiri", detail: "Supaya terasa langsung: bilah bawah, sheet, dan tombol melayang dirancang untuk jempol.", href: "/" },
  { id: "flash", judul: "Lihat flash sale di beranda", detail: "Hitung mundur dan kuota berjalan dari server, bukan dari browser.", href: "/flash-sale", fitur: "flashSale" },
  { id: "cari", judul: 'Ketik "cusion" (sengaja salah) lalu filter kulit berminyak', detail: "Hasilnya tetap cushion. Filter dihitung dari atribut produk.", href: "/cari?q=cusion" },
  { id: "shade", judul: 'Buka satu cushion, ganti shade, klik "Cari shade-ku"', detail: "Swatch, stok per shade, dan stok per cabang berganti tanpa muat ulang.", href: "/p/pualam-velvet-matte-cushion-spf-50" },
  { id: "advisor", judul: `Tanya ${MEREK.asisten.nama}`, detail: '"Sunscreen buat kulit berminyak di bawah 100 ribu?" Jawabannya hanya produk yang benar-benar ada.', href: "/advisor", fitur: "aiPembeli" },
  { id: "checkout", judul: "Checkout dengan Ambil di Toko", detail: "Pilih cabang, bayar QRIS, lalu buat pesanan.", href: "/keranjang" },
  { id: "bayar", judul: "Tekan simulasi bayar", detail: "Di halaman bayar ada tombol simulasi (hanya di mode demo). Stok cabang langsung berkurang." },
  { id: "admin", judul: "Buka panel admin di laptop", detail: "Pesanan baru muncul di dashboard dalam 30 detik, stok ikut berubah.", href: "/admin/masuk" },
  { id: "kanban", judul: "Pindahkan kartu pesanan ke Siap Diambil", detail: "Seret kartu di kanban, atau pilih status dari daftar di kartu.", href: "/admin/pesanan" },
  { id: "penutup", judul: "Tutup dengan kalimat penutup", detail: '"Ini demo dengan data fiktif. Untuk tokomu, merek, stok, dan cabangnya diganti dengan punyamu."' },
];

// Langkah fitur yang dimatikan (src/config/fitur.ts) tidak ditampilkan.
export const LANGKAH: Langkah[] = SEMUA_LANGKAH.filter((l) => !l.fitur || fiturAktif(l.fitur));

export const PANDUAN_KEY = kunciLokal("panduan-demo");
export const PANDUAN_EVENT = namaEvent("panduan");
export const BUKA_EVENT = namaEvent("panduan-buka");

export type PanduanState = { selesai: LangkahId[]; tutup: boolean; pernahDibuka: boolean };
const EMPTY: PanduanState = { selesai: [], tutup: false, pernahDibuka: false };

export function bacaPanduan(): PanduanState {
  try {
    const raw = window.localStorage.getItem(PANDUAN_KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<PanduanState>;
    return { selesai: Array.isArray(p.selesai) ? p.selesai.filter((x): x is LangkahId => LANGKAH.some((l) => l.id === x)) : [], tutup: Boolean(p.tutup), pernahDibuka: Boolean(p.pernahDibuka) };
  } catch {
    return EMPTY;
  }
}

export function simpanPanduan(next: PanduanState) {
  try {
    window.localStorage.setItem(PANDUAN_KEY, JSON.stringify(next));
  } catch {
    // penyimpanan diblokir: kemajuan hanya hidup selama halaman terbuka
  }
  window.dispatchEvent(new Event(PANDUAN_EVENT));
}

// Dipanggil komponen saat langkah dilakukan (Shade Finder dibuka, pertanyaan Advisor dikirim, kartu kanban dipindah).
export function tandaiLangkah(id: LangkahId) {
  if (typeof window === "undefined") return;
  const cur = bacaPanduan();
  if (cur.selesai.includes(id)) return;
  simpanPanduan({ ...cur, selesai: [...cur.selesai, id] });
}

// Langkah yang bisa dikenali dari alamat halaman.
export function langkahDariUrl(pathname: string, search: string): LangkahId[] {
  const q = new URLSearchParams(search);
  const out: LangkahId[] = [];
  if (pathname === "/" || pathname === "/flash-sale") out.push("flash");
  if (pathname === "/cari" && /cus/i.test(q.get("q") ?? "") && q.get("kulit") === "berminyak") out.push("cari");
  if (pathname.startsWith("/p/") && q.has("shade")) out.push("shade");
  if (pathname.startsWith("/bayar/")) out.push("checkout");
  if (/\/sukses$/.test(pathname)) out.push("bayar");
  if (pathname === "/admin") out.push("admin");
  return out;
}
