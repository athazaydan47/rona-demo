import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashCountdown } from "@/components/flash/flash-countdown";
import { CopyButton } from "@/components/order/copy-button";
import { DemoActionButton } from "@/components/order/demo-buttons";
import { OrderCosts, paymentLabel, StatusBadge } from "@/components/order/order-parts";
import { PaymentInstructions } from "@/components/order/payment-instructions";
import { PaymentWatcher } from "@/components/order/payment-watcher";
import { TrackForm } from "@/components/order/track-form";
import { db } from "@/db/client";
import { ORDERS_COOKIE } from "@/lib/cart/cookie";
import { env } from "@/lib/env";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";
import { currentCustomer } from "@/lib/auth/current";
import { canAccessOrder, getOrderDetail } from "@/lib/orders/queries";
import { expireIfDue } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Pembayaran", robots: { index: false } };

type Props = { params: Promise<{ nomor: string }>; searchParams: Promise<{ t?: string }> };

async function PaymentContent({ params, searchParams }: Props) {
  await connection();
  const [{ nomor }, sp] = await Promise.all([params, searchParams]);
  await expireIfDue(db, nomor, undefined, siteUrl());
  const order = await getOrderDetail(db, nomor);
  if (!order) notFound();
  const tokens = ((await cookies()).get(ORDERS_COOKIE)?.value ?? "").split(".").filter(Boolean);
  if (!canAccessOrder(order, sp.t, tokens, (await currentCustomer())?.customerId)) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-garis bg-putih p-6">
        <h1 className="font-serif text-2xl text-kopi">Buka pesanan {order.number}</h1>
        <p className="mt-1 text-sm text-abu-hangat">Untuk keamanan, masukkan nomor WhatsApp yang dipakai saat memesan.</p>
        <div className="mt-5">
          <TrackForm number={order.number} />
        </div>
      </div>
    );
  }
  const token = order.accessToken;
  const successHref = `/pesanan/${order.number}/sukses?t=${token}`;
  const p = order.payment;

  if (order.status !== "menunggu_pembayaran") {
    const cancelled = order.status === "dibatalkan";
    return (
      <div className="mx-auto max-w-lg rounded-card border border-garis bg-putih p-6 text-center">
        {cancelled ? <AlertCircle className="mx-auto size-10 text-bahaya" aria-hidden /> : <CheckCircle2 className="mx-auto size-10 text-sukses" aria-hidden />}
        <h1 className="mt-3 font-serif text-2xl text-kopi">{cancelled ? "Pesanan dibatalkan" : "Pembayaran sudah diterima"}</h1>
        <p className="mt-2 text-sm text-abu-hangat">{cancelled ? `${order.cancelReason ?? "Pesanan dibatalkan"}. Stok dan kuota sudah kami kembalikan.` : `Pesanan ${order.number} sedang kami proses.`}</p>
        <div className="mt-3">
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-5 flex justify-center gap-3">
          {cancelled ? (
            <Button asChild>
              <Link href="/keranjang">Kembali ke keranjang</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={successHref}>Lihat ringkasan</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/pesanan/${order.number}?t=${token}`}>Detail pesanan</Link>
          </Button>
        </div>
      </div>
    );
  }

  const qrSvg = p?.method === "qris" && p.qrPayload ? await QRCode.toString(p.qrPayload, { type: "svg", margin: 1, color: { dark: "#2A1F1D", light: "#FFFFFF" } }) : null;
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <PaymentWatcher number={order.number} token={token} successHref={successHref} />
      <div className="space-y-5">
        <div className="rounded-card border border-garis bg-putih p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-abu-hangat">
              Pesanan <span className="font-semibold text-kopi">{order.number}</span>
            </p>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-4 text-sm text-abu-hangat">Total tagihan</p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-serif text-4xl whitespace-nowrap text-kopi tabular-nums" data-testid="tagihan">
              {formatRupiah(p?.amount ?? order.pricing.total)}
            </p>
            <CopyButton value={String(p?.amount ?? order.pricing.total)} label="nominal" />
          </div>
          {order.expiresAt ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-porselen p-3">
              <Clock className="size-4 text-peringatan" aria-hidden />
              <FlashCountdown target={order.expiresAt.toISOString()} label="Bayar dalam" size="sm" />
              <span className="text-xs text-abu-hangat">sebelum {formatDateTimeWib(order.expiresAt)}</span>
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-sm font-semibold text-kopi">{paymentLabel[p?.method ?? ""] ?? "Pembayaran"}</p>
            {qrSvg ? (
              <div className="mt-3 flex flex-col items-center gap-3 rounded-card border border-garis p-4">
                <div className="w-56 max-w-full" role="img" aria-label="Kode QRIS untuk membayar pesanan ini" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <p className="text-xs text-abu-hangat">QRIS demo: kode ini tidak terhubung ke bank mana pun.</p>
              </div>
            ) : p?.vaNumber ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-garis p-4">
                <div>
                  <p className="text-xs text-abu-hangat">Nomor virtual account</p>
                  <p className="font-mono text-2xl tracking-wider text-kopi tabular-nums" data-testid="nomor-va">
                    {p.vaNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
                  </p>
                </div>
                <CopyButton value={p.vaNumber} label="nomor virtual account" />
              </div>
            ) : null}
          </div>
        </div>
        {p ? <PaymentInstructions method={p.method} /> : null}
      </div>
      <aside className="space-y-4">
        {env.demoMode ? <DemoActionButton endpoint="simulasi-bayar" number={order.number} token={token} label="Simulasikan pembayaran berhasil" next={successHref} /> : null}
        <div className="rounded-card border border-garis bg-putih p-5">
          <h2 className="font-serif text-lg text-kopi">Rincian</h2>
          <div className="mt-3">
            <OrderCosts order={order} />
          </div>
        </div>
        <p className="text-xs text-abu-hangat">Status diperbarui otomatis. Bila lewat batas waktu, pesanan dibatalkan dan stok dikembalikan.</p>
      </aside>
    </div>
  );
}

export default function BayarPage(props: Props) {
  return (
    <section className="container-rona py-6 md:py-10">
      <Suspense fallback={<div className="mx-auto h-96 max-w-4xl animate-pulse rounded-card bg-garis/50" aria-busy />}>
        <PaymentContent {...props} />
      </Suspense>
    </section>
  );
}
