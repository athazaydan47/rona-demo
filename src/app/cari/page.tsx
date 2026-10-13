import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBox } from "@/components/layout/search-box";
import { CatalogPage, CatalogPageSkeleton } from "@/components/catalog/catalog-page";
import { parseCatalogParams, type RawParams } from "@/lib/catalog/filters";

export const metadata: Metadata = { title: "Cari" };

async function SearchRoute({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const filters = parseCatalogParams(sp);
  if (!filters.q) {
    return (
      <section className="container-rona py-8 md:py-12">
        <h1 className="font-serif text-3xl font-medium text-kopi">Cari</h1>
        <p className="mt-2 text-sm text-abu-hangat">Ketik nama produk, merek, atau kategori. Salah ketik sedikit tidak apa-apa.</p>
        <SearchBox className="mt-4 max-w-xl" autoFocus />
      </section>
    );
  }
  return (
    <>
      <div className="container-rona pt-6 md:hidden">
        <SearchBox initialQuery={filters.q} />
      </div>
      <CatalogPage
        scope={{ kind: "search", q: filters.q }}
        filters={filters}
        basePath="/cari"
        title={
          <>
            Hasil untuk &ldquo;{filters.q}&rdquo;
          </>
        }
        breadcrumb={[{ label: "Pencarian" }]}
      />
    </>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <SearchRoute searchParams={searchParams} />
    </Suspense>
  );
}
