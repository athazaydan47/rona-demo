import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { getBestsellerCards } from "@/lib/product/queries";

async function Suggestions() {
  const products = await getBestsellerCards(4);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {products.map((p) => (
        <li key={p.id} className="min-w-0">
          <ProductCard product={p} hideBadges={["terlaris"]} />
        </li>
      ))}
    </ul>
  );
}

// Halaman 404 produk bermerek dengan saran produk terlaris (dibaca segar di dalam Suspense).
export function ProductNotFound() {
  return (
    <section className="container-rona py-12 md:py-16">
      <div className="flex flex-col items-center text-center">
        <div className="w-36">
          <ProductArt packaging="lip_tint" shade="#F4DCDF" brandColor="#B8475D" brandName="Rona" view="detail" title="Ilustrasi produk tidak ditemukan" />
        </div>
        <h1 className="mt-5 font-serif text-3xl font-medium text-kopi md:text-4xl">Produk ini tidak ada atau sudah tidak dijual</h1>
        <p className="mt-3 max-w-md text-abu-hangat">Mungkin tautannya salah ketik atau produknya sudah diarsipkan. Sementara itu, ini yang paling disukai pembeli Rona.</p>
        <div className="mt-5 flex gap-3">
          <Button asChild>
            <Link href="/c/semua">Lihat semua produk</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/cari">Cari produk</Link>
          </Button>
        </div>
      </div>
      <div className="mt-10">
        <Suspense
          fallback={
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <ProductCardSkeleton />
                </li>
              ))}
            </ul>
          }
        >
          <Suggestions />
        </Suspense>
      </div>
    </section>
  );
}
