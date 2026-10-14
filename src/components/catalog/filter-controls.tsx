"use client";

import { useSwipeDown } from "@/lib/use-swipe-down";

import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogFacets } from "@/lib/catalog/facets";
import { clearFilters, countActiveFilters, serializeCatalogParams, type CatalogFilters } from "@/lib/catalog/filters";
import type { FilterLabels } from "./active-chips";
import { FilterForm } from "./filter-form";
import { useCatalogUrl } from "./use-catalog-url";

type Props = {
  filters: CatalogFilters;
  facets: CatalogFacets;
  labels: FilterLabels;
  basePath: string;
  scopeQuery: string; // parameter cakupan untuk /api/katalog
  total: number;
  hide?: ("promo" | "brands" | "location")[];
};

// Panel kiri di desktop: perubahan langsung diterapkan ke URL.
export function FilterPanel({ filters, facets, labels, basePath, hide }: Omit<Props, "scopeQuery" | "total">) {
  const { apply, pending } = useCatalogUrl(basePath);
  const active = countActiveFilters(filters);
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filter produk">
      <div className="sticky top-[136px] max-h-[calc(100vh-152px)] overflow-y-auto rounded-card border border-garis bg-putih p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg text-kopi">Filter</h2>
          {active > 0 ? (
            <button type="button" onClick={() => apply(clearFilters(filters))} className="text-xs font-semibold text-rona hover:underline">
              Hapus semua ({active})
            </button>
          ) : null}
        </div>
        <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
          <FilterForm filters={filters} facets={facets} labels={labels} onChange={apply} hide={hide} />
        </div>
      </div>
    </aside>
  );
}

// Bottom sheet di HP: perubahan ditampung dulu, jumlah hasil dihitung di server, lalu diterapkan sekaligus.
export function FilterSheet({ filters, facets, labels, basePath, scopeQuery, total, hide }: Props) {
  const { apply } = useCatalogUrl(basePath);
  const [open, setOpen] = useState(false);
  const swipe = useSwipeDown(() => setOpen(false));
  const [pendingFilters, setPendingFilters] = useState(filters);
  const [count, setCount] = useState<number | null>(total);
  const abortRef = useRef<AbortController | null>(null);
  const active = countActiveFilters(filters);

  // Saat sheet dibuka, state tampungan disamakan dengan filter yang sedang berlaku.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setPendingFilters(filters);
      setCount(total);
    }
    setOpen(next);
  };

  const update = (next: CatalogFilters) => {
    setPendingFilters(next);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCount(null);
    const qs = serializeCatalogParams({ ...next, page: 1 });
    fetch(`/api/katalog?${scopeQuery}&${qs}&mode=hitung`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { total: number }) => setCount(data.total))
      .catch(() => {
        if (!controller.signal.aborted) setCount(null);
      });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="md" className="lg:hidden" aria-label="Buka filter">
          <SlidersHorizontal /> Filter{active > 0 ? ` (${active})` : ""}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          data-sheet
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-[20px] bg-putih shadow-lift outline-none transition-transform duration-[var(--durasi-lambat)] ease-[var(--ease-soft)] data-[state=closed]:translate-y-full data-[state=open]:translate-y-0"
        >
          <div className="touch-none pt-2" {...swipe} aria-hidden>
            <div className="mx-auto h-1 w-10 rounded-full bg-garis" />
          </div>
          <div className="flex items-center justify-between border-b border-garis px-5 py-3">
            <Dialog.Title className="font-serif text-xl text-kopi">Filter</Dialog.Title>
            <div className="flex items-center gap-2">
              {countActiveFilters(pendingFilters) > 0 ? (
                <button type="button" onClick={() => update(clearFilters(pendingFilters))} className="text-sm font-semibold text-rona hover:underline">
                  Hapus semua
                </button>
              ) : null}
              <Dialog.Close className="grid size-10 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup filter">
                <X className="size-5" />
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <FilterForm filters={pendingFilters} facets={facets} labels={labels} onChange={update} hide={hide} dense />
          </div>
          <div className="border-t border-garis p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                apply(pendingFilters);
                setOpen(false);
              }}
            >
              {count == null ? "Menghitung..." : count === 0 ? "Tidak ada produk yang cocok" : `Tampilkan ${count} produk`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
