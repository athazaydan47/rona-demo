"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ShoppingBag } from "lucide-react";
import type { ProductCardVariant } from "@/lib/catalog/catalog-queries";
import { cn } from "@/lib/utils";

// Tombol tambah cepat di kartu produk (Fase 8B). Popover, bottom sheet, dan pemilih shade dimuat terpisah saat tombol
// pertama kali ditekan (atau saat kursor mendekat), supaya kartu di beranda dan katalog tidak membawa kode Radix.
const KELAS = "grid size-9 place-items-center rounded-full bg-putih/95 text-kopi shadow-soft transition-[background-color,color,transform] duration-200 hover:bg-aksen hover:text-putih focus-visible:bg-aksen focus-visible:text-putih disabled:opacity-50 md:size-10";
const Panel = dynamic(() => import("./quick-add-panel").then((m) => m.QuickAddPanel), {
  ssr: false,
  // Selama modul dimuat, tombol tetap terlihat di tempat yang sama.
  loading: () => (
    <span className={cn(KELAS, "bg-aksen text-putih")} aria-hidden>
      <ShoppingBag className="size-4" />
    </span>
  ),
});
const muat = () => void import("./quick-add-panel");

type QuickAddProps = { productName: string; variants: ProductCardVariant[]; className?: string };

export function QuickAdd({ productName, variants, className }: QuickAddProps) {
  const [aktif, setAktif] = useState(false);
  const anyStock = variants.some((v) => v.inStock);
  if (aktif) return <Panel productName={productName} variants={variants} className={className} autoOpen />;
  return (
    <button
      type="button"
      aria-label={`Tambah ${productName} ke keranjang`}
      disabled={!anyStock}
      onPointerEnter={muat}
      onFocus={muat}
      onClick={() => setAktif(true)}
      className={cn(KELAS, className)}
    >
      <ShoppingBag className="size-4" />
    </button>
  );
}
