import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPageSkeleton } from "@/components/catalog/catalog-page";
import { CategoryRoute } from "@/components/catalog/category-route";
import type { RawParams } from "@/lib/catalog/filters";
import { getCategoryInfo } from "@/lib/catalog/queries";

type Props = { params: Promise<{ kategori: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategori } = await params;
  if (kategori === "semua") return { title: "Semua produk" };
  const info = await getCategoryInfo(kategori);
  return { title: info ? info.name : "Kategori", description: info?.description || undefined };
}

export default function CategoryPage(props: Props) {
  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <CategoryRoute {...props} />
    </Suspense>
  );
}
