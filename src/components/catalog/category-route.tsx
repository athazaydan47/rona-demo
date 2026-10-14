import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { parseCatalogParams, type RawParams } from "@/lib/catalog/filters";
import { getCategoryInfo, getCategoryTree } from "@/lib/catalog/queries";
import { MEREK } from "@/config/merek";

// Isi halaman /c/[kategori] dan /c/[kategori]/[sub]. Dipanggil di dalam Suspense karena membaca searchParams.
export async function CategoryRoute({ params, searchParams }: { params: Promise<{ kategori: string; sub?: string }>; searchParams: Promise<RawParams> }) {
  const [{ kategori, sub }, sp] = await Promise.all([params, searchParams]);
  const filters = parseCatalogParams(sp);

  if (kategori === "semua" && !sub) {
    return (
      <CatalogPage
        scope={{ kind: "all" }}
        filters={filters}
        basePath="/c/semua"
        title="Semua produk"
        description={`Seluruh katalog ${MEREK.namaLengkap}. Pakai filter untuk mempersempit.`}
        breadcrumb={[{ label: "Semua produk" }]}
      />
    );
  }

  const [tree, info] = await Promise.all([getCategoryTree(), getCategoryInfo(sub ?? kategori)]);
  const parentNode = tree.find((p) => p.slug === kategori);
  if (!parentNode || !info) notFound();
  if (sub && info.parent?.slug !== kategori) notFound();

  const basePath = sub ? `/c/${kategori}/${sub}` : `/c/${kategori}`;
  const chips = [
    { label: `Semua ${parentNode.name}`, href: `/c/${kategori}`, active: !sub },
    ...parentNode.children.map((c) => ({ label: c.name, href: `/c/${kategori}/${c.slug}`, active: c.slug === sub })),
  ];
  const breadcrumb = sub ? [{ label: parentNode.name, href: `/c/${kategori}` }, { label: info.name }] : [{ label: parentNode.name }];

  return (
    <CatalogPage
      scope={{ kind: "category", slug: kategori, subSlug: sub }}
      filters={filters}
      basePath={basePath}
      title={info.name}
      description={sub ? `${info.name} dari ${parentNode.name}. ${parentNode.description}` : parentNode.description}
      breadcrumb={breadcrumb}
      subChips={chips}
    />
  );
}
