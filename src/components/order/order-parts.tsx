import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/product-art";
import { formatRupiah } from "@/lib/format";
import type { OrderDetail } from "@/lib/orders/queries";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";

export const statusTone: Record<OrderStatus, "netral" | "sukses" | "menipis" | "habis" | "baru"> = {
  menunggu_pembayaran: "menipis",
  dibayar: "sukses",
  diproses: "baru",
  dikirim: "baru",
  siap_diambil: "sukses",
  selesai: "sukses",
  dibatalkan: "habis",
  diretur: "netral",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={statusTone[status]} data-testid="status-pesanan">
      {statusLabels[status]}
    </Badge>
  );
}

export function OrderItems({ order }: { order: OrderDetail }) {
  return (
    <ul className="divide-y divide-garis">
      {order.items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 py-3">
          <Link href={`/p/${i.productSlug}`} className="w-14 shrink-0 overflow-hidden rounded-lg">
            <ProductArt packaging={i.packaging} shade={i.hex} brandColor={i.brandColor} brandName={i.brandName} title={i.productName} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm text-kopi">{i.productName}</p>
            <p className="text-xs text-abu-hangat">
              {i.showShade ? `${i.shadeName} · ` : ""}
              <span className="tabular-nums">
                {i.quantity} x {formatRupiah(i.unitPrice)}
              </span>
              {i.priceSource === "flash" ? " · harga flash" : ""}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">{formatRupiah(i.unitPrice * i.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderCosts({ order }: { order: OrderDetail }) {
  const p = order.pricing;
  const row = (label: string, value: string, cls = "") => (
    <div className="flex justify-between gap-3">
      <dt className="text-abu-hangat">{label}</dt>
      <dd className={`whitespace-nowrap tabular-nums ${cls}`}>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2 text-sm">
      {row("Subtotal", formatRupiah(p.normalSubtotal))}
      {p.productDiscount > 0 ? row("Diskon produk", `-${formatRupiah(p.productDiscount)}`, "text-sukses") : null}
      {p.voucherDiscount > 0 ? row(`Voucher ${p.voucherCode ?? ""}`.trim(), `-${formatRupiah(p.voucherDiscount)}`, "text-sukses") : null}
      {order.method === "ambil" ? row("Ambil di toko", "Gratis") : row(`Ongkir${order.service ? ` (${order.service})` : ""}`, formatRupiah(p.shippingCost))}
      {p.shippingDiscount > 0 ? row("Potongan ongkir", `-${formatRupiah(p.shippingDiscount)}`, "text-sukses") : null}
      {p.pointsUsed > 0 ? row("Poin", `-${formatRupiah(p.pointsUsed)}`, "text-sukses") : null}
      <div className="flex justify-between gap-3 border-t border-garis pt-3 text-base">
        <dt className="font-semibold text-kopi">Total</dt>
        <dd className="font-semibold whitespace-nowrap text-kopi tabular-nums">{formatRupiah(p.total)}</dd>
      </div>
    </dl>
  );
}

export const paymentLabel: Record<string, string> = {
  qris: "QRIS",
  va_bca: "Virtual Account BCA",
  va_bni: "Virtual Account BNI",
  va_bri: "Virtual Account BRI",
  va_mandiri: "Virtual Account Mandiri",
  bayar_di_toko: "Bayar di Toko",
};
