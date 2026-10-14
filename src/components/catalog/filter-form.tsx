"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CatalogFacets } from "@/lib/catalog/facets";
import { concernLabels, finishLabels, skinTypeLabels, undertoneLabels, type CatalogFilters } from "@/lib/catalog/filters";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FilterLabels } from "./active-chips";

type FilterFormProps = {
  filters: CatalogFilters;
  facets: CatalogFacets;
  labels: FilterLabels;
  onChange: (next: CatalogFilters) => void;
  hide?: ("promo" | "brands" | "location")[];
  dense?: boolean;
};

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <fieldset className="border-t border-garis py-4 first:border-t-0 first:pt-0">
      <legend className="float-left mb-2 flex w-full items-center justify-between text-sm font-semibold text-kopi">
        {title}
        {count ? <span className="rounded-pill bg-blush px-2 py-0.5 text-[11px] font-semibold text-aksen-gelap tabular-nums">{count}</span> : null}
      </legend>
      <div className="clear-both space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({ label, count, checked, onChange, type = "checkbox", name }: { label: string; count?: number; checked: boolean; onChange: () => void; type?: "checkbox" | "radio"; name?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 text-sm text-kopi hover:text-aksen-gelap">
      <input id={id} type={type} name={name} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-aksen" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null ? <span className="text-xs text-abu-hangat tabular-nums">{count}</span> : null}
    </label>
  );
}

