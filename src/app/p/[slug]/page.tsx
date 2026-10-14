import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCardSkeleton } from "@/components/product-card";
import { ProductCard } from "@/components/product-card";
import { ScrollRow } from "@/components/ui/scroll-row";
import { Chip } from "@/components/ui/chip";
import { FrequentlyBought } from "@/components/product/frequently-bought";
import { ProductTabs } from "@/components/product/product-tabs";
import { ProductView } from "@/components/product/product-view";
import { ReturnPolicy } from "@/components/product/return-policy";
import { ReviewsSection } from "@/components/product/reviews-section";
import { concernLabels, skinTypeLabels } from "@/lib/catalog/filters";
import { getActiveProductSlugs, getProductDetail, getProductLive, getProductReviews, getRelatedProducts, type ProductDetail } from "@/lib/product/queries";
import { formatRupiah } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { AskAboutProduct } from "@/components/ai/advisor";
import { SkinFit } from "@/components/product/skin-fit";
import { ShadeMatchDialog } from "@/components/shade/shade-match";
import { db } from "@/db/client";
import { aiTersedia } from "@/lib/ai";
import { getReviewSummary } from "@/lib/ai/review-summary";
import { currentSkinProfile } from "@/lib/skin/current";
import { isProfileUsable } from "@/lib/skin/profile";
import { fitForProfile } from "@/lib/skin/rules";
import { SHADE_GROUPS } from "@/lib/skin/shade";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ shade?: string }> };

// params dibaca di luar Suspense (lihat di bawah). Dengan partialPrefetching, Next.js juga merender ulang shell umum
// /p/[slug] setiap kali tag "products" kedaluwarsa (misal admin menyimpan produk); tanpa izin memblokir, render itu
// gagal dan semua halaman produk ikut error. Slug yang tidak ada sudah dijawab 404 oleh proxy.
export const instant = false;

// Semua slug aktif diprarender. Dengan ini, params boleh dibaca di luar Suspense dan produk yang tidak ada
// memanggil notFound() sebelum shell terkirim, sehingga statusnya 404 sungguhan.
export async function generateStaticParams() {
  const slugs = await getActiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}


