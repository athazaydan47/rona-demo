"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Leaf } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { RatingStars } from "@/components/ui/rating-stars";
import { toast } from "@/components/ui/toast";
import { ProductArt, ShadeSwatchArt, type SwatchTexture } from "@/components/product-art";
import { FlashCountdown } from "@/components/flash/flash-countdown";
import { QuotaBar } from "@/components/flash/quota-bar";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { addToCart } from "@/lib/cart/client-cart";
import { flyToCart } from "@/lib/cart/fly-to-cart";
import { formatCompactNumber } from "@/lib/format";
import { maxPurchasable } from "@/lib/pricing";
import type { ProductDetail, ProductLive } from "@/lib/product/queries";
import { SHADE_PROFILE_KEY, isGoodMatch, parseProfile, suggestShades, type SkinProfile } from "@/lib/shade";
import { cn } from "@/lib/utils";
import { BuyActions } from "./buy-actions";
import { ProductGallery, type GalleryImage } from "./gallery";
import { RestockDialog } from "./restock-dialog";
import { ShadeFinderDialog } from "./shade-finder-dialog";
import { ShadeLineupArt } from "./shade-lineup-art";
import { ShippingEstimate } from "./shipping-estimate";
import { StickyBuyBar } from "./sticky-buy-bar";
import { StockByStore } from "./stock-by-store";
import { SwatchPicker } from "./swatch-picker";

type Props = { product: ProductDetail; live: ProductLive; siteUrl: string };

const textureFor = (p: ProductDetail["packaging"], finish: string | null): SwatchTexture => {
  if (p === "eyeshadow_palette" || (p === "cushion" && finish === "matte")) return "bubuk";
  if (p === "lip_tint" || p === "serum_dropper" || p === "toner_bottle" || p === "perfume_bottle" || p === "foundation_bottle") return "cair";
  if (finish === "satin" || finish === "glowy" || p === "lipstick") return "satin";
  return "krim";
};

