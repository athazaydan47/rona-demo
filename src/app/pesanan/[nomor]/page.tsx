import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MapPin, MessageCircle, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { DemoActionButton } from "@/components/order/demo-buttons";
import { OrderCosts, OrderItems, paymentLabel, StatusBadge } from "@/components/order/order-parts";
import { OrderTimeline } from "@/components/order/order-timeline";
import { TrackForm } from "@/components/order/track-form";
import { db } from "@/db/client";
import { ORDERS_COOKIE } from "@/lib/cart/cookie";
import { env } from "@/lib/env";
import { formatDateTimeWib } from "@/lib/format";
import { canAccessOrder, getOrderDetail } from "@/lib/orders/queries";
import { expireIfDue } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Detail pesanan", robots: { index: false } };

type Props = { params: Promise<{ nomor: string }>; searchParams: Promise<{ t?: string }> };

const STORE_WA = "6281200000000";

async function OrderContent({ params, searchParams }: Props) {
  await connection();
  const [{ nomor }, sp] = await Promise.all([params, searchParams]);
  await expireIfDue(db, nomor, undefined, siteUrl());
  const order = await getOrderDetail(db, nomor);
  if (!order) notFound();
  const tokens = ((await cookies()).get(ORDERS_COOKIE)?.value ?? "").split(".").filter(Boolean);
  if (!canAccessOrder(order, sp.t, tokens)) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-garis bg-putih p-6">
        <h1 className="font-serif text-2xl text-kopi">Pesanan {order.number}</h1>
        <p className="mt-1 text-sm text-abu-hangat">Untuk membuka detail pesanan tanpa akun, masukkan nomor WhatsApp yang dipakai saat memesan.</p>
        <div className="mt-5">
          <TrackForm number={order.number} />
        </div>
      </div>
    );
  }
  const token = order.accessToken;
  const payAtStore = order.payment?.method === "bayar_di_toko";
  const waText = encodeURIComponent(`Halo Rona Beauty, saya mau tanya pesanan ${order.number}.`);
  return (
    <>
      <Breadcrumb items={[{ label: "Lacak pesanan", href: "/lacak" }, { label: order.number }]} className="mb-3" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">{order.number}</h1>
          <p className="mt-1 text-sm text-abu-hangat">Dibuat {formatDateTimeWib(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {order.status === "menunggu_pembayaran" && !payAtStore ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-[#FBEEDC] p-4">
              <p className="text-sm text-[#8A5512]">Menunggu pembayaran sebelum {order.expiresAt ? formatDateTimeWib(order.expiresAt) : "15 menit"}.</p>
              <Button asChild size="sm">
                <Link href={`/bayar/${order.number}?t=${token}`}>Bayar sekarang</Link>
              </Button>
            </div>
          ) : null}
          <div className="rounded-card border border-garis bg-putih p-5">
            <h2 className="font-serif text-xl text-kopi">Status</h2>
            <div className="mt-4">
              <OrderTimeline method={order.method} status={order.status} history={order.history} />
            </div>
            {order.shipment?.trackingNumber ? (
              <p className="mt-4 rounded-xl bg-porselen p-3 text-sm">
                Nomor resi {order.shipment.courier}: <span className="font-mono font-semibold tabular-nums">{order.shipment.trackingNumber}</span>
              </p>
            ) : null}
          </div>
          <div className="rounded-card border border-garis bg-putih p-5">
            <h2 className="font-serif text-xl text-kopi">Produk</h2>
            <OrderItems order={order} />
          </div>
        </div>

        <aside className="space-y-4">
          {env.demoMode && payAtStore && order.status === "menunggu_pembayaran" ? (
            <DemoActionButton endpoint="simulasi-staf" number={order.number} token={token} label="Simulasikan staf: tandai lunas dan sudah diambil" />
          ) : null}
          <div className="rounded-card border border-garis bg-putih p-5">
            {order.method === "kirim" && order.address ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-kopi">
                  <Truck className="size-4 text-rona" aria-hidden /> Dikirim ke
                </p>
                <p className="mt-2 text-sm text-kopi">
                  {order.address.recipient} · {order.address.phone}
                </p>
                <p className="text-sm text-abu-hangat">
                  {order.address.street}, {order.address.district}, {order.address.city}, {order.address.province} {order.address.postalCode}
                </p>
                {order.address.lat != null ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-abu-hangat">
                    <MapPin className="size-3" aria-hidden /> Titik peta tersimpan
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-abu-hangat">Kurir: {order.service}</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-kopi">
                  <Store className="size-4 text-rona" aria-hidden /> Ambil di {order.location.name}
                </p>
                <p className="mt-2 text-sm text-abu-hangat">
                  {order.location.address}, {order.location.district}
                </p>
                <p className="text-xs whitespace-nowrap text-abu-hangat">Buka {order.location.hoursLabel} WIB</p>
              </>
            )}
            <p className="mt-3 border-t border-garis pt-3 text-xs text-abu-hangat">Pembayaran: {paymentLabel[order.payment?.method ?? ""] ?? "-"}</p>
            {order.note ? <p className="mt-1 text-xs text-abu-hangat">Catatan: {order.note}</p> : null}
          </div>
          <div className="rounded-card border border-garis bg-putih p-5">
            <OrderCosts order={order} />
          </div>
          <Button asChild variant="outline" className="w-full">
            <a href={`https://wa.me/${STORE_WA}?text=${waText}`} target="_blank" rel="noreferrer">
              <MessageCircle /> Hubungi toko via WhatsApp
            </a>
          </Button>
        </aside>
      </div>
    </>
  );
}

export default function PesananPage(props: Props) {
  return (
    <section className="container-rona py-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-garis/50" aria-busy />}>
        <OrderContent {...props} />
      </Suspense>
    </section>
  );
}
