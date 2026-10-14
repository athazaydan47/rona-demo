import type { Metadata } from "next";
import { BrandDirectory } from "@/components/catalog/brand-directory";
import { getBrands } from "@/lib/catalog/queries";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Semua merek", description: `Direktori merek ${MEREK.namaLengkap} dari A sampai Z.` };

export default async function BrandsPage() {
  const brands = await getBrands();
  return (
    <section className="container-toko py-8 md:py-12">
      <p className="text-xs font-semibold tracking-wide text-aksen uppercase">Direktori merek</p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-kopi md:text-4xl">Semua merek, A sampai Z</h1>
      <p className="mt-2 max-w-2xl text-sm text-abu-hangat md:text-base">Dua belas merek fiktif dengan fokus dan rentang harga masing-masing. Semua produk, nama, dan klaim di dalamnya hanya untuk demo.</p>
      <BrandDirectory brands={brands} />
    </section>
  );
}
