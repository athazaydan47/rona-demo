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
import { getProductDetail, getProductLive, getProductReviews, getRelatedProducts } from "@/lib/product/queries";
import { formatRupiah } from "@/lib/format";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ shade?: string }> };

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000").replace(/\/$/, "");
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

async function ProductRoute({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const product = await getProductDetail(slug);
  if (!product || product.status !== "aktif" || product.variants.length === 0) notFound();
  const [live, reviews, related] = await Promise.all([getProductLive(product), getProductReviews(product.id), getRelatedProducts(product)]);
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
      <ProductView product={product} live={live} siteUrl={base} />

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
        <ReviewsSection reviews={reviews} ratingAvg={product.ratingAvg} />
        <FrequentlyBought current={{ name: product.name, variantId: selected.id, price: live.prices[selected.id]?.price ?? selected.salePrice }} items={related.together} />
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

export default function ProductPage(props: Props) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductRoute {...props} />
    </Suspense>
  );
}
