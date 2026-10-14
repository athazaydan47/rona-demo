"use client";

// Kartu produk hasil AI (Fase 8B: disatukan dari panel Advisor dan pencari dupe). Pilih shade lalu tambah ke keranjang
// dengan sumber atribusi; harga dan stok tetap dihitung ulang server saat item masuk keranjang.
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import type { Packaging } from "@/db/schema/enums";
import { addToCart } from "@/lib/cart/client-cart";
import { cn } from "@/lib/utils";

export type VarianKartuAi = { id: number; shadeName: string; hex: string; price: number; normalPrice: number; inStock: boolean };
export type KartuAi = {
  id: number;
  name: string;
  slug: string;
  brandName: string;
  brandColor: string;
  packaging: Packaging;
  price: number;
  normalPrice: number;
  primaryHex: string;
  variantCount: number;
  variants: VarianKartuAi[];
  stokOnline: number;
  alasan?: string;
  varianPilihan?: number | null;
};

type Props = {
  p: KartuAi;
  // Atribusi penjualan item yang ditambahkan dari kartu ini.
  sumber: "advisor" | "cari_video";
  testId: string;
  alasanTestId: string;
  labelTambah: string;
  ringkas?: boolean;
  // Baris kecil di bawah alasan, misal stok online atau cabang yang punya stok.
  catatan?: string;
};

export function KartuProdukAi({ p, sumber, testId, alasanTestId, labelTambah, ringkas, catatan }: Props) {
  const [variantId, setVariantId] = useState(p.varianPilihan ?? p.variants.find((v) => v.inStock)?.id ?? p.variants[0]?.id);
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const v = p.variants.find((x) => x.id === variantId) ?? p.variants[0];
  return (
    <li className={cn("flex gap-3 rounded-xl border border-garis bg-putih", ringkas ? "p-2.5" : "p-3")} data-testid={testId}>
      <Link href={`/p/${p.slug}`} className={cn("shrink-0 overflow-hidden rounded-lg", ringkas ? "w-16" : "w-20")}>
        <ProductArt packaging={p.packaging} shade={v?.hex ?? p.primaryHex} brandColor={p.brandColor} brandName={p.brandName} title={p.name} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{p.brandName}</p>
        <Link href={`/p/${p.slug}`} className="line-clamp-2 text-sm font-semibold text-kopi hover:underline">
          {p.name}
        </Link>
        <PriceTag price={v?.price ?? p.price} normalPrice={v?.normalPrice ?? p.normalPrice} size="sm" />
        {p.alasan ? (
          <p className={cn("text-xs text-kopi/80", !ringkas && "mt-0.5")} data-testid={alasanTestId}>
            {p.alasan}
          </p>
        ) : null}
        {catatan ? <p className="text-[11px] text-abu-hangat">{catatan}</p> : null}
        <div className={cn("flex flex-wrap items-center gap-1.5", ringkas ? "mt-1.5" : "mt-2")}>
          {p.variantCount > 1 ? (
            <select
              value={variantId}
              onChange={(e) => setVariantId(Number(e.target.value))}
              className={cn("rounded-lg border border-garis bg-putih px-2 text-xs", ringkas ? "h-8 max-w-[140px]" : "h-9 max-w-[160px]")}
              aria-label={`Pilih shade ${p.name}`}
            >
              {p.variants.map((x) => (
                <option key={x.id} value={x.id} disabled={!x.inStock}>
                  {x.shadeName}
                  {x.inStock ? "" : " (habis)"}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            size="sm"
            disabled={!v?.inStock || state === "busy"}
            onClick={async () => {
              if (!v) return;
              setState("busy");
              const r = await addToCart(v.id, 1, { source: sumber, openDrawer: false });
              setState(r.ok ? "ok" : "fail");
              setMsg(r.ok ? "Masuk keranjang" : (r.message ?? "Gagal"));
            }}
          >
            {state === "busy" ? <Loader2 className="animate-spin" /> : null} {v?.inStock ? labelTambah : "Habis"}
          </Button>
          {msg ? (
            <span className={cn("text-[11px]", state === "ok" ? "text-sukses" : "text-bahaya")} role="status">
              {msg}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
