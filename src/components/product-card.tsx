import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { RatingStars } from "@/components/ui/rating-stars";
import { SwatchDots } from "@/components/ui/swatch-dots";
import { ProductArt } from "@/components/product-art";
import type { ProductCardData } from "@/lib/catalog/queries";
import { formatCompactNumber } from "@/lib/format";
import { discountPercent } from "@/lib/pricing";

// Versi fondasi. Tombol tambah cepat dan pemilih shade hadir di fase 2.
export function ProductCard({ product }: { product: ProductCardData }) {
  const percent = discountPercent(product.normalPrice, product.price);
  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex flex-col rounded-card border border-garis bg-putih p-2.5 shadow-soft transition-[box-shadow,transform] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift focus-visible:shadow-lift"
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
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {!product.inStock ? <Badge variant="habis">Habis</Badge> : null}
          {product.inStock && product.isBestseller ? <Badge variant="terlaris">Terlaris</Badge> : null}
          {product.inStock && product.isNew ? <Badge variant="baru">Baru</Badge> : null}
        </div>
        {percent > 0 ? (
          <Badge variant="diskon" className="absolute top-2 right-2">
            {percent}%
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-1.5 pt-3 pb-1.5">
        <p className="text-xs font-semibold tracking-wide text-abu-hangat uppercase">{product.brandName}</p>
        <h3 className="line-clamp-2 text-sm leading-5 font-medium text-kopi">{product.name}</h3>
        <div className="flex min-h-5 items-center gap-2">
          <RatingStars value={product.ratingAvg} count={product.reviewCount} size="sm" showValue={false} />
          {product.soldCount > 0 ? (
            <span className="text-xs whitespace-nowrap text-abu-hangat tabular-nums">Terjual {formatCompactNumber(product.soldCount)}</span>
          ) : null}
        </div>
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <PriceTag price={product.price} normalPrice={product.normalPrice} size="sm" prefix={product.variantCount > 1 ? "Mulai" : undefined} />
          <SwatchDots hexes={product.hexes} />
        </div>
      </div>
    </Link>
  );
}
