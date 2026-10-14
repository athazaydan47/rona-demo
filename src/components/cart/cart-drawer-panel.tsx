"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCartViewAction } from "@/lib/cart/actions";
import { setCartCount } from "@/lib/cart/client-cart";
import { CartLineRow, EmptyCart, FreeShippingBar, SummaryRows } from "./cart-parts";
import { useCart } from "./use-cart";

// Isi laci keranjang (Fase 8B): dimuat terpisah saat laci pertama kali dibuka. Setiap kali dibuka (bukaKe berubah)
// tampilan keranjang diambil ulang dari server.
export function CartDrawerPanel({ open, setOpen, bukaKe }: { open: boolean; setOpen: (v: boolean) => void; bukaKe: number }) {
  const [loading, setLoading] = useState(false);
  const cart = useCart(null);
  const { setView } = cart;

  useEffect(() => {
    if (!bukaKe) return;
    let alive = true;
    // Status muat ditandai lewat timer supaya tidak setState langsung di effect.
    const t = window.setTimeout(() => alive && setLoading(true), 0);
    getCartViewAction()
      .then((v) => {
        if (!alive) return;
        setView(v);
        if (v) setCartCount(v.count);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [bukaKe, setView]);

  const view = cart.view;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          data-cart-drawer
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-putih shadow-lift outline-none duration-[var(--durasi-lambat)] ease-[var(--ease-soft)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          <div className="flex h-14 items-center justify-between border-b border-garis px-5">
            <Dialog.Title className="font-serif text-xl text-kopi">Keranjang{view && view.count > 0 ? ` (${view.count})` : ""}</Dialog.Title>
            <Dialog.Close className="grid size-10 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup keranjang">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {loading && !view ? (
            <div className="grid flex-1 place-items-center">
              <Loader2 className="size-6 animate-spin text-abu-hangat" aria-label="Memuat keranjang" />
            </div>
          ) : !view || view.lines.length === 0 ? (
            <div className="flex-1 overflow-y-auto px-5">
              <EmptyCart compact />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5">
                <FreeShippingBar remaining={view.pricing.freeShipping.remaining} threshold={view.pricing.freeShipping.threshold} cap={view.pricing.freeShipping.cap} className="mt-4" />
                {view.notices.map((n) => (
                  <p key={n} className="mt-3 rounded-lg bg-[#FBEEDC] px-3 py-2 text-xs text-[#8A5512]" role="status">
                    {n}
                  </p>
                ))}
                <ul className="divide-y divide-garis">
                  {view.lines.map((l) => (
                    <CartLineRow key={l.itemId} line={l} compact busy={cart.busyItem === l.itemId} onQty={(q) => cart.setQuantity(l.itemId, q)} onRemove={() => cart.remove(l.itemId)} onSave={() => cart.saveForLater(l.itemId, true)} />
                  ))}
                </ul>
              </div>
              <div className="border-t border-garis p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
                <SummaryRows view={view} />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" asChild onClick={() => setOpen(false)}>
                    <Link href="/keranjang">Lihat keranjang</Link>
                  </Button>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link href="/checkout">Checkout</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
