"use client";

import { useEffect, useState } from "react";
import { Dialog, Popover } from "radix-ui";
import { Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { toast } from "@/components/ui/toast";
import { addToCart } from "@/lib/cart/client-cart";
import type { ProductCardVariant } from "@/lib/catalog/catalog-queries";
import { useSwipeDown } from "@/lib/use-swipe-down";
import { cn } from "@/lib/utils";

type QuickAddProps = {
  productName: string;
  variants: ProductCardVariant[];
  className?: string;
};

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

// Tombol tambah cepat di kartu: popover di desktop, bottom sheet di HP.
export function QuickAdd({ productName, variants, className }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();
  const swipe = useSwipeDown(() => setOpen(false));
  const anyStock = variants.some((v) => v.inStock);

  const trigger = (
    <button
      type="button"
      aria-label={`Tambah ${productName} ke keranjang`}
      disabled={!anyStock}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-putih/95 text-kopi shadow-soft transition-[background-color,color,transform] duration-200 hover:bg-rona hover:text-putih focus-visible:bg-rona focus-visible:text-putih disabled:opacity-50 md:size-10",
        className,
      )}
    >
      <ShoppingBag className="size-4" />
    </button>
  );

  const body = (
    <ShadePicker
      productName={productName}
      variants={variants}
      onDone={() => setOpen(false)}
    />
  );

  if (desktop) {
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            collisionPadding={16}
            className="z-50 w-80 rounded-card border border-garis bg-putih p-4 shadow-lift outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-shade]")?.focus();
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-semibold text-kopi">{productName}</p>
              <Popover.Close className="grid size-8 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup">
                <X className="size-4" />
              </Popover.Close>
            </div>
            {body}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          data-sheet
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[20px] bg-putih p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-lift outline-none transition-transform duration-[var(--durasi-lambat)] ease-[var(--ease-soft)] data-[state=closed]:translate-y-full data-[state=open]:translate-y-0"
        >
          <div className="-mx-5 -mt-5 cursor-grab touch-none px-5 pt-3 pb-1" {...swipe} aria-hidden>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-garis" />
          </div>
          <div className="mb-3 flex items-start justify-between gap-3">
            <Dialog.Title className="line-clamp-2 text-base font-semibold text-kopi">{productName}</Dialog.Title>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {body}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ShadePicker({ variants, onDone }: { productName: string; variants: ProductCardVariant[]; onDone: () => void }) {
  const firstAvailable = variants.find((v) => v.inStock) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const selected = variants.find((v) => v.id === selectedId) ?? firstAvailable;
  const multi = variants.length > 1;

  return (
    <div>
      {multi ? (
        <div role="radiogroup" aria-label="Pilih shade" className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const active = v.id === selected?.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${v.shadeName}${v.inStock ? "" : ", habis"}`}
                data-shade
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "relative grid size-9 place-items-center rounded-full border-2 transition-[transform,border-color] duration-150",
                  active ? "scale-110 border-kopi" : "border-transparent hover:scale-105",
                  !v.inStock && "opacity-45",
                )}
                title={v.shadeName}
              >
                <span className="size-7 rounded-full border border-kopi/10 shadow-[inset_0_-2px_4px_rgb(0_0_0/0.15)]" style={{ backgroundColor: v.hex }} />
                {active ? <Check className="absolute size-3.5 text-putih drop-shadow" /> : null}
                {!v.inStock ? <span className="absolute h-[2px] w-9 rotate-45 bg-kopi/70" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {selected ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-kopi">{multi ? selected.shadeName : variants[0]?.shadeName}</p>
            <PriceTag price={selected.price} normalPrice={selected.normalPrice} size="sm" />
          </div>
          <div className="flex items-center rounded-pill border border-garis">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-9 place-items-center rounded-full text-kopi hover:bg-porselen disabled:opacity-40" aria-label="Kurangi jumlah" disabled={qty <= 1}>
              <Minus className="size-4" />
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="grid size-9 place-items-center rounded-full text-kopi hover:bg-porselen" aria-label="Tambah jumlah">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      <Button
        className="mt-4 w-full"
        disabled={!selected || !selected.inStock || adding}
        onClick={async () => {
          if (!selected) return;
          setAdding(true);
          const r = await addToCart(selected.id, qty);
          setAdding(false);
          if (!r.ok) {
            toast({ title: "Belum bisa ditambahkan", description: r.message, tone: "info" });
            return;
          }
          if (r.message) toast({ title: "Ditambahkan ke keranjang", description: r.message, tone: "info" });
          onDone();
        }}
      >
        <ShoppingBag /> {selected && !selected.inStock ? "Shade ini habis" : "Tambah ke Keranjang"}
      </Button>
    </div>
  );
}
