import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, Sparkles, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";
import { HeroComposition } from "@/components/hero-composition";
import { AdvisorCta, BrandShowcase, CategoryCircles, FlashSaleSection, JournalSection, ProductRow, ProductRowSkeleton, SkinTypeSection, StoresSection } from "@/components/home/sections";
import { BannerCarousel } from "@/components/home/banner-carousel";
import { liveBanners } from "@/lib/catalog/banners";
import { getArticles, getBrands, getCategoryTree, getHeroBanners, getLocations } from "@/lib/catalog/queries";
import { now } from "@/lib/clock";
import { MEREK } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import { HERO_HP } from "@/lib/content/visual";

// Banner promo dari admin. Jadwal tayang disaring per request, daftar banner sendiri di-cache dengan tag banners.
async function HomeBanners() {
  await connection();
  const live = liveBanners(await getHeroBanners(), now());
  if (!live.length) return null;
  return <BannerCarousel banners={live.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, href: b.href, imageUrl: b.imageUrl, art: b.art }))} />;
}

export default async function HomePage() {
  const [categories, brands, articles, locations] = await Promise.all([getCategoryTree(), getBrands(), getArticles(3), getLocations()]);
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FAF7F5_0%,#F4DCDF_100%)]">
        <div className="container-toko grid items-center gap-8 py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10 md:py-16 lg:gap-16 lg:py-20">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-pill bg-putih/70 px-3 py-1 text-xs font-semibold tracking-wide text-aksen uppercase">
              <Sparkles className="size-3.5" /> Cocok dulu, baru beli
            </p>
            <h1 className="mt-5 font-serif text-4xl leading-[1.05] font-medium text-balance text-kopi md:text-[56px] md:leading-[1.02] lg:text-[68px]">
              {MEREK.tagline}
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
                <Truck className="size-4 text-aksen" /> Pesan sebelum 15.00, dikirim hari ini
              </li>
              <li className="flex items-center gap-2">
                <Store className="size-4 text-aksen" /> Ambil di 3 cabang Malang
              </li>
            </ul>
          </div>
          <div className="relative mx-auto grid w-full max-w-sm grid-cols-3 items-end gap-3 md:hidden">
            {HERO_HP.map((h) => (
              <div key={h.packaging} className={h.geser}>
                <ProductArt packaging={h.packaging} shade={h.shade} brandColor={h.brand} brandName={h.brandName} title={h.judul} />
              </div>
            ))}
          </div>
          <HeroComposition className="hidden w-full md:block" />
        </div>
      </section>

      <Suspense fallback={<div className="container-toko pt-5 md:pt-8" aria-hidden><div className="aspect-[16/10] rounded-card bg-porselen sm:aspect-[21/8] md:aspect-[1200/360]" /></div>}>
        <HomeBanners />
      </Suspense>

      <CategoryCircles categories={categories} />

      {fiturAktif("flashSale") ? (
        <Suspense fallback={<div className="h-[520px] bg-kopi" aria-busy aria-label="Memuat flash sale" />}>
          <FlashSaleSection />
        </Suspense>
      ) : null}

      <AdvisorCta />

      <Suspense fallback={<ProductRowSkeleton title="Terlaris minggu ini" />}>
        <ProductRow title="Terlaris minggu ini" subtitle={`Pilihan yang paling sering masuk keranjang pembeli ${MEREK.nama}.`} href="/c/semua?urut=terlaris" sort="terlaris" hideBadges={["terlaris"]} />
      </Suspense>

      <Suspense fallback={<ProductRowSkeleton title="Baru datang" />}>
        <ProductRow title="Baru datang" subtitle="Produk yang baru masuk etalase." href="/c/semua?urut=terbaru" sort="terbaru" hideBadges={["baru"]} />
      </Suspense>

      <Suspense fallback={<ProductRowSkeleton title="Pilihan per jenis kulit" count={4} />}>
        <SkinTypeSection />
      </Suspense>

      <BrandShowcase brands={brands} />
      <JournalSection articles={articles} />
      {fiturAktif("multiCabang") ? <StoresSection locations={locations} /> : null}
    </>
  );
}
