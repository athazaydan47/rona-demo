"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CartView } from "@/lib/cart/service";
import { CartLineRow, EmptyCart, FreeShippingBar, SavedRow, SummaryRows, VoucherForm } from "./cart-parts";
import { useCart } from "./use-cart";

export function CartPage({ initial }: { initial: CartView | null }) {
  const cart = useCart(initial);
  const view = cart.view;
  if (!view || (view.lines.length === 0 && view.saved.length === 0)) return <EmptyCart />;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {view.notices.length ? (
          <div className="mb-4 space-y-2" role="status">
            {view.notices.map((n) => (
              <p key={n} className="rounded-card bg-[#FBEEDC] px-4 py-3 text-sm text-[#8A5512]">
                {n}
              </p>
            ))}
          </div>
        ) : null}
        {view.lines.length ? (
          <>
            <FreeShippingBar remaining={view.pricing.freeShipping.remaining} threshold={view.pricing.freeShipping.threshold} cap={view.pricing.freeShipping.cap} />
            <ul className="mt-2 divide-y divide-garis rounded-card border border-garis bg-putih px-4">
              {view.lines.map((l, i) => (
                <CartLineRow key={l.itemId} line={l} priority={i < 2} busy={cart.busyItem === l.itemId} onQty={(q) => cart.setQuantity(l.itemId, q)} onRemove={() => cart.remove(l.itemId)} onSave={() => cart.saveForLater(l.itemId, true)} />
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-card border border-dashed border-garis bg-putih p-6 text-center text-sm text-abu-hangat">Tidak ada produk aktif di keranjang. Pindahkan dari Simpan untuk nanti, atau lanjut belanja.</p>
        )}
        {view.saved.length ? (
          <section className="mt-8" aria-labelledby="simpan-heading">
            <h2 id="simpan-heading" className="font-serif text-xl text-kopi">
              Simpan untuk nanti ({view.saved.length})
            </h2>
            <ul className="mt-2 divide-y divide-garis rounded-card border border-garis bg-putih px-4">
              {view.saved.map((s) => (
                <SavedRow key={s.itemId} line={s} busy={cart.busyItem === s.itemId} onMove={() => cart.saveForLater(s.itemId, false)} onRemove={() => cart.remove(s.itemId)} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {view.lines.length ? (
        <aside className="lg:sticky lg:top-[140px] lg:self-start" aria-label="Ringkasan belanja">
          <div className="rounded-card border border-garis bg-putih p-5 shadow-soft">
            <h2 className="font-serif text-xl text-kopi">Ringkasan</h2>
            <div className="mt-4">
              <VoucherForm view={view} pending={cart.pending} onApply={cart.applyVoucher} onRemove={cart.removeVoucher} />
            </div>
            <div className="mt-4">
              <SummaryRows view={view} />
            </div>
            <Button asChild size="lg" className="mt-5 w-full">
              <Link href="/checkout" data-aksi-utama>
                Lanjut ke checkout <ArrowRight />
              </Link>
            </Button>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-abu-hangat">
              <ShieldCheck className="size-3.5 text-sage" aria-hidden /> Harga dan stok dicek ulang saat pesanan dibuat.
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
