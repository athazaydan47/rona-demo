import Link from "next/link";
import { ArrowRight, Sparkles, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { getFeaturedProducts } from "@/lib/catalog/queries";

export default async function HomePage() {
  const products = await getFeaturedProducts(12);
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FAF7F5_0%,#F4DCDF_100%)]">
        <div className="container-rona grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-pill bg-putih/70 px-3 py-1 text-xs font-semibold tracking-wide text-rona uppercase">
              <Sparkles className="size-3.5" /> Cocok dulu, baru beli
            </p>
            <h1 className="mt-5 font-serif text-4xl leading-[1.05] font-medium text-balance text-kopi md:text-[56px] md:leading-[1.02]">
              Temukan rona terbaikmu.
            </h1>
            <p className="mt-5 max-w-md text-lg text-abu-hangat">
              Satu produk, banyak shade. Stok terlihat per cabang. Rekomendasi yang hanya datang dari katalog kami sendiri.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/c/makeup-wajah">
                  Cari shade-mu <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/kuis-kulit">Mulai kuis kulit</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-abu-hangat">
              <li className="flex items-center gap-2">
                <Truck className="size-4 text-rona" /> Pesan sebelum 15.00, dikirim hari ini
              </li>
              <li className="flex items-center gap-2">
                <Store className="size-4 text-rona" /> Ambil di 3 cabang Malang
              </li>
            </ul>
          </div>
          <div className="relative mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3 md:max-w-none">
            <div className="translate-y-6">
              <ProductArt packaging="serum_dropper" shade="#D9EBE7" brandColor="#2F5D62" brandName="Kirana Lab" title="Ilustrasi serum" />
            </div>
            <div className="-translate-y-4">
              <ProductArt packaging="cushion" shade="#DAB085" brandColor="#B98A6A" brandName="Pualam" title="Ilustrasi cushion" />
            </div>
            <div className="translate-y-10">
              <ProductArt packaging="lipstick" shade="#B8475D" brandColor="#C2416B" brandName="Lumi" title="Ilustrasi lipstick" />
            </div>
          </div>
        </div>
      </section>

      <section className="container-rona py-12 md:py-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-medium text-kopi md:text-3xl">Terlaris minggu ini</h2>
            <p className="mt-1 text-sm text-abu-hangat">Pilihan yang paling sering masuk keranjang pembeli Rona.</p>
          </div>
          <Button variant="link" asChild className="hidden sm:inline-flex">
            <Link href="/c/semua?urut=terlaris">
              Lihat semua <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
