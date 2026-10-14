import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { ProductCardSkeleton, type CardBadge } from "@/components/product-card";
import { getCatalogResult, getProductCards, type CatalogScope } from "@/lib/catalog/catalog-queries";
import { scopeToParams } from "@/lib/catalog/scope";
import { loosenedText, serializeCatalogParams, type CatalogFilters } from "@/lib/catalog/filters";
import { getBrands, getCategoryTree, getLocations } from "@/lib/catalog/queries";
import { ActiveChips } from "./active-chips";
import { Breadcrumb, type Crumb } from "./breadcrumb";
import { CatalogGrid } from "./catalog-grid";
import { EmptyResult } from "./empty-result";
import { FilterPanel, FilterSheet } from "./filter-controls";
import { SortSelect } from "./sort-select";

export type SubChip = { label: string; href: string; active?: boolean };

type CatalogPageProps = {
  scope: CatalogScope;
  filters: CatalogFilters;
  basePath: string;
  title: React.ReactNode;
  description?: string;
  breadcrumb: Crumb[];
  subChips?: SubChip[];
  hideFacets?: ("promo" | "brands" | "location")[];
  lockedFilters?: string[];
  hideBadges?: CardBadge[];
  header?: React.ReactNode; // blok tambahan di bawah judul (misal header merek)
  chipsPrefix?: string; // misal "Kami artikan sebagai:" untuk tafsiran pencarian
};

// Halaman katalog bersama untuk kategori, pencarian, merek, dan promo. Data produk dibaca tanpa cache.
export async function CatalogPage({ scope, filters, basePath, title, description, breadcrumb, subChips, hideFacets, lockedFilters, hideBadges, header, chipsPrefix }: CatalogPageProps) {
  const [result, brands, locations, tree] = await Promise.all([getCatalogResult(scope, filters), getBrands(), getLocations(), getCategoryTree()]);
  const labels = {
    brands: Object.fromEntries(brands.map((b) => [b.slug, b.name])),
    locations: Object.fromEntries(locations.map((l) => [l.slug, l.name])),
    categories: Object.fromEntries(tree.flatMap((c) => [[c.slug, c.name], ...c.children.map((x) => [x.slug, x.name])])),
  };
  const scopeQuery = new URLSearchParams(scopeToParams(scope)).toString();
  const apiQuery = [scopeQuery, serializeCatalogParams(filters, { omitPage: true })].filter(Boolean).join("&");
  const bestsellers = result.total === 0 ? await getProductCards({ kind: "all" }, "terlaris", 4) : [];
  const loosened = loosenedText(result.loosened, labels);

  return (
    <div className="container-toko py-6 md:py-8">
      <Breadcrumb items={breadcrumb} className="mb-3" />
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm text-abu-hangat md:text-base">{description}</p> : null}
        </div>
        <p className="text-sm text-abu-hangat tabular-nums" aria-live="polite">
          {result.total} produk{result.total !== result.scopeTotal ? ` dari ${result.scopeTotal}` : ""}
        </p>
      </div>
      {header}
      {subChips && subChips.length > 0 ? (
        <div className="-mx-4 mt-5 overflow-x-auto px-4 scrollbar-none sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex w-max gap-2 pb-1">
            {subChips.map((c) => (
              <Chip key={c.href} asChild selected={c.active}>
                <Link href={c.href}>{c.label}</Link>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <FilterSheet filters={filters} facets={result.facets} labels={labels} basePath={basePath} scopeQuery={scopeQuery} total={result.total} hide={hideFacets} />
        <SortSelect filters={filters} basePath={basePath} />
        <div className="min-w-0 flex-1 basis-full md:basis-auto">
          <ActiveChips filters={filters} labels={labels} basePath={basePath} locked={lockedFilters} prefix={chipsPrefix} />
        </div>
      </div>
      {loosened ? (
        <p className="mt-3 rounded-xl bg-[#FBEEDC] px-3 py-2 text-sm text-[#8A5512]" role="status" data-testid="dilonggarkan">
          {loosened} Produk yang paling cocok tetap di urutan atas.
        </p>
      ) : null}

      <div className="mt-6 flex items-start gap-8">
        <FilterPanel filters={filters} facets={result.facets} labels={labels} basePath={basePath} hide={hideFacets} />
        <div className="min-w-0 flex-1">
          {result.total === 0 ? (
            <EmptyResult filters={filters} labels={labels} basePath={basePath} bestsellers={bestsellers} scopeTotal={result.scopeTotal} locked={lockedFilters} />
          ) : (
            <CatalogGrid key={apiQuery} initial={result.products} total={result.total} hasMore={result.hasMore} page={result.page} apiQuery={apiQuery} hideBadges={hideBadges} />
          )}
        </div>
      </div>
    </div>
  );
}

// Kerangka halaman katalog dengan tinggi yang mirip supaya tidak terjadi pergeseran layout saat data tiba.
export function CatalogPageSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="container-toko py-6 md:py-8" aria-busy aria-label="Memuat katalog">
      {withHeader ? (
        <>
          <div className="mb-3 h-4 w-40 animate-pulse rounded bg-garis/70" />
          <div className="h-9 w-64 animate-pulse rounded bg-garis/70 md:h-10" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-garis/70" />
          <div className="mt-5 flex gap-2">
            {[80, 96, 72, 110].map((w, i) => (
              <div key={i} className="h-9 animate-pulse rounded-pill bg-garis/70" style={{ width: w }} />
            ))}
          </div>
        </>
      ) : null}
      <div className="mt-5 flex gap-3">
        <div className="h-11 w-24 animate-pulse rounded-pill bg-garis/70 lg:hidden" />
        <div className="h-10 w-40 animate-pulse rounded-pill bg-garis/70" />
      </div>
      <div className="mt-6 flex items-start gap-8">
        <div className="hidden h-[520px] w-64 shrink-0 animate-pulse rounded-card bg-putih lg:block" />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
