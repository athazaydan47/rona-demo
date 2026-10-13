"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { toast } from "@/components/ui/toast";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { addManyToCart } from "@/lib/cart/client-cart";
import type { ProductCardData } from "@/lib/catalog/catalog-queries";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type Current = { name: string; variantId: number; price: number; packaging: ProductCardData["packaging"]; hex: string; brandColor: string; brandName: string; shadeName: string };

export function FrequentlyBought({ current, items }: { current: Current; items: ProductCardData[] }) {
  const picks = items.map((p) => ({ product: p, variant: p.variants.find((v) => v.inStock) ?? p.variants[0] })).filter((p) => p.variant);
  const [checked, setChecked] = useState<Record<number, boolean>>(() => Object.fromEntries(picks.map((p) => [p.product.id, p.variant.inStock])));
  if (picks.length === 0) return null;
  const selected = picks.filter((p) => checked[p.product.id]);
  const total = current.price + selected.reduce((n, p) => n + p.variant.price, 0);
  const count = selected.length + 1;
  const addAll = async () => {
    const r = await addManyToCart([{ variantId: current.variantId, quantity: 1 }, ...selected.map((p) => ({ variantId: p.variant.id, quantity: 1 }))]);
    if (!r.ok) toast({ title: "Paket belum bisa ditambahkan", description: r.message, tone: "info" });
    else if (r.message) toast({ title: "Paket ditambahkan", description: r.message, tone: "info" });
  };
  const toggle = (id: number) => setChecked((c) => ({ ...c, [id]: !c[id] }));

  return (
    <section aria-labelledby="paket-heading">
      <h2 id="paket-heading" className="font-serif text-2xl text-kopi md:text-3xl">
        Sering dibeli bersama
      </h2>
      <p className="mt-1 text-sm text-abu-hangat">Pelengkap dari kategori lain yang biasa masuk keranjang bareng {current.name}.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* HP: daftar vertikal dengan centang */}
        <ul className="divide-y divide-garis rounded-card border border-garis bg-putih md:hidden">
          <li className="flex items-center gap-3 p-3">
            <input type="checkbox" checked readOnly disabled aria-label={`${current.name} (produk ini, selalu termasuk)`} className="size-4 shrink-0 accent-rona" />
            <span className="w-14 shrink-0 overflow-hidden rounded-lg">
              <ProductArt packaging={current.packaging} shade={current.hex} brandColor={current.brandColor} brandName={current.brandName} title="" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-medium text-kopi">{current.name}</span>
              <span className="block truncate text-xs text-abu-hangat">{current.shadeName ? `Shade ${current.shadeName}` : "Produk ini"}</span>
              <PriceTag price={current.price} size="sm" className="mt-0.5" />
            </span>
          </li>
          {picks.map((p) => (
            <li key={p.product.id} className={cn("flex items-center gap-3 p-3", !checked[p.product.id] && "opacity-60")}>
              <input type="checkbox" checked={Boolean(checked[p.product.id])} onChange={() => toggle(p.product.id)} disabled={!p.variant.inStock} aria-label={`Sertakan ${p.product.name}`} className="size-4 shrink-0 accent-rona" />
              <Link href={`/p/${p.product.slug}`} className="w-14 shrink-0 overflow-hidden rounded-lg">
                <ProductArt packaging={p.product.packaging} shade={p.variant.hex} brandColor={p.product.brandColor} brandName={p.product.brandName} title={p.product.name} />
              </Link>
              <span className="min-w-0 flex-1">
                <Link href={`/p/${p.product.slug}`} className="line-clamp-2 text-sm font-medium text-kopi">
                  {p.product.name}
                </Link>
                <span className="block truncate text-xs text-abu-hangat">{p.product.variantCount > 1 ? p.variant.shadeName : p.product.brandName}{!p.variant.inStock ? ", habis" : ""}</span>
                <PriceTag price={p.variant.price} normalPrice={p.variant.normalPrice} size="sm" className="mt-0.5" />
              </span>
            </li>
          ))}
        </ul>

        {/* Desktop: kartu dengan centang di pojok */}
        <ul className="hidden grid-cols-3 gap-4 md:grid">
          {picks.map((p, i) => (
            <li key={p.product.id} className={cn("relative min-w-0", !checked[p.product.id] && "opacity-60")}>
              {i > 0 ? (
                <span className="absolute top-1/3 -left-3 z-10 grid size-5 place-items-center rounded-full bg-putih text-abu-hangat shadow-soft" aria-hidden>
                  <Plus className="size-3" />
                </span>
              ) : null}
              <label className="absolute top-2 right-2 z-20 grid size-7 cursor-pointer place-items-center rounded-full bg-putih/95 shadow-soft">
                <input type="checkbox" checked={Boolean(checked[p.product.id])} onChange={() => toggle(p.product.id)} disabled={!p.variant.inStock} aria-label={`Sertakan ${p.product.name}`} className="size-4 accent-rona" />
              </label>
              <ProductCard product={p.product} quickAdd={false} />
            </li>
          ))}
        </ul>

        <div className="flex flex-col justify-center rounded-card border border-garis bg-putih p-5">
          <p className="text-xs font-semibold tracking-wide text-abu-hangat uppercase">Total paket</p>
          <p className="mt-1 font-serif text-3xl whitespace-nowrap text-kopi tabular-nums">{formatRupiah(total)}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-abu-hangat">
            <li className="flex items-baseline justify-between gap-3">
              <span className="line-clamp-2 min-w-0">{current.name} (ini)</span>
              <span className="shrink-0 whitespace-nowrap font-semibold text-kopi tabular-nums">{formatRupiah(current.price)}</span>
            </li>
            {selected.map((p) => (
              <li key={p.product.id} className="flex items-baseline justify-between gap-3">
                <span className="line-clamp-2 min-w-0">{p.product.name}</span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-kopi tabular-nums">{formatRupiah(p.variant.price)}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-4" onClick={addAll}>
            <ShoppingBag /> Tambah {count} produk
          </Button>
        </div>
      </div>
    </section>
  );
}
