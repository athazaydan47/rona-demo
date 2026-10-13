"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { toast } from "@/components/ui/toast";
import { ProductCard } from "@/components/product-card";
import { addToCart } from "@/lib/cart/client-cart";
import type { ProductCardData } from "@/lib/catalog/catalog-queries";
import { formatRupiah } from "@/lib/format";

export function FrequentlyBought({ current, items }: { current: { name: string; variantId: number; price: number }; items: ProductCardData[] }) {
  if (items.length === 0) return null;
  const picks = items.map((p) => ({ product: p, variant: p.variants.find((v) => v.inStock) ?? p.variants[0] })).filter((p) => p.variant);
  const total = current.price + picks.reduce((n, p) => n + p.variant.price, 0);
  const addAll = () => {
    addToCart(current.variantId, 1);
    for (const p of picks) if (p.variant.inStock) addToCart(p.variant.id, 1);
    toast({ title: "Paket ditambahkan", description: `${picks.filter((p) => p.variant.inStock).length + 1} produk masuk keranjang.` });
  };
  return (
    <section aria-labelledby="paket-heading">
      <h2 id="paket-heading" className="font-serif text-2xl text-kopi md:text-3xl">
        Sering dibeli bersama
      </h2>
      <p className="mt-1 text-sm text-abu-hangat">Pelengkap dari kategori lain yang biasa masuk keranjang bareng {current.name}.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <ul className="grid grid-cols-3 gap-3 sm:gap-4">
          {picks.map((p, i) => (
            <li key={p.product.id} className="relative min-w-0">
              {i > 0 ? (
                <span className="absolute top-1/3 -left-2 z-10 grid size-5 place-items-center rounded-full bg-putih text-abu-hangat shadow-soft sm:-left-3" aria-hidden>
                  <Plus className="size-3" />
                </span>
              ) : null}
              <ProductCard product={p.product} quickAdd={false} />
            </li>
          ))}
        </ul>
        <div className="flex flex-col justify-center rounded-card border border-garis bg-putih p-5">
          <p className="text-xs font-semibold tracking-wide text-abu-hangat uppercase">Total paket</p>
          <p className="mt-1 font-serif text-3xl text-kopi tabular-nums">{formatRupiah(total)}</p>
          <ul className="mt-3 space-y-1 text-xs text-abu-hangat">
            <li className="flex justify-between gap-2">
              <span className="truncate">{current.name} (ini)</span>
              <PriceTag price={current.price} size="sm" />
            </li>
            {picks.map((p) => (
              <li key={p.product.id} className="flex justify-between gap-2">
                <span className="truncate">{p.product.name}</span>
                <PriceTag price={p.variant.price} size="sm" />
              </li>
            ))}
          </ul>
          <Button className="mt-4" onClick={addAll}>
            <ShoppingBag /> Tambah semua
          </Button>
        </div>
      </div>
    </section>
  );
}
