import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { getProductForEdit } from "@/lib/admin/products";
import { storageKind } from "@/lib/reviews/storage";
import { siteUrl } from "@/lib/site";
import { productFormData, toFormValue } from "../form-data";

export const metadata: Metadata = { title: "Ubah produk" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ baru?: string; disimpan?: string }> };

async function Content({ params, searchParams }: Props) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const me = await requireStaff(`/admin/produk/${id}`);
  if (!can(me, "produk.kelola")) return <Denied />;
  const found = await getProductForEdit(db, Number.parseInt(id, 10) || 0);
  if (!found) return <Denied message="Produk tidak ditemukan." />;
  const { brands, categories } = await productFormData();
  return (
    <>
      <PageHead title={found.product.name} description={sp.baru === "salinan" ? "Salinan dibuat sebagai draf. Ubah nama dan SKU sebelum mengaktifkan." : sp.baru ? "Produk tersimpan." : `Status ${found.product.status}. ${found.hasOrders ? "Sudah pernah dipesan, jadi hanya bisa diarsipkan." : "Belum pernah dipesan."}`} />
      <ProductForm key={found.product.updatedAt.toISOString()} id={found.product.id} initial={toFormValue(found)} brands={brands} categories={categories} hasOrders={found.hasOrders} siteUrl={siteUrl()} photosEnabled={storageKind() !== "nonaktif"} initialMessage={sp.disimpan ? "Produk tersimpan." : undefined} />
    </>
  );
}

export default function EditProductPage(props: Props) {
  return (
    <>
      <Link href="/admin/produk" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Produk
      </Link>
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content {...props} />
      </Suspense>
    </>
  );
}
