"use client";

import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { quickCities, quoteShipping, type CourierCode, type Zone } from "@/lib/shipping";
import { cn } from "@/lib/utils";

const WEIGHTS = [
  { gram: 250, label: "1 produk kecil (250 g)" },
  { gram: 500, label: "2 sampai 3 produk (500 g)" },
  { gram: 1000, label: "Paket skincare (1 kg)" },
  { gram: 2000, label: "Belanja besar (2 kg)" },
];
const field = "h-11 w-full rounded-lg border border-garis bg-putih px-3 text-sm outline-none focus-visible:border-rona";

// Cek ongkir tanpa checkout: kota tujuan dan berat kira-kira, tarif dari Pengaturan toko (sama dengan checkout).
export function OngkirChecker({ rates, active }: { rates: Partial<Record<CourierCode, Record<Zone, number | null>>>; active: CourierCode[] }) {
  const [city, setCity] = useState(quickCities[0].slug);
  const [gram, setGram] = useState(500);
  const quotes = useMemo(() => quoteShipping({ totalGram: gram, citySlug: city, rates, active }), [city, gram, rates, active]);
  const pickup = active.includes("ambil_di_toko");
  return (
    <div className="rounded-card border border-garis bg-putih p-4 sm:p-5" data-testid="cek-ongkir">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Kota tujuan</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} className={field} aria-label="Kota tujuan">
            {quickCities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}, {c.province}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Perkiraan berat</span>
          <select value={gram} onChange={(e) => setGram(Number(e.target.value))} className={field} aria-label="Perkiraan berat">
            {WEIGHTS.map((w) => (
              <option key={w.gram} value={w.gram}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="mt-4 divide-y divide-garis" aria-live="polite">
        {quotes.map((q, i) => (
          <li key={q.code} className="flex items-center gap-3 py-2.5 text-sm">
            <Truck className={cn("size-4 shrink-0", i === 0 ? "text-rona" : "text-abu-hangat")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-kopi">
                {q.name} {q.service}
              </span>
              <span className="block text-xs text-abu-hangat">{q.etaLabel}</span>
            </span>
            <span className="font-semibold text-kopi tabular-nums">{formatRupiah(q.cost)}</span>
          </li>
        ))}
        {!quotes.length ? <li className="py-4 text-center text-sm text-abu-hangat">Belum ada kurir untuk kota ini.</li> : null}
        {pickup ? (
          <li className="flex items-center gap-3 py-2.5 text-sm">
            <Truck className="size-4 shrink-0 text-sukses" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-kopi">Ambil di Toko</span>
              <span className="block text-xs text-abu-hangat">Di cabang yang punya stoknya, siap sekitar 2 jam setelah pesan</span>
            </span>
            <span className="font-semibold text-sukses">Gratis</span>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-abu-hangat">Tarif per kg dengan toleransi 300 gram. Angka pasti tampil di checkout setelah alamat dan kecamatan terisi.</p>
    </div>
  );
}
