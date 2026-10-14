import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SearchBox } from "@/components/layout/search-box";
import { CatalogPage, CatalogPageSkeleton } from "@/components/catalog/catalog-page";
import { db } from "@/db/client";
import { aiConfig, aiModel } from "@/lib/ai";
import { interpretationToFilters, interpretQuery, looksLikeSentence } from "@/lib/ai/interpret";
import { globalCapReached } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { parseCatalogParams, type CatalogFilters, type RawParams } from "@/lib/catalog/filters";
import type { CatalogScope } from "@/lib/catalog/scope";
import { now } from "@/lib/clock";

export const metadata: Metadata = { title: "Cari" };

// Kalimat sehari-hari ditafsirkan AI menjadi filter (maksimal 2,5 detik). Bila AI tidak ada, gagal, atau lambat,
// pencarian trigram biasa langsung dipakai, jadi pencarian tidak pernah terblokir oleh AI.
async function resolveSearch(sp: RawParams, filters: CatalogFilters): Promise<{ scope: CatalogScope; filters: CatalogFilters }> {
  const exact = (Array.isArray(sp.persis) ? sp.persis[0] : sp.persis) === "1";
  if (filters.interpreted) return { scope: filters.keyword ? { kind: "search", q: filters.keyword } : { kind: "all" }, filters };
  const cfg = aiConfig();
  const model = aiModel(cfg);
  if (!exact && model && looksLikeSentence(filters.q)) {
    // Jam dan cookie pengunjung hanya dibaca saat request, tidak ikut prerender.
    await connection();
    const at = now();
    const capped = await globalCapReached(db, cfg, at).catch(() => true);
    if (!capped) {
      const r = await interpretQuery(db, model, filters.q, at, { visitorHash: await currentVisitorHash() }).catch(() => null);
      if (r) {
        const f = interpretationToFilters(r.interpretation, filters);
        return { scope: f.keyword ? { kind: "search", q: f.keyword } : { kind: "all" }, filters: f };
      }
    }
  }
  return { scope: { kind: "search", q: filters.q }, filters };
}

async function SearchRoute({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const parsed = parseCatalogParams(sp);
  if (!parsed.q) {
    return (
      <section className="container-rona py-8 md:py-12">
        <h1 className="font-serif text-3xl font-medium text-kopi">Cari</h1>
        <p className="mt-2 text-sm text-abu-hangat">Ketik nama produk, merek, atau kategori. Salah ketik sedikit tidak apa-apa. Boleh juga kalimat, misal &ldquo;sunscreen yang ga lengket buat kulit berminyak&rdquo;.</p>
        <SearchBox className="mt-4 max-w-xl" autoFocus />
      </section>
    );
  }
  const { scope, filters } = await resolveSearch(sp, parsed);
  const exactHref = `/cari?${new URLSearchParams({ q: filters.q, persis: "1" }).toString()}`;
  return (
    <>
      <div className="container-rona pt-6 md:hidden">
        <SearchBox initialQuery={filters.q} />
      </div>
      <CatalogPage
        scope={scope}
        filters={filters}
        basePath="/cari"
        chipsPrefix={filters.interpreted ? "Kami artikan sebagai:" : undefined}
        header={
          filters.interpreted ? (
            <p className="mt-2 text-sm text-abu-hangat" data-testid="tafsiran-ai">
              Pencarianmu kami tafsirkan menjadi filter di bawah. Hapus chip yang tidak sesuai, atau{" "}
              <Link href={exactHref} className="font-semibold text-rona hover:underline">
                cari kata persis saja
              </Link>
              .
            </p>
          ) : null
        }
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

