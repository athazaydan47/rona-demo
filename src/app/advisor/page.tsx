import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { ContohTanya } from "@/components/tanya/contoh-tanya";
import { Button } from "@/components/ui/button";
import { aiTersedia } from "@/lib/ai";
import { MEREK } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: MEREK.asisten.nama, description: `Asisten belanja AI yang hanya merekomendasikan produk yang benar-benar ada di katalog ${MEREK.nama}, dengan harga dan stok dari server.` };

async function Cta() {
  await connection();
  return (
    <div className="space-y-3">
      {!aiTersedia("aiPembeli") ? (
        <p className="rounded-card border border-garis bg-putih p-5 text-sm text-abu-hangat" data-testid="advisor-nonaktif">
          AI sedang tidak aktif di lingkungan ini. Kuis kulit, rutinitas, padanan shade, lacak pesanan, dan ongkir tetap bisa dipakai di chat.
        </p>
      ) : null}
      <ContohTanya />
    </div>
  );
}

export default function AdvisorPage() {
  // Fitur dimatikan di src/config/fitur.ts: halaman ini tidak ada.
  if (!fiturAktif("aiPembeli")) notFound();
  return (
    <section className="container-toko max-w-3xl py-10 md:py-16">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-aksen uppercase">
        <Sparkles className="size-3.5" aria-hidden /> {MEREK.asisten.nama}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">Satu chat untuk produk, shade, video, ongkir, dan pesanan. Jawabannya dari data toko, bukan karangan.</h1>
      <p className="mt-4 text-lg text-abu-hangat">Rekomendasi, kuis kulit, rutinitas, padanan shade, cari dari link TikTok atau screenshot, lacak pesanan, ongkir, dan jam buka cabang ada di satu tempat. Server memeriksa setiap produk, harga, dan stok; kartu yang tampil selalu nyata.</p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-20 animate-pulse rounded-card bg-garis/40" />}>
          <Cta />
        </Suspense>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/kuis-kulit", title: "Kuis kulit", text: "Enam pertanyaan supaya jawaban Advisor dan rutinitasmu lebih pas." },
          { href: "/padanan-shade", title: "Padanan shade", text: "Cari 3 shade terdekat dari produk yang kamu pakai sekarang." },
          { href: "/cari-dari-video", title: "Cari dari video", text: "Lihat produk di TikTok atau YouTube? Kirim link atau screenshot-nya." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="rounded-card border border-garis bg-putih p-4 transition-colors hover:border-aksen/40">
            <p className="font-semibold text-kopi">{c.title}</p>
            <p className="mt-1 text-sm text-abu-hangat">{c.text}</p>
          </Link>
        ))}
      </div>
      <Button asChild variant="ghost" className="mt-8">
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </section>
  );
}
