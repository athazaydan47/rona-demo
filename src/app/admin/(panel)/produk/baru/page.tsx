import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { storageKind } from "@/lib/reviews/storage";
import { siteUrl } from "@/lib/site";
import { aiTersedia } from "@/lib/ai";
import { productFormData } from "../form-data";

export const metadata: Metadata = { title: "Tambah produk" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/produk/baru");
  if (!can(me, "produk.kelola")) return <Denied />;
  const { brands, categories } = await productFormData();
  return (
    <ProductForm
      id={null}
      brands={brands}
      categories={categories}
      hasOrders={false}
      siteUrl={siteUrl()}
      photosEnabled={storageKind() !== "nonaktif"}
      aiWriter={aiTersedia("asistenAdmin")}
      initial={{ name: "", slug: "", brandId: brands[0]?.id ?? 0, categoryId: 0, packaging: "lipstick", shortDescription: "", benefits: "", ingredients: "", howToUse: "", activeIngredients: "", skinTypes: [], skinConcerns: [], finish: "", spf: "", bpom: "", netto: "", imageUrl: null, seoTitle: "", seoDescription: "", status: "draf", variants: [] }}
    />
  );
}

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/produk" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-aksen hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Produk
      </Link>
      <PageHead title="Tambah produk" description="Mulai sebagai draf, lalu aktifkan saat siap tampil di toko." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content />
      </Suspense>
    </>
  );
}
