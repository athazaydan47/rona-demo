"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { laporGalatKlien } from "@/lib/galat-klien";
import { MEREK } from "@/config/merek";

// Halaman 500 toko: identitas merek, coba lagi, dan jalan kembali. Tidak menampilkan detail galat ke pengunjung.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    laporGalatKlien(error);
  }, [error]);
  return (
    <section className="container-toko flex flex-col items-center py-16 text-center md:py-24">
      <div className="w-36">
        <ProductArt packaging="cream_jar" shade={MEREK.palet.blush} brandColor={MEREK.palet.aksen} brandName={MEREK.nama} title="Ilustrasi halaman bermasalah" />
      </div>
      <p className="mt-6 text-xs font-semibold tracking-wide text-aksen uppercase">Ada yang tersendat</p>
      <h1 className="mt-1 font-serif text-3xl font-medium text-kopi md:text-4xl">Halaman ini belum bisa dibuka</h1>
      <p className="mt-3 max-w-md text-abu-hangat">Coba muat ulang sebentar lagi. Kalau masih bermasalah, keranjang dan pesananmu tetap aman di akunmu.</p>
      {error.digest ? <p className="mt-2 text-[11px] text-abu-hangat tabular-nums">Kode: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw /> Coba lagi
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ke beranda</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/hubungi">Hubungi kami</Link>
        </Button>
      </div>
    </section>
  );
}
