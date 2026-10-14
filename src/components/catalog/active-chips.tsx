"use client";

import { Chip } from "@/components/ui/chip";
import { activeFilterChips, clearFilters, countActiveFilters, type CatalogFilters } from "@/lib/catalog/filters";
import { useCatalogUrl } from "./use-catalog-url";

export type FilterLabels = { brands: Record<string, string>; locations: Record<string, string>; categories?: Record<string, string> };

export function ActiveChips({ filters, labels, basePath, locked = [], prefix }: { filters: CatalogFilters; labels: FilterLabels; basePath: string; locked?: string[]; prefix?: string }) {
  const { apply } = useCatalogUrl(basePath);
  const chips = activeFilterChips(filters, labels).filter((c) => !locked.includes(c.key));
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={prefix ?? "Filter aktif"} data-testid={prefix ? "chip-tafsiran" : undefined}>
      {prefix ? <span className="text-sm text-abu-hangat">{prefix}</span> : null}
      {chips.map((c, i) => (
        <Chip key={`${c.key}-${i}`} selected onRemove={() => apply(c.next)}>
          {c.label}
        </Chip>
      ))}
      {countActiveFilters(filters) > 1 ? (
        <button type="button" onClick={() => apply(clearFilters(filters))} className="text-sm font-semibold text-aksen hover:underline">
          Hapus semua
        </button>
      ) : null}
    </div>
  );
}
