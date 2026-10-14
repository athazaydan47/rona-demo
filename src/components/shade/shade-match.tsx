"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Loader2, Palette, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/lib/cart/client-cart";
import type { ShadeMatch } from "@/lib/catalog/tools";
import { formatRupiah } from "@/lib/format";
import { interpretShadeTextAction, shadeMatchAction, shadeSourcesAction, type ShadeSourceProduct } from "@/lib/skin/actions";
import { cn } from "@/lib/utils";

const field = "h-10 w-full rounded-lg border border-garis bg-putih px-3 text-sm text-kopi outline-none focus-visible:border-aksen";

export function ShadeMatchPanel({ group, targetProductId, excludeProductId, aiAvailable }: { group?: string; targetProductId?: number; excludeProductId?: number; aiAvailable: boolean }) {
  const [sources, setSources] = useState<ShadeSourceProduct[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ sumber: { produk: string; shade: string; hex: string } | null; hasil: ShadeMatch[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [pending, run] = useTransition();

  useEffect(() => {
    let alive = true;
    shadeSourcesAction(group ?? null).then((s) => {
      if (!alive) return;
      const list = s.filter((p) => p.id !== excludeProductId);
      setSources(list);
      setProductId(list[0]?.id ?? null);
      setVariantId(list[0]?.variants[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [group, excludeProductId]);

  const product = sources.find((p) => p.id === productId);
  const find = (id: number) =>
    run(async () => {
      setMessage(null);
      const r = await shadeMatchAction(id, targetProductId ?? null);
      setResult(r);
      if (!r.hasil.length) setMessage("Belum ada shade yang bisa dibandingkan untuk pilihan ini.");
    });

  return (
    <div className="space-y-3" data-testid="padanan-shade">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Produk yang biasa kamu pakai</span>
          <select
            value={productId ?? ""}
            onChange={(e) => {
              const p = sources.find((x) => x.id === Number(e.target.value));
              setProductId(p?.id ?? null);
              setVariantId(p?.variants[0]?.id ?? null);
            }}
            className={field}
            aria-label="Produk yang biasa kamu pakai"
          >
            {sources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName} {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Shade-nya</span>
          <select value={variantId ?? ""} onChange={(e) => setVariantId(Number(e.target.value))} className={field} aria-label="Shade yang biasa kamu pakai">
            {product?.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.shadeName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button onClick={() => variantId && find(variantId)} disabled={!variantId || pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Palette />} Cari padanan
      </Button>
      {aiAvailable ? (
        <form
          className="rounded-xl border border-dashed border-garis p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              setMessage(null);
              const r = await interpretShadeTextAction(text);
              if (!r.ok) return setMessage(r.message);
              const p = sources.find((s) => s.variants.some((v) => v.id === r.varianId));
              if (p) {
                setProductId(p.id);
                setVariantId(r.varianId);
              }
              const m = await shadeMatchAction(r.varianId, targetProductId ?? null);
              setResult(m);
            });
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1 font-medium">
              <Sparkles className="size-3.5 text-aksen" aria-hidden /> Atau ceritakan saja
            </span>
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 160))} placeholder="Misal: aku pakai cushion Pualam shade 02" className={field} aria-label="Ceritakan shade yang kamu pakai" />
          </label>
          <p className="mt-1 text-[11px] text-abu-hangat">AI hanya mengenali produknya; padanan tetap dihitung algoritma dari data warna. Jawaban AI bisa keliru.</p>
        </form>
      ) : null}
      {message ? (
        <p className="text-sm text-abu-hangat" role="status">
          {message}
        </p>
      ) : null}
      {result?.hasil.length ? (
        <div>
          {result.sumber ? (
            <p className="mb-2 flex items-center gap-2 text-sm text-abu-hangat">
              <span className="size-4 rounded-full border border-garis" style={{ background: result.sumber.hex }} aria-hidden />
              Padanan untuk {result.sumber.produk}, {result.sumber.shade}:
            </p>
          ) : null}
          <ol className="space-y-2" data-testid="hasil-padanan">
            {result.hasil.map((h, i) => (
              <li key={h.varianId} className="flex items-center gap-3 rounded-xl border border-garis bg-putih p-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-kopi text-xs font-semibold text-putih">{i + 1}</span>
                <span className="size-9 shrink-0 rounded-full border border-garis shadow-inner" style={{ background: h.hex }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${h.produkSlug}`} className="block truncate text-sm font-semibold hover:underline">
                    {h.merek} {h.produk}, {h.shade}
                  </Link>
                  <p className="text-xs text-abu-hangat">{h.alasan}</p>
                  <p className="text-xs tabular-nums">{formatRupiah(h.harga)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={h.stokOnline <= 0}
                  onClick={async () => {
                    const r = await addToCart(h.varianId, 1, { source: "padanan_shade" });
                    if (r.ok) setAdded(h.varianId);
                  }}
                >
                  {h.stokOnline <= 0 ? "Habis online" : added === h.varianId ? "Ditambah" : "Tambah"}
                </Button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-abu-hangat">Dihitung dari jarak warna (deltaE), kedalaman, dan undertone. Warna layar bisa berbeda, coba tester di cabang bila ragu.</p>
        </div>
      ) : null}
    </div>
  );
}

export function ShadeMatchDialog({ group, productId, productName, aiAvailable }: { group: string; productId: number; productName: string; aiAvailable: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={cn("inline-flex h-8 items-center gap-1.5 rounded-pill border border-garis bg-putih px-3 text-xs font-semibold text-kopi hover:border-aksen/40")} data-testid="tombol-padanan">
          <Palette className="size-3.5" aria-hidden /> Cari padanan shade
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-porselen p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-lift outline-none md:inset-auto md:top-1/2 md:left-1/2 md:w-[600px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-serif text-2xl text-kopi">Cari padanan shade</Dialog.Title>
              <Dialog.Description className="text-sm text-abu-hangat">Pilih produk dan shade yang biasa kamu pakai. Kami carikan 3 shade {productName} yang paling dekat.</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-putih" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {open ? <ShadeMatchPanel group={group} targetProductId={productId} excludeProductId={productId} aiAvailable={aiAvailable} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
