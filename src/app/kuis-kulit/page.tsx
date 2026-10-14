import type { Metadata } from "next";
import { Suspense } from "react";
import { SkinQuiz } from "@/components/quiz/skin-quiz";
import { aiTersedia } from "@/lib/ai";
import { currentSkinProfile } from "@/lib/skin/current";

export const metadata: Metadata = { title: "Kuis Kulit", description: "Enam pertanyaan bergambar untuk tahu jenis kulit, undertone, dan rutinitas yang pas untukmu." };

// Profil yang sudah ada (akun atau cookie tamu) dipakai sebagai jawaban awal.
async function Quiz() {
  const p = await currentSkinProfile();
  // Pilihan "Bantu isi dari foto" hanya tampil bila AI tersedia; tanpa AI kuis tetap sama seperti biasa.
  return <SkinQuiz initial={{ skinType: p?.skinType, concerns: p?.concerns, sensitivity: p?.sensitivity, budget: p?.budget, undertone: p?.undertone, depth: p?.depth, routine: p?.routine }} photoAvailable={aiTersedia("aiFotoLink")} />;
}

export default function SkinQuizPage() {
  return (
    <section className="container-toko max-w-2xl py-8 md:py-12">
      <p className="text-xs font-semibold tracking-wide text-aksen uppercase">Kuis kulit</p>
      <h1 className="mt-1 font-serif text-3xl font-medium text-kopi md:text-4xl">Kenali kulitmu dalam 1 menit</h1>
      <p className="mt-2 mb-6 text-sm text-abu-hangat">Enam pertanyaan singkat. Hasilnya tersimpan di profilmu (atau di perangkat ini bila belum masuk) dan langsung jadi rutinitas pagi dan malam.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-garis/40" />}>
        <Quiz />
      </Suspense>
    </section>
  );
}
