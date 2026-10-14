import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { OpenAdvisorButton } from "@/components/ai/open-advisor-button";
import { Button } from "@/components/ui/button";
import { aiTersedia } from "@/lib/ai";

export const metadata: Metadata = { title: "Rona Advisor", description: "Asisten belanja AI yang hanya merekomendasikan produk yang benar-benar ada di katalog Rona, dengan harga dan stok dari server." };

const CONTOH = ["Sunscreen untuk kulit berminyak di bawah 100 ribu", "Kulitku sawo matang, shade cushion yang pas yang mana?", "Lip tint apa saja yang ada stoknya di Rona Dinoyo?"];

async function Cta() {
  await connection();
  if (!aiTersedia())
    return (
      <p className="rounded-card border border-garis bg-putih p-5 text-sm text-abu-hangat" data-testid="advisor-nonaktif">
        Rona Advisor sedang tidak aktif di lingkungan ini. Kuis kulit, rutinitas, dan padanan shade tetap bisa dipakai.
      </p>
    );
  return (
    <div className="flex flex-wrap gap-2">
      {CONTOH.map((c) => (
        <OpenAdvisorButton key={c} prompt={c} />
      ))}
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <section className="container-rona max-w-3xl py-10 md:py-16">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-rona uppercase">
        <Sparkles className="size-3.5" aria-hidden /> Rona Advisor
      </p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">Tanya produk, shade, dan stok. Jawabannya dari katalog, bukan karangan.</h1>
      <p className="mt-4 text-lg text-abu-hangat">Advisor wajib membaca katalog sebelum menjawab, lalu server memeriksa setiap produk, harga, dan stok yang disebut. Jawaban AI bisa keliru, tapi kartu produknya selalu nyata.</p>
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
          <Link key={c.href} href={c.href} className="rounded-card border border-garis bg-putih p-4 transition-colors hover:border-rona/40">
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