export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const product = await getProductDetail(slug);
  if (!product || product.status !== "aktif") return { title: "Produk tidak ditemukan" };
  const shade = product.variants.find((v) => v.shadeSlug === sp.shade);
  const title = shade && product.variants.length > 1 ? `${product.name}, ${shade.shadeName}` : product.name;
  const minPrice = Math.min(...product.variants.map((v) => v.salePrice));
  const description = `${product.shortDescription} Mulai ${formatRupiah(minPrice)}. ${product.brand.name}, ${product.category.name}.`;
  const og = `${siteUrl()}/p/${product.slug}/og.png${shade ? `?shade=${shade.shadeSlug}` : ""}`;
  return {
    title,
    description,
    openGraph: { title: `${title} | Rona Beauty`, description, images: [{ url: og, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

async function ProductRoute({ product, searchParams }: { product: ProductDetail; searchParams: Props["searchParams"] }) {
  const sp = await searchParams;
  const [live, reviews, related, skin, summary] = await Promise.all([getProductLive(product), getProductReviews(product.id), getRelatedProducts(product), currentSkinProfile(), getReviewSummary(db, product.id)]);
  const aiOn = aiTersedia();
  const fit = isProfileUsable(skin)
    ? fitForProfile(skin, { categorySlug: product.category.slug, parentSlug: product.parent?.slug ?? product.category.slug, skinTypes: product.skinTypes, concerns: product.concerns, finish: product.finish, activeIngredients: product.activeIngredients, ingredients: product.ingredients, variants: product.variants })
    : null;
  const shadeGroup = SHADE_GROUPS[product.category.slug];
  const selected = product.variants.find((v) => v.shadeSlug === sp.shade) ?? product.variants[0];
  const base = siteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    sku: selected.sku,
    brand: { "@type": "Brand", name: product.brand.name },
    category: product.category.name,
    image: [`${base}/p/${product.slug}/og.png`],
    url: `${base}/p/${product.slug}`,
    offers: product.variants.map((v) => {
      const available = Object.values(live.stock[v.id] ?? {}).some((n) => n > 0);
      return {
        "@type": "Offer",
        name: v.shadeName,
        sku: v.sku,
        price: live.prices[v.id]?.price ?? v.salePrice,
        priceCurrency: "IDR",
        availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `${base}/p/${product.slug}?shade=${v.shadeSlug}`,
      };
    }),
    ...(product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.reviewCount } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductView
        product={product}
        live={live}
        siteUrl={base}
        shadeProfile={skin?.depth && skin.undertone ? { depth: skin.depth, undertone: skin.undertone } : null}
        shadeTools={product.hasShades && shadeGroup ? <ShadeMatchDialog group={shadeGroup} productId={product.id} productName={product.name} aiAvailable={aiOn} /> : null}
        extras={
          <>
            <SkinFit fit={fit} />
            <AskAboutProduct productId={product.id} productName={product.name} />
          </>
        }
      />

      <div className="container-rona grid grid-cols-1 gap-6 pb-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="min-w-0 space-y-6">
          <ProductTabs product={product} variantWeight={selected.weightGram} />
          {product.skinTypes.length > 0 || product.concerns.length > 0 ? (
            <section aria-labelledby="cocok-heading">
              <h2 id="cocok-heading" className="text-sm font-semibold text-kopi">
                Cocok untuk
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.skinTypes.map((s) => (
                  <Chip key={s} asChild>
                    <Link href={`/c/semua?kulit=${s}`}>Kulit {skinTypeLabels[s] ?? s}</Link>
                  </Chip>
                ))}
                {product.concerns.map((c) => (
                  <Chip key={c} asChild>
                    <Link href={`/c/semua?masalah=${c}`}>{concernLabels[c] ?? c}</Link>
                  </Chip>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <div className="min-w-0">
          <ReturnPolicy />
        </div>
      </div>

      <div className="container-rona space-y-12 pb-10">
        <ReviewsSection reviews={reviews} ratingAvg={product.ratingAvg} summary={summary ? { ...summary.summary, reviewCount: summary.reviewCount } : null} />
        <FrequentlyBought current={{ name: product.name, variantId: selected.id, price: live.prices[selected.id]?.price ?? selected.salePrice, packaging: product.packaging, hex: selected.hex, brandColor: product.brand.color, brandName: product.brand.name, shadeName: product.variants.length > 1 ? selected.shadeName : "" }} items={related.together} />
        {related.similar.length > 0 ? (
          <section aria-labelledby="serupa-heading">
            <h2 id="serupa-heading" className="font-serif text-2xl text-kopi md:text-3xl">
              Produk serupa
            </h2>
            <p className="mt-1 text-sm text-abu-hangat">Kategori sama dengan shade atau harga yang mirip.</p>
            <div className="mt-4">
              <ScrollRow ariaLabel="Produk serupa" desktop="md:grid-cols-4">
                {related.similar.map((p) => (
                  <li key={p.id} className="min-w-0">
                    <ProductCard product={p} />
                  </li>
                ))}
              </ScrollRow>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-rona py-5 md:py-8" aria-busy aria-label="Memuat produk">
      <div className="mb-4 h-4 w-56 animate-pulse rounded bg-garis/70" />
      <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="animate-pulse rounded-card bg-porselen" style={{ aspectRatio: "5 / 6" }} />
        <div className="space-y-4">
          <div className="h-3 w-20 animate-pulse rounded bg-garis/70" />
          <div className="h-9 w-4/5 animate-pulse rounded bg-garis/70" />
          <div className="h-4 w-40 animate-pulse rounded bg-garis/70" />
          <div className="h-20 animate-pulse rounded-card bg-garis/50" />
          <div className="h-40 animate-pulse rounded-card bg-garis/50" />
          <div className="h-12 animate-pulse rounded-pill bg-garis/70" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product || product.status !== "aktif" || product.variants.length === 0) notFound();
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductRoute product={product} searchParams={searchParams} />
    </Suspense>
  );
}
