import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CatalogPage, CatalogPageSkeleton } from "@/components/catalog/catalog-page";
import { parseCatalogParams, type RawParams } from "@/lib/catalog/filters";
import { getBrand } from "@/lib/catalog/queries";
import { readableOn, mix } from "@/lib/color";
import { formatRupiah } from "@/lib/format";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrand((await params).slug);
  return { title: brand ? `${brand.name}, etalase merek` : "Merek", description: brand?.tagline };
}

async function BrandRoute({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const filters = parseCatalogParams(sp);
  const text = readableOn(brand.color);
  return (
    <CatalogPage
      scope={{ kind: "brand", slug }}
      filters={filters}
      basePath={`/merek/${slug}`}
      title={brand.name}
      breadcrumb={[{ label: "Merek", href: "/merek" }, { label: brand.name }]}
      hideFacets={["brands"]}
      header={
        <div className="mt-5 overflow-hidden rounded-card shadow-soft" style={{ background: `linear-gradient(120deg, ${brand.color}, ${mix(brand.color, "#FAF7F5", 0.35)})`, color: text }}>
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{brand.tagline}</p>
              <p className="mt-2 text-sm md:text-base" style={{ opacity: 0.92 }}>
                {brand.description}
              </p>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-4 text-sm md:text-right">
              <div>
                <dt className="opacity-75">Produk</dt>
                <dd className="font-serif text-2xl tabular-nums">{brand.productCount}</dd>
              </div>
              <div>
                <dt className="opacity-75">Kisaran harga</dt>
                <dd className="font-semibold tabular-nums">
                  {formatRupiah(brand.priceMin)} sampai {formatRupiah(brand.priceMax)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      }
    />
  );
}

export default function BrandPage(props: Props) {
  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <BrandRoute {...props} />
    </Suspense>
  );
}
