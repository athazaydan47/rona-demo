"use client";

import { ChevronDown } from "lucide-react";
import { SORT_KEYS, sortLabels, type CatalogFilters, type SortKey } from "@/lib/catalog/filters";
import { useCatalogUrl } from "./use-catalog-url";

export function SortSelect({ filters, basePath }: { filters: CatalogFilters; basePath: string }) {
  const { apply, pending } = useCatalogUrl(basePath);
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Urutkan</span>
      <select
        value={filters.sort}
        onChange={(e) => apply({ ...filters, sort: e.target.value as SortKey })}
        disabled={pending}
        className="h-10 appearance-none rounded-pill border border-garis bg-putih pr-9 pl-4 text-sm font-medium text-kopi outline-none hover:border-kopi/30 focus-visible:border-aksen focus-visible:shadow-ring"
      >
        {SORT_KEYS.map((k) => (
          <option key={k} value={k}>
            {k === "relevan" && !filters.q ? "Paling relevan" : sortLabels[k]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-abu-hangat" aria-hidden />
    </label>
  );
}
