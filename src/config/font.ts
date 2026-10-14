// Font merek (Fase 8B). next/font harus dipanggil di tingkat modul dengan opsi literal, jadi pilihan font ada di berkas
// ini, bukan di merek.ts. Ganti pemanggilan di bawah untuk toko klien; nama variabel CSS (--font-judul, --font-teks)
// dipakai @theme di src/app/globals.css dan jangan diubah.
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

export const fontJudul = Fraunces({
  subsets: ["latin"],
  variable: "--font-judul",
  axes: ["opsz"], // sumbu SOFT tidak dipakai; dibuang supaya berkas font lebih kecil (Fase 8A)
  display: "swap",
});

export const fontTeks = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-teks",
  display: "swap",
});
