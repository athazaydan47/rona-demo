import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPage, CatalogPageSkeleton } from "@/components/catalog/catalog-page";
import { parseCatalogParams, type RawParams } from "@/lib/catalog/filters";

export const metadata: Metadata = { title: "Promo", description: "Semua produk yang sedang diskon di Rona Beauty." };

async function PromoRoute({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const filters = { ...parseCatalogParams(sp), promo: true };
  return (
    <CatalogPage
      scope={{ kind: "promo" }}
      filters={filters}
      basePath="/promo"
      title="Promo"
      description="Semua produk yang harganya sedang lebih murah dari harga normal, termasuk flash sale yang sedang berjalan."
      breadcrumb={[{ label: "Promo" }]}
      hideFacets={["promo"]}
      lockedFilters={["promo"]}
    />
  );
}

export default function PromoPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <PromoRoute searchParams={searchParams} />
    </Suspense>
  );
}
