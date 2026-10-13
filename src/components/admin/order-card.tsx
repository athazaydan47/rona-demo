import Link from "next/link";
import { Store, Truck } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import type { Packaging } from "@/db/schema/enums";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";

export type CardOrder = {
  id: number;
  number: string;
  status: string;
  method: "kirim" | "ambil";
  paymentMethod: string | null;
  name: string;
  total: number;
  courier: string | null;
  service: string | null;
  locationId: number;
  locationName: string;
  createdAt: string;
  itemCount: number;
  firstItem: { productName: string; shadeName: string; packaging: string; hex: string; brandColor: string; brandName: string } | null;
  canChange: boolean;
  canCancel: boolean;
};

export function OrderCardBody({ o }: { o: CardOrder }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 overflow-hidden rounded-md">{o.firstItem ? <ProductArt packaging={o.firstItem.packaging as Packaging} shade={o.firstItem.hex} brandColor={o.firstItem.brandColor} brandName={o.firstItem.brandName} title="" /> : null}</span>
        <span className="min-w-0 flex-1">
          <Link href={`/admin/pesanan/${o.number}`} className="block truncate text-sm font-semibold text-kopi tabular-nums hover:underline" draggable={false}>
            {o.number}
          </Link>
          <span className="block truncate text-xs text-abu-hangat">{o.name || "Tamu"}</span>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex min-w-0 items-center gap-1 text-abu-hangat">
          {o.method === "ambil" ? <Store className="size-3.5 shrink-0" aria-hidden /> : <Truck className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{o.method === "ambil" ? o.locationName : (o.service ?? "Kirim")}</span>
        </span>
        <span className="font-semibold whitespace-nowrap text-kopi tabular-nums">{formatRupiah(o.total)}</span>
      </div>
      <p className="mt-1 text-[11px] text-abu-hangat">
        {o.itemCount} barang · {formatDateTimeWib(new Date(o.createdAt))}
      </p>
    </>
  );
}
