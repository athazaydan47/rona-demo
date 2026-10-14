import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DupeFinder } from "@/components/ai/dupe-finder";
import { aiTersedia } from "@/lib/ai";

export const metadata: Metadata = { title: "Cari dari video", description: "Opsional: kirim link TikTok atau YouTube, atau screenshot, lalu temukan produk yang mirip di katalog Rona." };

// Ketersediaan AI dibaca saat request (bukan saat build). Tanpa AI halaman ini tidak ada; pencarian biasa tetap jalan.
async function Finder() {
  await connection();
  if (!aiTersedia()) notFound();
  return <DupeFinder />;
}

export default function DupeFromVideoPage() {
  return (
    <section className="container-rona max-w-3xl py-8 md:py-12">
      <p className="text-xs font-semibold tracking-wide text-rona uppercase">Cari dari video, opsional</p>
      <h1 className="mt-1 font-serif text-3xl font-medium text-kopi md:text-4xl">Lihat produk di video? Cari yang mirip di Rona</h1>
      <p className="mt-2 mb-6 text-sm text-abu-hangat">
        Opsional: tempel link TikTok atau YouTube, atau unggah screenshot. Kami kenali produknya lalu carikan yang sama atau paling mirip dari katalog Rona. Lebih suka cara biasa?{" "}
        <Link href="/cari" className="font-semibold text-rona hover:underline">
          Cari dengan kata kunci
        </Link>
        .
      </p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-garis/40" />}>
        <Finder />
      </Suspense>
    </section>
  );
}
