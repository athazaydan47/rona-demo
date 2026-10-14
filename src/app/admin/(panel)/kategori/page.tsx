import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { BrandManager, CategoryTree } from "@/components/admin/taxonomy-manager";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { categoryTree, listBrands } from "@/lib/admin/taxonomy";

export const metadata: Metadata = { title: "Kategori dan Merek" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/kategori");
  if (!can(me, "kategori.kelola")) return <Denied />;
  const [tree, brands] = await Promise.all([categoryTree(db), listBrands(db)]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h2 className="mb-3 font-serif text-xl">Kategori</h2>
        <CategoryTree initial={tree} />
      </div>
      <BrandManager brands={brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, color: b.color, tagline: b.tagline, description: b.description, productCount: b.productCount }))} />
    </div>
  );
}

export default function TaxonomyPage() {
  return (
    <>
      <PageHead title="Kategori dan Merek" description="Nama yang mirip dengan yang sudah ada diperingatkan dulu sebelum disimpan." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content />
      </Suspense>
    </>
  );
}
