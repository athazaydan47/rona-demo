import type { Metadata } from "next";
import Link from "next/link";
import { HelpPage } from "@/components/layout/help-page";
import { Button } from "@/components/ui/button";
import { CARA_BELANJA } from "@/lib/content/bantuan";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Cara belanja", description: `Enam langkah belanja di ${MEREK.namaLengkap}: cari, pilih shade, keranjang, checkout 3 langkah, bayar, lalu ulas.` };

export default function CaraBelanjaPage() {
  return (
    <HelpPage title={`Cara belanja di ${MEREK.nama}`} intro="Enam langkah singkat dari cari produk sampai paket tiba. Semua harga dan stok dihitung ulang di server, jadi tidak ada kejutan di akhir." current="/cara-belanja">
      <ol className="space-y-4">
        {CARA_BELANJA.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-card border border-garis bg-putih p-4 sm:p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blush font-serif text-lg text-aksen-gelap">{i + 1}</span>
            <div>
              <h2 className="font-semibold text-kopi">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-kopi/85">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/c/skincare">Mulai belanja</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/faq">Baca pertanyaan umum</Link>
        </Button>
      </div>
    </HelpPage>
  );
}
