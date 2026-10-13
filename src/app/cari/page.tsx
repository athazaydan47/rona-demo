import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBox } from "@/components/layout/search-box";

export const metadata: Metadata = { title: "Cari" };

async function SearchSummary({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  return (
    <p className="mt-6 text-abu-hangat">
      {term ? (
        <>
          Kamu mencari <span className="font-semibold text-kopi">&ldquo;{term}&rdquo;</span>. Hasil pencarian lengkap dengan saran instan hadir di fase 2.
        </>
      ) : (
        "Ketik nama produk, merek, atau kategori. Pencarian lengkap hadir di fase 2."
      )}
    </p>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <section className="container-rona py-8 md:py-12">
      <h1 className="font-serif text-3xl font-medium text-kopi">Cari</h1>
      <SearchBox className="mt-4 max-w-xl" autoFocus />
      <Suspense fallback={<p className="mt-6 text-abu-hangat">Memuat...</p>}>
        <SearchSummary searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
