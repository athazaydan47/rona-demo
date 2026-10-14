"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Loader2, Moon, ShoppingBag, Sun } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import type { Packaging } from "@/db/schema/enums";
import { addManyToCart } from "@/lib/cart/client-cart";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RoutineItemView = { productId: number; variantId: number; slug: string; name: string; brandName: string; brandColor: string; packaging: Packaging; hex: string; price: number; normalPrice: number; onlineStock: number };
export type RoutineStepView = { key: string; label: string; options: RoutineItemView[] };

function Step({ step, n, chosen, onChoose }: { step: RoutineStepView; n: number; chosen: number; onChoose: (i: number) => void }) {
  const main = step.options[chosen];
  return (
    <li className="rounded-xl border border-garis bg-putih p-3" data-testid="langkah-rutinitas">
      <p className="mb-2 text-xs font-semibold tracking-wide text-abu-hangat uppercase">
        {n}. {step.label}
      </p>
      <div className="flex gap-3">
        <Link href={`/p/${main.slug}`} className="w-16 shrink-0 overflow-hidden rounded-lg">
          <ProductArt packaging={main.packaging} shade={main.hex} brandColor={main.brandColor} brandName={main.brandName} title={main.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-abu-hangat uppercase">{main.brandName}</p>
          <Link href={`/p/${main.slug}`} className="text-sm font-semibold hover:underline">
            {main.name}
          </Link>
          <PriceTag price={main.price} normalPrice={main.normalPrice} size="sm" />
          {main.onlineStock <= 0 ? <p className="text-[11px] text-bahaya">Stok online habis</p> : null}
        </div>
      </div>
      {step.options.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Pilihan ${step.label}`}>
          {step.options.map((o, i) => (
            <button key={o.productId} type="button" role="radio" aria-checked={i === chosen} onClick={() => onChoose(i)} className={cn("rounded-pill border px-2.5 py-1 text-[11px]", i === chosen ? "border-kopi bg-kopi text-putih" : "border-garis bg-porselen text-kopi")}>
              {i === 0 ? "Utama" : `Alternatif ${i}`}: {o.name.length > 26 ? `${o.name.slice(0, 24)}…` : o.name}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function RoutineView({ pagi, malam, warnings }: { pagi: RoutineStepView[]; malam: RoutineStepView[]; warnings: { id: string; text: string }[] }) {
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pick = (time: string, s: RoutineStepView, i: number) => s.options[choice[`${time}:${i}`] ?? 0];
  const chosen = [...pagi.map((s, i) => pick("pagi", s, i)), ...malam.map((s, i) => pick("malam", s, i))];
  const unique = new Map(chosen.map((c) => [c.variantId, c]));
  const total = [...unique.values()].reduce((s, p) => s + p.price, 0);

  const section = (time: "pagi" | "malam", steps: RoutineStepView[]) => (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-serif text-2xl text-kopi">
        {time === "pagi" ? <Sun className="size-5 text-emas" aria-hidden /> : <Moon className="size-5 text-kopi" aria-hidden />} {time === "pagi" ? "Pagi" : "Malam"}
      </h2>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <Step key={`${time}-${s.key}-${i}`} step={s} n={i + 1} chosen={choice[`${time}:${i}`] ?? 0} onChoose={(c) => setChoice((x) => ({ ...x, [`${time}:${i}`]: c }))} />
        ))}
      </ol>
    </section>
  );

  return (
    <div className="space-y-6">
      {warnings.length ? (
        <section className="rounded-xl border border-peringatan/40 bg-[#FBEEDC] p-4" data-testid="peringatan-bahan">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#8A5512]">
            <Info className="size-4" aria-hidden /> Saran pemakaian
          </h2>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-[#8A5512]">
            {warnings.map((w) => (
              <li key={w.id}>{w.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-6 md:grid-cols-2">
        {section("pagi", pagi)}
        {section("malam", malam)}
      </div>
      <div className="sticky bottom-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-garis bg-putih/95 p-3 backdrop-blur md:bottom-4">
        <div>
          <p className="text-xs text-abu-hangat">{unique.size} produk, produk yang dipakai pagi dan malam dihitung sekali</p>
          <p className="font-serif text-xl text-kopi tabular-nums" data-testid="total-rutinitas">
            {formatRupiah(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message ? (
            <span className={cn("text-xs", state === "ok" ? "text-sukses" : "text-bahaya")} role="status">
              {message}
            </span>
          ) : null}
          <Button
            disabled={state === "busy"}
            onClick={async () => {
              setState("busy");
              const items = [...unique.values()].filter((p) => p.onlineStock > 0).map((p) => ({ variantId: p.variantId, quantity: 1 }));
              const r = await addManyToCart(items, { source: "rutinitas" });
              setState(r.ok ? "ok" : "fail");
              setMessage(r.ok ? (r.message ?? "Semua masuk keranjang") : (r.message ?? "Gagal menambah"));
            }}
            data-testid="tambah-semua"
          >
            {state === "busy" ? <Loader2 className="animate-spin" /> : <ShoppingBag />} Tambah semua ke keranjang
          </Button>
        </div>
      </div>
    </div>
  );
}
