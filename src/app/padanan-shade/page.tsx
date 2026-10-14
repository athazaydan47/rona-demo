import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ShadeMatchPanel } from "@/components/shade/shade-match";
import { aiTersedia } from "@/lib/ai";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Padanan Shade", description: `Cari shade terdekat dari produk lain di katalog ${MEREK.nama} berdasarkan warna, kedalaman, dan undertone.` };

async function Panel() {
  // Ketersediaan AI dibaca saat request supaya env yang kosong langsung menyembunyikan kolom kalimat.
  await connection();
  return <ShadeMatchPanel aiAvailable={aiTersedia("aiPembeli")} />;
}

export default function ShadeMatchPage() {
  return (
    <section className="container-toko max-w-2xl py-8 md:py-12">
      <p className="text-xs font-semibold tracking-wide text-aksen uppercase">Padanan shade</p>
      <h1 className="mt-1 font-serif text-3xl font-medium text-kopi md:text-4xl">Pindah merek tanpa salah shade</h1>
      <p className="mt-2 text-sm text-abu-hangat">Pilih produk dan shade yang biasa kamu pakai. Kami bandingkan warna, kedalaman, dan undertone-nya dengan shade di produk lain sekategori, lalu tampilkan 3 yang paling dekat.</p>
      <div className="mt-6 rounded-card border border-garis bg-porselen p-4 sm:p-5">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-garis/40" />}>
          <Panel />
        </Suspense>
      </div>
    </section>
  );
}
