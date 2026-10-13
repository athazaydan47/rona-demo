"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Heart, Minus, Plus, Share2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { addToCart } from "@/lib/cart/client-cart";
import { flyToCart } from "@/lib/cart/fly-to-cart";
import { toggleWishlist, useWishlist } from "@/lib/cart/wishlist";
import { cn } from "@/lib/utils";
import { RestockDialog } from "./restock-dialog";

type Props = {
  productId: number;
  productName: string;
  shadeName: string;
  variantId: number;
  maxQty: number;
  outOfStock: boolean;
  flyFromRef: React.RefObject<HTMLDivElement | null>;
  mainButtonRef: React.RefObject<HTMLDivElement | null>;
  shareUrl: string;
};

export function BuyActions({ productId, productName, shadeName, variantId, maxQty, outOfStock, flyFromRef, mainButtonRef, shareUrl }: Props) {
  const [qty, setQty] = useState(1);
  const router = useRouter();
  const wishlist = useWishlist();
  const wished = wishlist.includes(productId);
  const safeQty = Math.min(Math.max(1, qty), Math.max(1, maxQty));
  const label = `${productName}${shadeName ? `, ${shadeName}` : ""}`;

  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    flyToCart(flyFromRef.current);
    const r = await addToCart(variantId, safeQty);
    setBusy(false);
    if (!r.ok) toast({ title: "Belum bisa ditambahkan", description: r.message ?? `${label}`, tone: "info" });
    else if (r.message) toast({ title: "Ditambahkan ke keranjang", description: r.message, tone: "info" });
  };

  return (
    <div>
      {!outOfStock ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-pill border border-garis" role="group" aria-label="Jumlah">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={safeQty <= 1} className="grid size-11 place-items-center rounded-full text-kopi hover:bg-porselen disabled:opacity-40" aria-label="Kurangi jumlah">
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {safeQty}
            </span>
            <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={safeQty >= maxQty} className="grid size-11 place-items-center rounded-full text-kopi hover:bg-porselen disabled:opacity-40" aria-label="Tambah jumlah">
              <Plus className="size-4" />
            </button>
          </div>
          <p className="text-xs text-abu-hangat tabular-nums">Maks {maxQty}</p>
        </div>
      ) : null}
      <div ref={mainButtonRef} className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        {outOfStock ? (
          <RestockDialog
            variantId={variantId}
            productName={productName}
            shadeName={shadeName || "Standar"}
            trigger={
              <Button size="lg" variant="dark" className="col-span-2 sm:col-span-2">
                <BellRing /> Kabari aku saat tersedia
              </Button>
            }
          />
        ) : (
          <>
            <Button size="lg" onClick={add} disabled={busy} className="col-span-2 sm:col-span-1">
              <ShoppingBag /> Tambah ke Keranjang
            </Button>
            <Button
              size="lg"
              variant="dark"
              className="col-span-3 sm:col-span-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await addToCart(variantId, safeQty, { openDrawer: false });
                setBusy(false);
                if (!r.ok) {
                  toast({ title: "Belum bisa dibeli", description: r.message, tone: "info" });
                  return;
                }
                router.push("/checkout");
              }}
            >
              Beli Sekarang
            </Button>
          </>
        )}
        <Button
          size="icon"
          variant="outline"
          aria-pressed={wished}
          aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"}
          className={cn(wished && "border-rona text-rona")}
          onClick={() => {
            const now = toggleWishlist(productId);
            toast({ title: now ? "Disimpan ke wishlist" : "Dihapus dari wishlist", description: now ? "Tersimpan di perangkat ini sampai kamu masuk." : undefined, tone: "info" });
          }}
        >
          <Heart className={cn(wished && "fill-current")} />
        </Button>
        <Button size="icon" variant="outline" aria-label="Bagikan ke WhatsApp" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${label} di Rona Beauty: ${shareUrl}`)}`} target="_blank" rel="noreferrer">
            <Share2 />
          </a>
        </Button>
      </div>
    </div>
  );
}
