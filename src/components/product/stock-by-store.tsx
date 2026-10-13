import { Clock, MapPin, PackageCheck, Store, Truck } from "lucide-react";
import { fulfillmentHint, stockLabel } from "@/lib/product/availability";
import type { LiveLocation } from "@/lib/product/queries";
import { cn } from "@/lib/utils";

type Props = { locations: LiveLocation[]; stock: Record<string, number>; shadeName?: string };

const toneClass = { habis: "text-bahaya", terbatas: "text-peringatan", tersedia: "text-sukses" } as const;

// Ketersediaan shade terpilih di Gudang Online dan tiap cabang, dibaca segar.
// HP: bertumpuk (nama dan stok, lalu alamat dan jam, lalu keterangan). Desktop: ikon, info, status di kanan.
export function StockByStore({ locations, stock, shadeName }: Props) {
  return (
    <div className="rounded-card border border-garis bg-putih">
      <div className="flex items-center justify-between gap-2 border-b border-garis px-4 py-2.5">
        <p className="text-sm font-semibold text-kopi">Ketersediaan{shadeName ? ` shade ${shadeName}` : ""}</p>
        <p className="shrink-0 text-[11px] text-abu-hangat">Diperbarui saat dibuka</p>
      </div>
      <ul className="divide-y divide-garis">
        {locations.map((loc) => {
          const qty = stock[loc.slug] ?? 0;
          const s = stockLabel(qty);
          const hint = fulfillmentHint(loc, qty);
          const Icon = loc.type === "gudang" ? Truck : Store;
          return (
            <li key={loc.slug} className="px-4 py-3 md:flex md:items-start md:gap-3">
              <span className="mt-0.5 hidden size-8 shrink-0 place-items-center rounded-full bg-porselen text-abu-hangat md:grid">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 md:flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-kopi">
                    <Icon className="size-3.5 shrink-0 text-abu-hangat md:hidden" aria-hidden />
                    <span className="truncate">{loc.name}</span>
                  </p>
                  <p className={cn("shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums md:hidden", toneClass[s.tone])}>{s.text}</p>
                </div>
                <p className="mt-0.5 flex min-w-0 items-center gap-x-2 text-xs text-abu-hangat">
                  {loc.type === "toko" ? (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{loc.district}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                    <Clock className="size-3 shrink-0" aria-hidden /> {loc.hoursLabel}
                  </span>
                </p>
                {hint ? (
                  <p className={cn("mt-1 inline-flex items-center gap-1 text-[11px] md:hidden", hint.good ? "text-sukses" : "text-abu-hangat")}>
                    <PackageCheck className="size-3 shrink-0" aria-hidden /> {hint.text}
                  </p>
                ) : null}
              </div>
              <div className="hidden shrink-0 text-right md:block">
                <p className={cn("text-sm font-semibold whitespace-nowrap tabular-nums", toneClass[s.tone])}>{s.text}</p>
                {hint ? (
                  <p className={cn("inline-flex items-center gap-1 text-[11px] whitespace-nowrap", hint.good ? "text-sukses" : "text-abu-hangat")}>
                    <PackageCheck className="size-3" aria-hidden /> {hint.text}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
