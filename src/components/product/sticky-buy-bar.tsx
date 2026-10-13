"use client";

import { useEffect, useState } from "react";
import { BellRing, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { cn } from "@/lib/utils";

type Props = {
  watchRef: React.RefObject<HTMLDivElement | null>;
  price: number;
  normalPrice: number;
  shadeName: string;
  outOfStock: boolean;
  onAdd: () => void;
  onNotify: () => void;
};

// Bar beli di HP: muncul setelah tombol utama tergulir keluar layar.
export function StickyBuyBar({ watchRef, price, normalPrice, shadeName, outOfStock, onAdd, onNotify }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = watchRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchRef]);
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-16 z-30 border-t border-garis bg-putih/95 px-4 py-2.5 shadow-[0_-8px_24px_rgb(42_31_29/0.08)] backdrop-blur-md transition-transform duration-250 ease-soft md:hidden",
        show ? "translate-y-0" : "translate-y-[120%]",
      )}
      aria-hidden={!show}
      data-sticky-bar
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-abu-hangat">{shadeName}</p>
          <PriceTag price={price} normalPrice={normalPrice} size="sm" />
        </div>
        {outOfStock ? (
          <Button variant="dark" onClick={onNotify} tabIndex={show ? 0 : -1}>
            <BellRing /> Kabari aku
          </Button>
        ) : (
          <Button onClick={onAdd} tabIndex={show ? 0 : -1}>
            <ShoppingBag /> Tambah
          </Button>
        )}
      </div>
    </div>
  );
}
