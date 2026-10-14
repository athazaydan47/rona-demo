import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, MessageCircle, PackageCheck, Store, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderCosts, OrderItems, StatusBadge } from "@/components/order/order-parts";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { tokenPesananTersimpan } from "@/lib/orders/token-cookie";
import { formatDateTimeWib } from "@/lib/format";
import { canAccessOrder, getOrderDetail } from "@/lib/orders/queries";
import { expireIfDue } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Pesanan berhasil", robots: { index: false } };

type Props = { params: Promise<{ nomor: string }>; searchParams: Promise<{ t?: string }> };

async function SuccessContent({ params, searchParams }: Props) {
  await connection();
  const [{ nomor }, sp] = await Promise.all([params, searchParams]);
  await expireIfDue(db, nomor, undefined, siteUrl());
  const order = await getOrderDetail(db, nomor);
  if (!order) notFound();
  const tokens = await tokenPesananTersimpan();
  const me = await currentCustomer();
  if (!canAccessOrder(order, sp.t, tokens, me?.customerId)) redirect(`/pesanan/${order.number}`);
  const token = order.accessToken;
  const payAtStore = order.payment?.method === "bayar_di_toko";
  if (order.status === "menunggu_pembayaran" && !payAtStore) redirect(`/bayar/${order.number}?t=${token}`);
  const cancelled = order.status === "dibatalkan";
  const steps = payAtStore
    ? [
        { icon: Store, text: `Datang ke ${order.location.name} (${order.location.address}) dan sebutkan nomor pesanan.` },
        { icon: PackageCheck, text: `Bayar di kasir paling lambat ${order.expiresAt ? formatDateTimeWib(order.expiresAt) : "jam tutup hari kerja berikutnya"}. Barang sudah kami sisihkan.` },
        { icon: MessageCircle, text: "Kabar pesanan juga kami kirim ke WhatsApp-mu." },
      ]
    : order.method === "ambil"
      ? [
          { icon: PackageCheck, text: `Kami siapkan pesananmu di ${order.location.name}. Kami kabari lewat WhatsApp saat siap diambil.` },
          { icon: Store, text: "Tunjukkan nomor pesanan ke kasir saat mengambil." },
        ]
      : [
          { icon: PackageCheck, text: "Pesananmu kami kemas. Pesanan yang dibayar sebelum 15.00 WIB dikirim hari itu juga (Senin sampai Sabtu)." },
          { icon: MessageCircle, text: "Nomor resi kami kirim lewat WhatsApp begitu paket diserahkan ke kurir." },
        ];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-card border border-garis bg-putih p-6 text-center md:p-8">
        <CheckCircle2 className={`mx-auto size-12 ${cancelled ? "text-bahaya" : "text-sukses"}`} aria-hidden />
        <h1 className="mt-3 font-serif text-3xl text-kopi">{cancelled ? "Pesanan dibatalkan" : payAtStore ? "Pesanan dibuat, bayar saat ambil" : "Terima kasih, pembayaran berhasil"}</h1>
        <p className="mt-2 text-abu-hangat">
          Nomor pesanan <span className="font-semibold text-kopi" data-testid="nomor-pesanan">{order.number}</span>
        </p>
        <div className="mt-3">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {!cancelled ? (
        <div className="mt-6 rounded-card border border-garis bg-putih p-5">
          <h2 className="font-serif text-xl text-kopi">Langkah berikutnya</h2>
          <ul className="mt-3 space-y-3">
            {steps.map((s) => (
              <li key={s.text} className="flex gap-3 text-sm text-kopi/90">
                <s.icon className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden /> {s.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-card border border-garis bg-putih p-5">
          <h2 className="font-serif text-xl text-kopi">Ringkasan</h2>
          <OrderItems order={order} />
        </div>
        <div className="space-y-4">
          <div className="rounded-card border border-garis bg-putih p-5">
            <OrderCosts order={order} />
          </div>
          {order.customerId == null ? (
            <div className="rounded-card bg-blush/60 p-5">
              <p className="flex items-center gap-2 font-semibold text-kopi">
                <UserPlus className="size-4 text-aksen" aria-hidden /> Simpan pesanan ini ke akunmu
              </p>
              <p className="mt-1 text-sm text-abu-hangat">Masuk dengan nomor WhatsApp yang sama supaya riwayat pesanan, poin, dan ulasan tersimpan.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={`/masuk?kembali=${encodeURIComponent(`/pesanan/${order.number}`)}`}>Simpan ke akun</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-card bg-blush/60 p-5 text-sm text-kopi">
              Pesanan ini tersimpan di akunmu. Poin masuk saat pesanan selesai.{" "}
              <Link href="/akun/pesanan" className="font-semibold text-aksen hover:underline">
                Lihat pesananku
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href={`/pesanan/${order.number}?t=${token}`}>Lacak pesanan</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Lanjut belanja</Link>
        </Button>
      </div>
    </div>
  );
}

export default function SuksesPage(props: Props) {
  return (
    <section className="container-toko py-6 md:py-10">
      <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-card bg-garis/50" aria-busy />}>
        <SuccessContent {...props} />
      </Suspense>
    </section>
  );
}
