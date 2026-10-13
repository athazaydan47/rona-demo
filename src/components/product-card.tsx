import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { SwatchDots } from "@/components/ui/swatch-dots";
import { ProductArt } from "@/components/product-art";
import { QuickAdd } from "@/components/cart/quick-add";
import type { ProductCardData } from "@/lib/catalog/catalog-queries";
import { formatCompactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CardBadge = "flash" | "habis" | "baru" | "terlaris";

const badgeMeta: Record<CardBadge, { label: string; variant: "flash" | "habis" | "baru" | "terlaris" }> = {
  flash: { label: "Flash Sale", variant: "flash" },
  habis: { label: "Habis", variant: "habis" },
  baru: { label: "Baru", variant: "baru" },
  terlaris: { label: "Terlaris", variant: "terlaris" },
};

// Satu badge saja di atas gambar, prioritas: Flash Sale, Habis, Baru, Terlaris.
export function pickCardBadge(product: ProductCardData, hide: CardBadge[] = []): CardBadge | null {
  const order: [CardBadge, boolean][] = [
    ["flash", product.isFlash],
    ["habis", !product.inStock],
    ["baru", product.isNew],
    ["terlaris", product.isBestseller],
  ];
  for (const [badge, on] of order) if (on && !hide.includes(badge)) return badge;
  return null;
}

type ProductCardProps = {
  product: ProductCardData;
  hideBadges?: CardBadge[]; // badge yang sama dengan judul section disembunyikan
  quickAdd?: boolean;
  className?: string;
};

export function ProductCard({ product, hideBadges = [], quickAdd = true, className }: ProductCardProps) {
  const badge = pickCardBadge(product, hideBadges);
  const hasRating = product.reviewCount > 0;
  const hasSold = product.soldCount > 0;
  const href = `/p/${product.slug}`;
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col rounded-card border border-garis bg-putih p-2.5 shadow-soft transition-[box-shadow,transform] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift focus-within:shadow-lift",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[12px]">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <ProductArt
            packaging={product.packaging}
            shade={product.primaryHex}
            brandColor={product.brandColor}
            brandName={product.brandName}
            title={`${product.name}${product.primaryShade ? `, shade ${product.primaryShade}` : ""}`}
            className="transition-transform duration-300 ease-soft group-hover:scale-[1.03]"
          />
        </Link>
        {badge ? (
          <Badge variant={badgeMeta[badge].variant} className="absolute top-2 left-2">
            {badgeMeta[badge].label}
          </Badge>
        ) : null}
        {quickAdd ? (
          <div className="absolute right-2 bottom-2 z-10">
            <QuickAdd productName={product.name} variants={product.variants} />
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-1.5 pt-3 pb-1.5">
        <p className="truncate text-xs font-semibold tracking-wide text-abu-hangat uppercase">{product.brandName}</p>
        <h3 className="line-clamp-2 text-sm leading-5 font-medium text-kopi">
          {/* Tautan utama kartu: area klik diperluas ke seluruh kartu lewat pseudo-element */}
          <Link href={href} className="after:absolute after:inset-0 after:z-0 after:rounded-card focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {hasRating || hasSold ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-abu-hangat tabular-nums">
            {hasRating ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Star className="size-3.5 text-emas" fill="currentColor" strokeWidth={0} aria-hidden />
                <span className="font-semibold text-kopi">{product.ratingAvg.toFixed(1).replace(".", ",")}</span>
                <span>({formatCompactNumber(product.reviewCount)})</span>
              </span>
            ) : null}
            {hasRating && hasSold ? <span aria-hidden>·</span> : null}
            {hasSold ? <span className="whitespace-nowrap">{formatCompactNumber(product.soldCount)} terjual</span> : null}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <PriceTag price={product.price} normalPrice={product.normalPrice} size="sm" prefix={product.variantCount > 1 ? "Mulai" : undefined} />
          <SwatchDots hexes={product.hexes} />
        </div>
      </div>
    </article>
  );
}

// Kerangka kartu dengan proporsi yang sama supaya tidak ada pergeseran layout saat memuat.
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-card border border-garis bg-putih p-2.5" aria-hidden>
      <div className="animate-pulse rounded-[12px] bg-porselen" style={{ aspectRatio: "5 / 6" }} />
      <div className="flex flex-col gap-2 px-1.5 pt-3 pb-1.5">
        <div className="h-3 w-16 animate-pulse rounded bg-porselen" />
        <div className="h-4 w-full animate-pulse rounded bg-porselen" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-porselen" />
        <div className="h-3 w-24 animate-pulse rounded bg-porselen" />
        <div className="mt-1 h-5 w-28 animate-pulse rounded bg-porselen" />
        <div className="h-3.5 w-20 animate-pulse rounded bg-porselen" />
      </div>
    </div>
  );
}
