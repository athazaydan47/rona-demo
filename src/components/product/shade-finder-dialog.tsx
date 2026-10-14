"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { depthLabels, suggestShades, undertoneGuide, type SkinProfile, type Undertone } from "@/lib/shade";
import type { ProductVariantDetail } from "@/lib/product/queries";
import { cn } from "@/lib/utils";
import { tandaiLangkah } from "@/lib/demo/panduan";

type Props = {
  variants: ProductVariantDetail[];
  profile: SkinProfile | null;
  onSave: (profile: SkinProfile) => void;
  onPick: (variantId: number) => void;
};

export function ShadeFinderDialog({ variants, profile, onSave, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(profile ? 3 : 1);
  const [depth, setDepth] = useState<number | null>(profile?.depth ?? null);
  const [undertone, setUndertone] = useState<Undertone | null>(profile?.undertone ?? null);
  const result = depth && undertone ? suggestShades(variants, { depth, undertone }) : [];

  const reset = () => {
    setStep(1);
    setDepth(profile?.depth ?? null);
    setUndertone(profile?.undertone ?? null);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setStep(profile ? 3 : 1);
          tandaiLangkah("shade");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-rona/40 bg-blush/60 px-3 text-xs font-semibold text-rona-gelap transition-colors hover:bg-blush">
          <Sparkles className="size-3.5" /> Cari shade-ku
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[20px] bg-putih p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-lift outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:inset-auto md:top-1/2 md:left-1/2 md:w-[560px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-rona uppercase">Shade Finder</p>
              <Dialog.Title className="mt-1 font-serif text-2xl text-kopi">
                {step === 1 ? "Seberapa terang kulitmu?" : step === 2 ? "Undertone kulitmu?" : "Shade yang paling cocok"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-abu-hangat">
                {step === 1 ? "Pilih yang paling mirip dengan bagian rahang di bawah cahaya alami." : step === 2 ? "Dua cara cepat: lihat warna urat nadi di pergelangan tangan, atau perhiasan mana yang lebih menyatu." : "Berbasis aturan dari data kedalaman dan undertone tiap shade, bukan AI."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>

          {step === 1 ? (
            <ul className="mt-5 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Kedalaman kulit">
              {depthLabels.map((d) => (
                <li key={d.depth}>
                  <button type="button" role="radio" aria-checked={depth === d.depth} onClick={() => setDepth(d.depth)} className={cn("flex w-full flex-col items-center gap-2 rounded-card border-2 p-3 text-center transition-colors", depth === d.depth ? "border-kopi" : "border-garis hover:border-kopi/30")}>
                    <span className="size-14 rounded-full shadow-[inset_0_-4px_8px_rgb(0_0_0/0.12)]" style={{ backgroundColor: d.hex }} />
                    <span className="text-sm font-semibold text-kopi">{d.label}</span>
                    <span className="text-[11px] text-abu-hangat">{d.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {step === 2 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Undertone">
              {undertoneGuide.map((u) => (
                <li key={u.value}>
                  <button type="button" role="radio" aria-checked={undertone === u.value} onClick={() => setUndertone(u.value)} className={cn("flex w-full items-start gap-3 rounded-card border-2 p-3 text-left transition-colors sm:flex-col sm:items-center sm:text-center", undertone === u.value ? "border-kopi" : "border-garis hover:border-kopi/30")}>
                    <span className="size-12 shrink-0 rounded-full shadow-[inset_0_-4px_8px_rgb(0_0_0/0.12)]" style={{ backgroundColor: u.hex }} />
                    <span>
                      <span className="block text-sm font-semibold text-kopi">{u.label}</span>
                      <span className="block text-[11px] text-abu-hangat">{u.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {step === 3 ? (
            <div className="mt-5">
              {result.length === 0 ? (
                <p className="text-sm text-abu-hangat">Produk ini belum punya data shade yang cukup.</p>
              ) : (
                <ul className="space-y-2">
                  {result.map((r, i) => (
                    <li key={r.variant.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick(r.variant.id);
                          setOpen(false);
                        }}
                        className={cn("flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors hover:border-kopi/40", i === 0 ? "border-rona bg-blush/40" : "border-garis")}
                      >
                        <span className="size-12 shrink-0 rounded-full border border-kopi/10 shadow-[inset_0_-3px_6px_rgb(0_0_0/0.14)]" style={{ backgroundColor: r.variant.hex }} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-semibold text-kopi">
                            {r.variant.shadeName}
                            {i === 0 ? <span className="rounded-pill bg-rona px-2 py-0.5 text-[10px] font-bold text-putih uppercase">Paling cocok</span> : null}
                          </span>
                          <span className="block text-xs text-abu-hangat">{r.reason}</span>
                        </span>
                        <Check className="size-4 shrink-0 text-abu-hangat" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-abu-hangat">
                Profil: {depthLabels.find((d) => d.depth === depth)?.label ?? "-"}, undertone {undertoneGuide.find((u) => u.value === undertone)?.label ?? "-"}. Disimpan di perangkat ini supaya produk lain ikut ditandai.
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => (step === 3 ? reset() : setStep(1))}>
                {step === 3 ? "Ulangi" : "Kembali"}
              </Button>
            ) : (
              <span />
            )}
            {step === 1 ? (
              <Button disabled={depth == null} onClick={() => setStep(2)}>
                Lanjut
              </Button>
            ) : step === 2 ? (
              <Button
                disabled={undertone == null}
                onClick={() => {
                  if (depth && undertone) onSave({ depth, undertone });
                  setStep(3);
                }}
              >
                Lihat hasil
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Selesai
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