// Formulir filter yang dipakai panel desktop maupun bottom sheet HP. Facet hanya memuat opsi yang punya hasil.
export function FilterForm({ filters, facets, labels, onChange, hide = [], dense = false }: FilterFormProps) {
  const [brandQuery, setBrandQuery] = useState("");
  const [priceMin, setPriceMin] = useState(filters.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(filters.priceMax?.toString() ?? "");
  const brandSearchId = useId();

  const brandOptions = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    return facets.brands
      .map((b) => ({ ...b, name: labels.brands[b.value] ?? b.value }))
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [facets.brands, brandQuery, labels.brands]);

  const commitPrice = () => {
    const min = Number.parseInt(priceMin, 10);
    const max = Number.parseInt(priceMax, 10);
    onChange({ ...filters, priceMin: Number.isFinite(min) && min > 0 ? min : null, priceMax: Number.isFinite(max) && max > 0 ? max : null });
  };

  return (
    <div className={cn("text-sm", dense && "text-[13px]")}>
      <Section title="Harga">
        {facets.price ? (
          <p className="mb-2 text-xs text-abu-hangat">
            {formatRupiah(facets.price.min)} sampai {formatRupiah(facets.price.max)}
          </p>
        ) : null}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            commitPrice();
          }}
        >
          <label className="sr-only" htmlFor={`${brandSearchId}-min`}>
            Harga minimal
          </label>
          <input id={`${brandSearchId}-min`} inputMode="numeric" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, ""))} onBlur={commitPrice} className="h-9 w-full min-w-0 rounded-lg border border-garis px-2.5 text-sm tabular-nums outline-none focus-visible:border-aksen focus-visible:shadow-ring" />
          <span className="text-abu-hangat">sampai</span>
          <label className="sr-only" htmlFor={`${brandSearchId}-max`}>
            Harga maksimal
          </label>
          <input id={`${brandSearchId}-max`} inputMode="numeric" placeholder="Maks" value={priceMax} onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ""))} onBlur={commitPrice} className="h-9 w-full min-w-0 rounded-lg border border-garis px-2.5 text-sm tabular-nums outline-none focus-visible:border-aksen focus-visible:shadow-ring" />
          <button type="submit" className="sr-only">
            Terapkan harga
          </button>
        </form>
      </Section>

      {!hide.includes("brands") && facets.brands.length > 0 ? (
        <Section title="Merek" count={filters.brands.length}>
          {facets.brands.length > 5 ? (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-abu-hangat" aria-hidden />
              <label htmlFor={brandSearchId} className="sr-only">
                Cari merek
              </label>
              <input id={brandSearchId} value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder="Cari merek" className="h-9 w-full rounded-lg border border-garis pl-8 pr-2.5 text-sm outline-none focus-visible:border-aksen focus-visible:shadow-ring" />
            </div>
          ) : null}
          <div className="max-h-56 overflow-y-auto pr-1">
            {brandOptions.map((b) => (
              <Check key={b.value} label={b.name} count={b.count} checked={filters.brands.includes(b.value)} onChange={() => onChange({ ...filters, brands: toggle(filters.brands, b.value) })} />
            ))}
            {brandOptions.length === 0 ? <p className="py-1 text-xs text-abu-hangat">Tidak ada merek yang cocok.</p> : null}
          </div>
        </Section>
      ) : null}

      {facets.ratings.length > 0 ? (
        <Section title="Rating minimal">
          {facets.ratings.map((r) => (
            <Check key={r.value} type="radio" name="rating" label={`${r.value.replace(".", ",")} ke atas`} count={r.count} checked={filters.ratingMin === Number(r.value)} onChange={() => onChange({ ...filters, ratingMin: filters.ratingMin === Number(r.value) ? null : Number(r.value) })} />
          ))}
        </Section>
      ) : null}

      {facets.skinTypes.length > 0 ? (
        <Section title="Jenis kulit" count={filters.skinTypes.length}>
          {facets.skinTypes.map((s) => (
            <Check key={s.value} label={skinTypeLabels[s.value] ?? s.value} count={s.count} checked={filters.skinTypes.includes(s.value)} onChange={() => onChange({ ...filters, skinTypes: toggle(filters.skinTypes, s.value) })} />
          ))}
        </Section>
      ) : null}

      {facets.concerns.length > 0 ? (
        <Section title="Masalah kulit" count={filters.concerns.length}>
          {facets.concerns.map((c) => (
            <Check key={c.value} label={concernLabels[c.value] ?? c.value} count={c.count} checked={filters.concerns.includes(c.value)} onChange={() => onChange({ ...filters, concerns: toggle(filters.concerns, c.value) })} />
          ))}
        </Section>
      ) : null}

      {facets.finishes.length > 0 ? (
        <Section title="Finish" count={filters.finishes.length}>
          {facets.finishes.map((x) => (
            <Check key={x.value} label={finishLabels[x.value] ?? x.value} count={x.count} checked={filters.finishes.includes(x.value)} onChange={() => onChange({ ...filters, finishes: toggle(filters.finishes, x.value) })} />
          ))}
        </Section>
      ) : null}

      {facets.undertones.length > 0 ? (
        <Section title="Undertone shade" count={filters.undertones.length}>
          {facets.undertones.map((u) => (
            <Check key={u.value} label={undertoneLabels[u.value] ?? u.value} count={u.count} checked={filters.undertones.includes(u.value)} onChange={() => onChange({ ...filters, undertones: toggle(filters.undertones, u.value) })} />
          ))}
        </Section>
      ) : null}

      {facets.spf > 0 || !hide.includes("promo") ? (
        <Section title="Lainnya">
          {facets.spf > 0 ? <Check label="Ada SPF" count={facets.spf} checked={filters.spf} onChange={() => onChange({ ...filters, spf: !filters.spf })} /> : null}
          {!hide.includes("promo") && facets.promo > 0 ? <Check label="Sedang promo" count={facets.promo} checked={filters.promo} onChange={() => onChange({ ...filters, promo: !filters.promo })} /> : null}
        </Section>
      ) : null}

      {!hide.includes("location") && facets.locations.length > 0 ? (
        <Section title="Tersedia di cabang">
          {facets.locations.map((l) => (
            <Check key={l.value} type="radio" name="cabang" label={labels.locations[l.value] ?? l.value} count={l.count} checked={filters.location === l.value} onChange={() => onChange({ ...filters, location: filters.location === l.value ? null : l.value })} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}
