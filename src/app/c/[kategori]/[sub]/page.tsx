import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPageSkeleton } from "@/components/catalog/catalog-page";
import { CategoryRoute } from "@/components/catalog/category-route";
import type { RawParams } from "@/lib/catalog/filters";
import { getCategoryInfo } from "@/lib/catalog/queries";

type Props = { params: Promise<{ kategori: string; sub: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub } = await params;
  const info = await getCategoryInfo(sub);
  return { title: info ? `${info.name}${info.parent ? `, ${info.parent.name}` : ""}` : "Kategori" };
}

export default function SubCategoryPage(props: Props) {
  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <CategoryRoute {...props} />
    </Suspense>
  );
}
