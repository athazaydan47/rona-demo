"use client";

import { useEffect, useState } from "react";
import { Truck, Zap } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { cheapestAndFastest, quickCities, quoteShipping } from "@/lib/shipping";
import { kunciLokal } from "@/config/merek";

const KEY = kunciLokal("kota");

export function ShippingEstimate({ weightGram, rates, active }: { weightGram: number; rates?: Parameters<typeof quoteShipping>[0]["rates"]; active?: Parameters<typeof quoteShipping>[0]["active"] }) {
  const [city, setCity] = useState<string>("");
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(KEY);
        if (saved && quickCities.some((c) => c.slug === saved)) setCity(saved);
      } catch {
        // abaikan
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const quotes = city ? quoteShipping({ totalGram: weightGram, citySlug: city, rates, active }) : [];
  const { cheapest, fastest } = cheapestAndFastest(quotes);
  return (
    <div className="rounded-card border border-garis bg-putih p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-kopi">
          <Truck className="size-4 text-aksen" aria-hidden /> Estimasi ongkir
        </p>
        <label className="flex items-center gap-2 text-xs text-abu-hangat">
          Kirim ke
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              try {
                window.localStorage.setItem(KEY, e.target.value);
              } catch {
                // abaikan
              }
            }}
            className="h-9 rounded-pill border border-garis bg-putih px-3 text-sm text-kopi outline-none focus-visible:border-aksen focus-visible:shadow-ring"
            aria-label="Kota tujuan"
          >
            <option value="">Pilih kota</option>
            {quickCities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {city && cheapest && fastest ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-porselen p-3">
            <dt className="text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">Termurah</dt>
            <dd className="mt-1 font-semibold text-kopi tabular-nums">{formatRupiah(cheapest.cost)}</dd>
            <dd className="text-xs text-abu-hangat">
              {cheapest.name} {cheapest.service}, {cheapest.etaLabel.toLowerCase()}
            </dd>
          </div>
          <div className="rounded-xl bg-porselen p-3">
            <dt className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">
              <Zap className="size-3" aria-hidden /> Tercepat
            </dt>
            <dd className="mt-1 font-semibold text-kopi tabular-nums">{formatRupiah(fastest.cost)}</dd>
            <dd className="text-xs text-abu-hangat">
              {fastest.name} {fastest.service}, {fastest.etaLabel.toLowerCase()}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-abu-hangat">Pilih kota untuk melihat kurir termurah dan tercepat. Berat tagih dihitung dari {weightGram} gram.</p>
      )}
    </div>
  );
}
