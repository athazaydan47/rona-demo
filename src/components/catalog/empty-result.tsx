import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { ProductArt } from "@/components/product-art";
import type { ProductCardData } from "@/lib/catalog/catalog-queries";
import { activeFilterChips, clearFilters, serializeCatalogParams, type CatalogFilters } from "@/lib/catalog/filters";
import type { FilterLabels } from "./active-chips";
import Link from "next/link";
import { MEREK } from "@/config/merek";

type Props = {
  filters: CatalogFilters;
  labels: FilterLabels;
  basePath: string;
  bestsellers: ProductCardData[];
  scopeTotal: number;
  locked?: string[];
};

// Hasil kosong yang membantu: saran menghapus filter tertentu, lalu produk terlaris.
export function EmptyResult({ filters, labels, basePath, bestsellers, scopeTotal, locked = [] }: Props) {
  const chips = activeFilterChips(filters, labels).filter((c) => !locked.includes(c.key));
  const hrefFor = (f: CatalogFilters) => {
    const qs = serializeCatalogParams({ ...f, page: 1 });
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <div>
      <div className="flex flex-col items-center rounded-card border border-dashed border-garis bg-putih px-6 py-10 text-center">
        <div className="w-28">
          <ProductArt packaging="sheet_mask" shade="#F4DCDF" brandColor="#B8475D" brandName={MEREK.nama} title="Ilustrasi hasil kosong" view="detail" />
        </div>
        <h2 className="mt-4 font-serif text-2xl text-kopi">
          {filters.q ? <>Tidak ada hasil untuk &ldquo;{filters.q}&rdquo;</> : "Belum ada produk yang cocok"}
        </h2>
        <p className="mt-2 max-w-md text-sm text-abu-hangat">
          {chips.length > 0
            ? `Ada ${scopeTotal} produk di sini sebelum difilter. Coba lepaskan salah satu filter di bawah.`
            : filters.q
              ? "Coba kata lain yang lebih umum, misalnya nama kategori atau merek."
              : "Produk untuk bagian ini belum tersedia."}
        </p>
        {chips.length > 0 ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {chips.map((c, i) => (
              <Button key={`${c.key}-${i}`} variant="outline" size="sm" asChild>
                <Link href={hrefFor(c.next)}>
                  <SearchX /> Hapus {c.label}
                </Link>
              </Button>
            ))}
            {chips.length > 1 ? (
              <Button size="sm" asChild>
                <Link href={hrefFor(clearFilters(filters))}>Hapus semua filter</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {bestsellers.length > 0 ? (
        <section className="mt-10">
          <h3 className="mb-4 font-serif text-xl text-kopi">Sementara itu, ini yang paling laris</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {bestsellers.map((p) => (
              <li key={p.id} className="min-w-0">
                <ProductCard product={p} hideBadges={["terlaris"]} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
