import { Clock, MapPin, PackageCheck, Store, Truck } from "lucide-react";
import type { LiveLocation } from "@/lib/product/queries";
import { cn } from "@/lib/utils";

type Props = { locations: LiveLocation[]; stock: Record<string, number>; shadeName?: string };

function stockLabel(qty: number) {
  if (qty <= 0) return { text: "Habis", tone: "text-bahaya" };
  if (qty <= 5) return { text: `Stok terbatas, sisa ${qty}`, tone: "text-peringatan" };
  return { text: `Tersedia ${qty}`, tone: "text-sukses" };
}

// Ketersediaan shade terpilih di Gudang Online dan tiap cabang, dibaca segar.
export function StockByStore({ locations, stock, shadeName }: Props) {
  return (
    <div className="rounded-card border border-garis bg-putih">
      <div className="flex items-center justify-between border-b border-garis px-4 py-2.5">
        <p className="text-sm font-semibold text-kopi">Ketersediaan{shadeName ? ` shade ${shadeName}` : ""}</p>
        <p className="text-[11px] text-abu-hangat">Diperbarui saat halaman dibuka</p>
      </div>
      <ul className="divide-y divide-garis">
        {locations.map((loc) => {
          const qty = stock[loc.slug] ?? 0;
          const s = stockLabel(qty);
          const Icon = loc.type === "gudang" ? Truck : Store;
          const hint = qty > 0 ? (loc.type === "gudang" ? (loc.shipsToday ? "Dikirim hari ini" : "Dikirim hari kerja berikutnya") : loc.pickupToday ? "Bisa diambil hari ini" : loc.openNow ? "Ambil setelah pesan, sebelum tutup" : "Toko sedang tutup, ambil besok") : null;
          return (
            <li key={loc.slug} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-porselen text-abu-hangat">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-kopi">{loc.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-abu-hangat">
                  {loc.type === "toko" ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden /> {loc.district}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" aria-hidden /> {loc.hoursLabel}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-sm font-semibold tabular-nums", s.tone)}>{s.text}</p>
                {hint ? (
                  <p className={cn("inline-flex items-center gap-1 text-[11px]", loc.shipsToday || loc.pickupToday ? "text-sukses" : "text-abu-hangat")}>
                    <PackageCheck className="size-3" aria-hidden /> {hint}
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
