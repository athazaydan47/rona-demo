import Link from "next/link";
import { ChevronRight, PenLine } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Badge } from "@/components/ui/badge";
import type { AccountOrderCard } from "@/lib/account/orders";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";
import { statusTone } from "@/components/order/order-parts";
import { statusLabels } from "@/lib/orders/status";

// Kartu pesanan di /akun: ProductArt, nomor, tanggal WIB, total, status. Seluruh kartu menuju /pesanan/[nomor].
export function OrderCard({ order }: { order: AccountOrderCard }) {
  const first = order.items[0];
  const unreviewed = order.status === "selesai" ? order.items.filter((i) => !i.reviewed) : [];
  return (
    <article className="rounded-card border border-garis bg-putih transition-colors hover:border-kopi/25" data-testid="kartu-pesanan">
      <Link href={`/pesanan/${order.number}`} className="flex items-center gap-4 p-4">
        <span className="relative w-16 shrink-0 overflow-hidden rounded-xl">
          {first ? <ProductArt packaging={first.packaging} shade={first.hex} brandColor={first.brandColor} brandName={first.brandName} title={first.productName} /> : null}
          {order.items.length > 1 ? <span className="absolute right-1 bottom-1 rounded-full bg-kopi/85 px-1.5 text-[10px] font-bold text-putih tabular-nums">+{order.items.length - 1}</span> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-kopi tabular-nums">{order.number}</span>
            <Badge variant={statusTone[order.status]}>{statusLabels[order.status]}</Badge>
          </span>
          <span className="mt-0.5 block truncate text-sm text-kopi/85">{first ? first.productName : "Pesanan"}</span>
          <span className="mt-0.5 block text-xs text-abu-hangat">
            {formatDateTimeWib(order.createdAt)} · {order.itemCount} barang · <span className="font-semibold whitespace-nowrap text-kopi tabular-nums">{formatRupiah(order.total)}</span>
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-abu-hangat" aria-hidden />
      </Link>
      {unreviewed.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-garis px-4 py-2.5">
          {unreviewed.slice(0, 3).map((i) => (
            <Link key={i.orderItemId} href={`/akun/ulasan/${i.orderItemId}`} className="inline-flex items-center gap-1.5 rounded-pill bg-blush/70 px-3 py-1 text-xs font-semibold text-aksen-gelap hover:bg-blush">
              <PenLine className="size-3.5" aria-hidden /> Tulis ulasan<span className="sr-only"> {i.productName}</span>
              {order.items.length > 1 ? <span className="max-w-32 truncate font-normal"> {i.productName}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
