"use client";

import { Popover, Tabs } from "radix-ui";
import { Info } from "lucide-react";
import { ingredientNote } from "@/lib/product/ingredients";
import type { ProductDetail } from "@/lib/product/queries";

function splitSteps(text: string) {
  return text
    .replace(/\s*Produk demo:[\s\S]*$/, "")
    .replace(/\s*Simpan (di|jauh).*?\.(?=\s|$)/g, "")
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function paragraphs(text: string) {
  return text
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .reduce<string[]>((acc, sentence) => {
      const last = acc[acc.length - 1];
      if (last && last.length < 160) acc[acc.length - 1] = `${last} ${sentence}`;
      else acc.push(sentence);
      return acc;
    }, []);
}

const triggerClass =
  "relative h-11 shrink-0 px-1 text-sm font-medium whitespace-nowrap text-abu-hangat transition-colors hover:text-kopi data-[state=active]:text-kopi after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-rona";

export function ProductTabs({ product, variantWeight }: { product: ProductDetail; variantWeight: number }) {
  const steps = splitSteps(product.howToUse);
  return (
    <Tabs.Root defaultValue="manfaat" className="rounded-card border border-garis bg-putih">
      <Tabs.List aria-label="Informasi produk" className="-mx-px flex gap-5 overflow-x-auto border-b border-garis px-5 scrollbar-none">
        <Tabs.Trigger value="manfaat" className={triggerClass}>
          Manfaat
        </Tabs.Trigger>
        <Tabs.Trigger value="kandungan" className={triggerClass}>
          Kandungan
        </Tabs.Trigger>
        <Tabs.Trigger value="cara" className={triggerClass}>
          Cara Pakai
        </Tabs.Trigger>
        <Tabs.Trigger value="detail" className={triggerClass}>
          Detail
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="manfaat" className="p-5 outline-none">
        {paragraphs(product.benefits).map((p, i) => (
          <p key={i} className="mt-3 text-base leading-7 text-kopi/90 first:mt-0">
            {p}
          </p>
        ))}
      </Tabs.Content>
      <Tabs.Content value="kandungan" className="p-5 outline-none">
        {product.activeIngredients.length > 0 ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-abu-hangat uppercase">Bahan aktif</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {product.activeIngredients.map((name) => (
                <li key={name}>
                  <Popover.Root>
                    <Popover.Trigger className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-sage/50 bg-[#E8EFE7] px-3 text-sm font-medium text-[#3F5A45] hover:bg-[#DCE8DA]">
                      {name} <Info className="size-3.5 opacity-70" aria-hidden />
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content sideOffset={6} collisionPadding={16} className="z-50 w-72 rounded-card border border-garis bg-putih p-4 text-sm text-kopi shadow-lift outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                        <p className="font-semibold">{name}</p>
                        <p className="mt-1 text-abu-hangat">{ingredientNote(name)}</p>
                        <Popover.Arrow className="fill-putih" />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-5 text-sm leading-6 text-kopi/85">{product.ingredients}</p>
      </Tabs.Content>
      <Tabs.Content value="cara" className="p-5 outline-none">
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-base leading-7 text-kopi/90">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-blush text-xs font-bold text-rona-gelap tabular-nums">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </Tabs.Content>
      <Tabs.Content value="detail" className="p-5 outline-none">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-abu-hangat">Nomor BPOM</dt>
          <dd className="font-medium text-kopi tabular-nums">{product.bpom} (fiktif)</dd>
          <dt className="text-abu-hangat">Netto</dt>
          <dd className="font-medium text-kopi">{product.netto}</dd>
          <dt className="text-abu-hangat">Kode barcode</dt>
          <dd className="font-medium text-kopi tabular-nums">{product.variants[0]?.barcode}</dd>
          <dt className="text-abu-hangat">Berat</dt>
          <dd className="font-medium text-kopi tabular-nums">{variantWeight} gram</dd>
          {product.finish ? (
            <>
              <dt className="text-abu-hangat">Finish</dt>
              <dd className="font-medium text-kopi capitalize">{product.finish}</dd>
            </>
          ) : null}
          {product.spf ? (
            <>
              <dt className="text-abu-hangat">SPF</dt>
              <dd className="font-medium text-kopi">SPF {product.spf}</dd>
            </>
          ) : null}
          <dt className="text-abu-hangat">Merek</dt>
          <dd className="font-medium text-kopi">{product.brand.name}</dd>
        </dl>
        <p className="mt-4 text-xs text-abu-hangat">Produk demo: nomor BPOM, barcode, dan registrasi di halaman ini fiktif.</p>
      </Tabs.Content>
    </Tabs.Root>
  );
}
