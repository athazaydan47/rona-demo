"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import type { CartView } from "@/lib/cart/service";
import { formatRupiah } from "@/lib/format";
import type { PricedCart } from "@/lib/pricing/cart";
import { cn } from "@/lib/utils";

function Rows({ cart, pricing }: { cart: CartView; pricing: PricedCart }) {
  const s = pricing.shipping;
  return (
    <>
      <ul className="divide-y divide-garis">
        {cart.lines.map((l, i) => {
          const pl = pricing.lines[i];
          return (
            <li key={l.itemId} className="flex items-center gap-3 py-3">
              <span className="relative w-12 shrink-0 overflow-hidden rounded-lg">
                <ProductArt packaging={l.packaging} shade={l.hex} brandColor={l.brandColor} brandName={l.brandName} title="" priority={i < 2} />
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-kopi text-[10px] font-bold text-putih tabular-nums">{l.quantity}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm text-kopi">{l.productName}</span>
                {l.showShade ? <span className="block truncate text-xs text-abu-hangat">{l.shadeName}</span> : null}
              </span>
              <span className="shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">{formatRupiah(pl?.lineTotal ?? l.lineTotal)}</span>
            </li>
          );
        })}
      </ul>
      <dl className="mt-3 space-y-2 border-t border-garis pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-abu-hangat">Subtotal</dt>
          <dd className="whitespace-nowrap tabular-nums">{formatRupiah(pricing.normalSubtotal)}</dd>
        </div>
        {pricing.productDiscount > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-abu-hangat">Diskon produk</dt>
            <dd className="whitespace-nowrap text-sukses tabular-nums">-{formatRupiah(pricing.productDiscount)}</dd>
          </div>
        ) : null}
        {pricing.voucherDiscount > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-abu-hangat">Voucher {pricing.voucher?.code}</dt>
            <dd className="whitespace-nowrap text-sukses tabular-nums">-{formatRupiah(pricing.voucherDiscount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-abu-hangat">{s?.method === "ambil" ? "Ambil di Toko" : "Ongkir"}</dt>
          <dd className="whitespace-nowrap tabular-nums">{s ? (s.method === "ambil" ? "Gratis" : formatRupiah(s.cost)) : <span className="text-xs text-abu-hangat">Pilih kurir dulu</span>}</dd>
        </div>
        {s && s.discount > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-abu-hangat">{s.autoFreeDiscount > 0 ? "Gratis ongkir" : "Voucher ongkir"}</dt>
            <dd className="whitespace-nowrap text-sukses tabular-nums">-{formatRupiah(s.discount)}</dd>
          </div>
        ) : null}
        {pricing.points.used > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-abu-hangat">Poin dipakai</dt>
            <dd className="whitespace-nowrap text-sukses tabular-nums" data-testid="poin-dipakai">
              -{formatRupiah(pricing.points.used)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-garis pt-3 text-base">
          <dt className="font-semibold text-kopi">Total bayar</dt>
          <dd className="font-semibold whitespace-nowrap text-kopi tabular-nums" data-testid="total-bayar">
            {formatRupiah(pricing.total)}
          </dd>
        </div>
      </dl>
    </>
  );
}

// Desktop: kartu menempel di kanan. HP: bar total di bawah yang bisa dibuka menjadi rincian.
export function OrderSummary({ cart, pricing, loading }: { cart: CartView; pricing: PricedCart; loading: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden lg:sticky lg:top-[140px] lg:block lg:self-start" aria-label="Ringkasan pesanan">
        <div className={cn("rounded-card border border-garis bg-putih p-5 shadow-soft transition-opacity", loading && "opacity-70")}>
          <h2 className="font-serif text-xl text-kopi">Ringkasan pesanan</h2>
          <Rows cart={cart} pricing={pricing} />
        </div>
      </aside>
      <div data-fixed-summary className="fixed inset-x-0 bottom-16 z-30 border-t border-garis bg-putih/97 shadow-[0_-8px_24px_rgb(42_31_29/0.08)] backdrop-blur-md lg:hidden">
        {open ? (
          <div className="max-h-[55vh] overflow-y-auto px-4 pt-3" id="ringkasan-hp">
            <Rows cart={cart} pricing={pricing} />
          </div>
        ) : null}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="ringkasan-hp" className="flex w-full items-center justify-between gap-3 px-4 py-3">
          <span className="text-left">
            <span className="block text-xs text-abu-hangat">{open ? "Tutup rincian" : `Lihat rincian (${pricing.itemCount} barang)`}</span>
            <span className="font-semibold whitespace-nowrap text-kopi tabular-nums">{formatRupiah(pricing.total)}</span>
          </span>
          <ChevronUp className={cn("size-5 text-abu-hangat transition-transform", !open && "rotate-180")} aria-hidden />
        </button>
      </div>
    </>
  );
}
