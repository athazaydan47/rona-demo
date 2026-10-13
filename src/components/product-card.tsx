import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { SwatchDots } from "@/components/ui/swatch-dots";
import { ProductArt } from "@/components/product-art";
import type { ProductCardData } from "@/lib/catalog/queries";
import { formatCompactNumber } from "@/lib/format";

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
};

// Versi fondasi. Tombol tambah cepat dan pemilih shade hadir di fase 2.
export function ProductCard({ product, hideBadges = [] }: ProductCardProps) {
  const badge = pickCardBadge(product, hideBadges);
  const hasRating = product.reviewCount > 0;
  const hasSold = product.soldCount > 0;
  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex min-w-0 flex-col rounded-card border border-garis bg-putih p-2.5 shadow-soft transition-[box-shadow,transform] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift focus-visible:shadow-lift"
    >
      <div className="relative overflow-hidden rounded-[12px]">
        <ProductArt
          packaging={product.packaging}
          shade={product.primaryHex}
          brandColor={product.brandColor}
          brandName={product.brandName}
          title={`${product.name}${product.primaryShade ? `, shade ${product.primaryShade}` : ""}`}
          className="transition-transform duration-300 ease-soft group-hover:scale-[1.03]"
        />
        {badge ? (
          <Badge variant={badgeMeta[badge].variant} className="absolute top-2 left-2">
            {badgeMeta[badge].label}
          </Badge>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-1.5 pt-3 pb-1.5">
        <p className="truncate text-xs font-semibold tracking-wide text-abu-hangat uppercase">{product.brandName}</p>
        <h3 className="line-clamp-2 text-sm leading-5 font-medium text-kopi">{product.name}</h3>
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
    </Link>
  );
}