export function ProductView({ product, live, siteUrl }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const variants = product.variants;
  const fromUrl = variants.find((v) => v.shadeSlug === searchParams.get("shade"));
  const [selectedId, setSelectedId] = useState<number>(fromUrl?.id ?? variants[0].id);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const [profile, setProfile] = useState<SkinProfile | null>(null);
  const mainImageRef = useRef<HTMLDivElement>(null);
  const mainButtonRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setProfile(parseProfile(window.localStorage.getItem(SHADE_PROFILE_KEY)));
      } catch {
        // abaikan
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // Ganti shade: URL ikut berubah dengan replace supaya bisa dibagikan tanpa memenuhi riwayat.
  const selectShade = useCallback(
    (id: number) => {
      setSelectedId(id);
      const v = variants.find((x) => x.id === id);
      if (!v) return;
      const params = new URLSearchParams(searchParams.toString());
      if (variants.length > 1) params.set("shade", v.shadeSlug);
      else params.delete("shade");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, variants],
  );

  const availability = useMemo(() => {
    const out: Record<number, number> = {};
    for (const v of variants) out[v.id] = Object.values(live.stock[v.id] ?? {}).reduce((a, b) => a + b, 0);
    return out;
  }, [live.stock, variants]);
  const available = availability[selected.id] ?? 0;
  const outOfStock = available <= 0;
  const price = live.prices[selected.id] ?? { price: selected.salePrice, normalPrice: selected.normalPrice, source: "normal" as const, percent: 0 };
  const flash = live.flash[selected.id];
  const maxQty = maxPurchasable({ available, isFlash: price.source === "flash", maxPerCustomer: flash?.maxPerCustomer, quotaLeft: flash ? flash.quota - flash.sold : null });

  const matches = useMemo(() => {
    if (!profile || !product.hasShades) return { ids: new Set<number>(), best: null as number | null };
    const ids = new Set(variants.filter((v) => isGoodMatch(profile, v)).map((v) => v.id));
    const best = suggestShades(variants, profile)[0]?.variant.id ?? null;
    if (best) ids.add(best);
    return { ids, best };
  }, [profile, product.hasShades, variants]);

  const images: GalleryImage[] = [
    { key: "depan", label: "Tampak depan", node: <ProductArt packaging={product.packaging} shade={selected.hex} brandColor={product.brand.color} brandName={product.brand.name} title={`${product.name}, ${selected.shadeName}, tampak depan`} /> },
    { key: "detail", label: "Tampak detail", node: <ProductArt packaging={product.packaging} shade={selected.hex} brandColor={product.brand.color} brandName={product.brand.name} view="detail" title={`${product.name}, ${selected.shadeName}, tampak detail`} /> },
    {
      key: "swatch",
      label: "Swatch tekstur",
      node: (
        <div className="flex h-full items-center bg-[radial-gradient(circle_at_40%_30%,#FFFDFB,#F1E9E4)]">
          <ShadeSwatchArt shade={selected.hex} texture={textureFor(product.packaging, product.finish)} background="none" title={`Swatch ${selected.shadeName}`} />
        </div>
      ),
    },
  ];
  if (product.hasShades && variants.length > 1) {
    images.push({ key: "lineup", label: "Perbandingan shade", node: <ShadeLineupArt shades={variants} selectedId={selected.id} title={`Perbandingan shade ${product.name}`} /> });
  }

  const shareUrl = `${siteUrl}/p/${product.slug}${variants.length > 1 ? `?shade=${selected.shadeSlug}` : ""}`;
  const sensitive = product.skinTypes.includes("sensitif");
  const shadeLabel = variants.length > 1 ? selected.shadeName : "";

  const quickAdd = () => {
    addToCart(selected.id, 1);
    flyToCart(mainImageRef.current);
    toast({ title: "Ditambahkan ke keranjang", description: `${product.name}${shadeLabel ? `, ${shadeLabel}` : ""}` });
  };

  return (
    <div className="container-rona py-5 md:py-8">
      <Breadcrumb
        items={[...(product.parent ? [{ label: product.parent.name, href: `/c/${product.parent.slug}` }] : []), { label: product.category.name, href: product.parent ? `/c/${product.parent.slug}/${product.category.slug}` : `/c/${product.category.slug}` }, { label: product.name }]}
        className="mb-4"
      />
      <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="md:sticky md:top-[140px] md:self-start">
          <ProductGallery images={images} variantKey={String(selected.id)} mainRef={mainImageRef} />
        </div>

        <div className="min-w-0">
          <Link href={`/merek/${product.brand.slug}`} className="text-xs font-semibold tracking-wide text-rona uppercase hover:underline">
            {product.brand.name}
          </Link>
          <h1 className="mt-1 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-abu-hangat">
            <RatingStars value={product.ratingAvg} count={product.reviewCount} size="sm" />
            {product.reviewCount > 0 ? <span aria-hidden>·</span> : null}
            {product.soldCount > 0 ? <span className="tabular-nums">{formatCompactNumber(product.soldCount)} terjual</span> : null}
            {sensitive ? (
              <Badge variant="sensitif" className="ml-auto">
                <Leaf className="size-3" aria-hidden /> Aman untuk kulit sensitif
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-abu-hangat">{product.shortDescription}</p>

          <div className="mt-5 rounded-card border border-garis bg-putih p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriceTag price={price.price} normalPrice={price.normalPrice} size="lg" />
              {price.source === "flash" ? <Badge variant="flash">Flash Sale</Badge> : price.source === "promo" ? <Badge variant="diskon">Promo</Badge> : null}
            </div>
            {flash && price.source === "flash" ? (
              <div className="mt-3 space-y-2">
                <FlashCountdown target={flash.endsAt} label="Berakhir dalam" size="sm" />
                <QuotaBar quota={flash.quota} sold={flash.sold} size="md" />
                <p className="text-xs text-abu-hangat">Maksimal {flash.maxPerCustomer} per pembeli di slot ini.</p>
              </div>
            ) : null}
          </div>

          {product.hasShades ? (
            <div className="mt-5">
              <SwatchPicker
                variants={variants}
                selectedId={selected.id}
                onSelect={selectShade}
                availability={availability}
                matchIds={matches.ids}
                bestMatchId={matches.best}
                action={
                  <ShadeFinderDialog
                    variants={variants}
                    profile={profile}
                    onSave={(p) => {
                      setProfile(p);
                      try {
                        window.localStorage.setItem(SHADE_PROFILE_KEY, JSON.stringify(p));
                      } catch {
                        // abaikan
                      }
                    }}
                    onPick={selectShade}
                  />
                }
              />
            </div>
          ) : product.hasSizes ? (
            <div className="mt-5">
              <p className="text-sm text-kopi">
                Pilihan: <span className="font-semibold">{selected.shadeName}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih ukuran atau varian">
                {variants.map((v) => {
                  const out = (availability[v.id] ?? 0) <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={v.id === selected.id}
                      onClick={() => selectShade(v.id)}
                      className={cn("h-10 rounded-pill border px-4 text-sm font-medium transition-colors", v.id === selected.id ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih text-kopi hover:border-kopi/30", out && "line-through opacity-60")}
                    >
                      {v.shadeName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <BuyActions productId={product.id} productName={product.name} shadeName={shadeLabel} variantId={selected.id} maxQty={maxQty} outOfStock={outOfStock} flyFromRef={mainImageRef} mainButtonRef={mainButtonRef} shareUrl={shareUrl} />
          </div>

          <div className="mt-6 space-y-4">
            <StockByStore locations={live.locations} stock={live.stock[selected.id] ?? {}} shadeName={shadeLabel || undefined} />
            <ShippingEstimate weightGram={selected.weightGram} />
          </div>
        </div>
      </div>

      <StickyBuyBar watchRef={mainButtonRef} price={price.price} normalPrice={price.normalPrice} shadeName={shadeLabel ? `Shade ${shadeLabel}` : product.name} outOfStock={outOfStock} onAdd={quickAdd} onNotify={() => notifyRef.current?.click()} />
      {outOfStock ? (
        <RestockDialog variantId={selected.id} productName={product.name} shadeName={shadeLabel || "Standar"} trigger={<button ref={notifyRef} type="button" className="sr-only" aria-hidden tabIndex={-1} />} />
      ) : null}
    </div>
  );
}
