"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { undertoneLabels } from "@/lib/catalog/filters";
import type { ProductVariantDetail } from "@/lib/product/queries";
import { cn } from "@/lib/utils";

type Props = {
  variants: ProductVariantDetail[];
  selectedId: number;
  onSelect: (id: number) => void;
  availability: Record<number, number>; // variantId -> total tersedia
  matchIds?: Set<number>; // shade yang cocok dengan profil tersimpan
  bestMatchId?: number | null;
  action?: React.ReactNode; // tombol "Cari shade-ku"
};

const filters = ["semua", "warm", "neutral", "cool"] as const;

export function SwatchPicker({ variants, selectedId, onSelect, availability, matchIds, bestMatchId, action }: Props) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("semua");
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const visible = variants.filter((v) => filter === "semua" || v.undertone === filter);
  const hasUndertones = variants.some((v) => v.undertone);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-kopi">
          Shade: <span className="font-semibold">{selected.shadeName}</span>
          <span className="ml-2 text-xs text-abu-hangat tabular-nums">{variants.length} shade</span>
        </p>
        {action}
      </div>
      {hasUndertones ? (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter undertone">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn("h-8 rounded-pill border px-3 text-xs font-medium transition-colors", filter === f ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih text-kopi hover:border-kopi/30")}
            >
              {f === "semua" ? "Semua" : undertoneLabels[f]}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="mt-3 grid grid-cols-5 gap-x-2 gap-y-3 sm:grid-cols-6"
        role="radiogroup"
        aria-label="Pilih shade"
        onKeyDown={(e) => {
          // Keyboard seperti radio: panah kiri/kanan dan atas/bawah memindahkan fokus dan memilih shade berikutnya.
          const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const idx = visible.findIndex((x) => x.id === selectedId);
          const next = visible[(idx + step + visible.length) % visible.length];
          if (!next) return;
          onSelect(next.id);
          e.currentTarget.querySelector<HTMLElement>(`[data-shade-id="${next.id}"]`)?.focus();
        }}
      >
        {visible.map((v) => {
          const active = v.id === selectedId;
          const out = (availability[v.id] ?? 0) <= 0;
          const match = matchIds?.has(v.id);
          return (
            <div key={v.id} className="min-w-0">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${v.shadeName}${out ? ", habis" : ""}${match ? ", cocok untukmu" : ""}`}
                onClick={() => onSelect(v.id)}
                tabIndex={active ? 0 : -1}
                data-shade-id={v.id}
                className="group flex w-full flex-col items-center gap-1 rounded-lg text-center"
              >
                <span className={cn("relative grid size-11 place-items-center rounded-full border-2 transition-[transform,border-color] duration-150", active ? "scale-105 border-kopi" : "border-transparent group-hover:border-garis")}>
                  <span className={cn("size-9 rounded-full border border-kopi/10 shadow-[inset_0_-3px_6px_rgb(0_0_0/0.14),inset_0_2px_3px_rgb(255_255_255/0.35)]", out && "opacity-45")} style={{ backgroundColor: v.hex }} />
                  {active ? <Check className="absolute size-4 text-putih drop-shadow" aria-hidden /> : null}
                  {out ? <span className="absolute h-[2px] w-11 rotate-45 rounded bg-kopi/70" aria-hidden /> : null}
                  {match && !active ? (
                    <span className={cn("absolute -top-1 -right-1 grid size-4 place-items-center rounded-full text-putih", v.id === bestMatchId ? "bg-rona" : "bg-sage")} aria-hidden>
                      <Sparkles className="size-2.5" />
                    </span>
                  ) : null}
                </span>
                <span className={cn("line-clamp-2 text-[11px] leading-tight", active ? "font-semibold text-kopi" : "text-abu-hangat", out && "line-through")}>{v.shadeName}</span>
              </button>
            </div>
          );
        })}
      </div>
      {visible.length === 0 ? <p className="mt-3 text-sm text-abu-hangat">Tidak ada shade dengan undertone ini.</p> : null}
      {matchIds && matchIds.size > 0 ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-abu-hangat">
          <Sparkles className="size-3 text-rona" /> Tanda kilau: cocok dengan profil shade-mu.
        </p>
      ) : null}
    </div>
  );
}
