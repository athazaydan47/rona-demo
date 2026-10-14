import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, MapPin, MessageCircle, PenLine, Sparkles, Store, Truck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { ConfirmReceivedButton } from "@/components/order/buyer-actions";
import { DemoActionButton } from "@/components/order/demo-buttons";
import { OrderCosts, OrderItems, paymentLabel, StatusBadge } from "@/components/order/order-parts";
import { OrderTimeline } from "@/components/order/order-timeline";
import { TrackForm } from "@/components/order/track-form";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { earnedPoints } from "@/lib/points";
import { reviewableItems } from "@/lib/reviews/service";
import { tokenPesananTersimpan } from "@/lib/orders/token-cookie";
import { env } from "@/lib/env";
import { formatDateTimeWib } from "@/lib/format";
import { canAccessOrder, getOrderDetail } from "@/lib/orders/queries";
import { completeIfDue, expireIfDue } from "@/lib/orders/service";
import { getStoreSettings } from "@/lib/settings/load";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Detail pesanan", robots: { index: false } };

type Props = { params: Promise<{ nomor: string }>; searchParams: Promise<{ t?: string }> };


async function OrderContent({ params, searchParams }: Props) {
  await connection();
  const [{ nomor }, sp] = await Promise.all([params, searchParams]);
  // Pengecekan malas: kedaluwarsa bayar dan Selesai otomatis 3 hari setelah Dikirim.
  await expireIfDue(db, nomor, undefined, siteUrl());
  await completeIfDue(db, nomor, undefined, siteUrl());
  const order = await getOrderDetail(db, nomor);
  if (!order) notFound();
  const tokens = await tokenPesananTersimpan();
  const me = await currentCustomer();
  if (!canAccessOrder(order, sp.t, tokens, me?.customerId)) {
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
  const isOwner = me != null && order.customerId === me.customerId;
  const reviewables = isOwner && order.status === "selesai" ? await reviewableItems(db, me.customerId, order.number) : [];
  const pointsEarned = earnedPoints({ subtotal: order.pricing.subtotal, voucherDiscount: order.pricing.voucherDiscount, pointsUsed: order.pricing.pointsUsed });
  const store = await getStoreSettings();
  const storeWa = store.profile.whatsapp;
  const waText = encodeURIComponent(`Halo ${store.profile.name}, saya mau tanya pesanan ${order.number}.`);
  return (
    <>
      <Breadcrumb items={isOwner ? [{ label: "Akun", href: "/akun" }, { label: "Pesanan", href: "/akun/pesanan" }, { label: order.number }] : [{ label: "Lacak pesanan", href: "/lacak" }, { label: order.number }]} className="mb-3" />
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
          {reviewables.length ? (
            <div className="rounded-card border border-garis bg-putih p-5" id="ulasan">
              <h2 className="font-serif text-xl text-kopi">Ulas produkmu</h2>
              <p className="mt-1 text-sm text-abu-hangat">Ulasan pertamamu dapat bonus 50 poin.</p>
              <ul className="mt-3 divide-y divide-garis">
                {reviewables.map((r) => (
                  <li key={r.orderItemId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0 text-sm text-kopi">
                      {r.productName}
                      {r.showShade ? <span className="text-abu-hangat"> · {r.shadeName}</span> : null}
                    </span>
                    {r.reviewId ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sukses">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Sudah diulas
                      </span>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/akun/ulasan/${r.orderItemId}`}>
                          <PenLine /> Tulis ulasan
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          {env.demoMode && payAtStore && order.status === "menunggu_pembayaran" ? (
            <DemoActionButton endpoint="simulasi-staf" number={order.number} token={token} label="Simulasikan staf: tandai lunas dan sudah diambil" />
          ) : null}
          {env.demoMode && order.method === "kirim" && order.status === "dibayar" ? (
            <DemoActionButton endpoint="simulasi-kirim" number={order.number} token={token} label="Simulasikan toko: proses dan kirim pesanan" />
          ) : null}
          {order.status === "dikirim" ? (
            <div className="rounded-card border border-garis bg-putih p-5">
              <p className="text-sm text-kopi">Paket sudah sampai dan isinya sesuai?</p>
              <div className="mt-3">
                {isOwner ? (
                  <ConfirmReceivedButton number={order.number} />
                ) : (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/masuk?kembali=${encodeURIComponent(`/pesanan/${order.number}`)}`}>Masuk untuk konfirmasi</Link>
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-abu-hangat">Pesanan otomatis selesai 3 hari setelah dikirim.</p>
            </div>
          ) : null}
          {isOwner && order.status === "selesai" && pointsEarned > 0 ? (
            <p className="flex items-center gap-2 rounded-card bg-[#FBF4E6] p-4 text-sm text-kopi">
              <Sparkles className="size-4 shrink-0 text-emas" aria-hidden /> Kamu dapat {pointsEarned} poin dari pesanan ini.
            </p>
          ) : null}
          {!isOwner && order.customerId == null && !me ? (
            <div className="rounded-card bg-blush/60 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-kopi">
                <UserPlus className="size-4 text-aksen" aria-hidden /> Simpan ke akunmu
              </p>
              <p className="mt-1 text-abu-hangat">Masuk dengan nomor WhatsApp yang sama untuk dapat poin dan menulis ulasan.</p>
              <Link href={`/masuk?kembali=${encodeURIComponent(`/pesanan/${order.number}`)}`} className="mt-2 inline-block font-semibold text-aksen hover:underline">
                Masuk sekarang
              </Link>
            </div>
          ) : null}
          <div className="rounded-card border border-garis bg-putih p-5">
            {order.method === "kirim" && order.address ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-kopi">
                  <Truck className="size-4 text-aksen" aria-hidden /> Dikirim ke
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
                  <Store className="size-4 text-aksen" aria-hidden /> Ambil di {order.location.name}
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
            <a href={`https://wa.me/${storeWa}?text=${waText}`} target="_blank" rel="noreferrer">
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
    <section className="container-toko py-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-garis/50" aria-busy />}>
        <OrderContent {...props} />
      </Suspense>
    </section>
  );
}
