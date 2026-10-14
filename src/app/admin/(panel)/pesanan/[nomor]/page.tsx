import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Eye, FileText, ListChecks, MessageCircle } from "lucide-react";
import { OrderAdminActions } from "@/components/admin/order-actions";
import { Denied, Panel, Skeleton } from "@/components/admin/ui";
import { OrderCosts, OrderItems, paymentLabel, StatusBadge } from "@/components/order/order-parts";
import { OrderTimeline } from "@/components/order/order-timeline";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { courierName } from "@/lib/admin/couriers";
import { availableActions } from "@/lib/admin/kanban";
import { can } from "@/lib/admin/permissions";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";
import { getOrderDetail, type OrderDetail } from "@/lib/orders/queries";
import { completeIfDue, expireIfDue } from "@/lib/orders/service";
import { statusLabels } from "@/lib/orders/status";
import { siteUrl } from "@/lib/site";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Detail pesanan" };

type Props = { params: Promise<{ nomor: string }> };

// Pesan WhatsApp siap kirim sesuai status pesanan.
function waMessage(o: OrderDetail) {
  const first = o.name.split(" ")[0] || "Kak";
  const base = `Halo ${first}, ini dari ${MEREK.namaLengkap} soal pesanan ${o.number}.`;
  const by: Record<string, string> = {
    menunggu_pembayaran: o.payment?.method === "bayar_di_toko" ? `${base} Pesananmu sudah kami sisihkan di ${o.location.name}. Bayar di kasir saat ambil, ya.` : `${base} Pesananmu menunggu pembayaran sebesar ${formatRupiah(o.pricing.total)}.`,
    dibayar: `${base} Pembayaran sudah kami terima, pesanan segera kami siapkan.`,
    diproses: `${base} Pesananmu sedang kami kemas.`,
    siap_diambil: `${base} Pesananmu sudah siap diambil di ${o.location.name} (${o.location.address}). Tunjukkan nomor pesanan ke kasir, ya.`,
    dikirim: `${base} Pesananmu sudah dikirim${o.shipment?.trackingNumber ? ` dengan resi ${o.shipment.courier} ${o.shipment.trackingNumber}` : ""}.`,
    selesai: `${base} Terima kasih sudah belanja. Semoga produknya cocok!`,
    dibatalkan: `${base} Pesananmu dibatalkan${o.cancelReason ? ` (${o.cancelReason})` : ""}.`,
  };
  return by[o.status] ?? base;
}

const toWa = (phone: string) => phone.replace(/\D/g, "").replace(/^0/, "62");

async function Content({ params }: Props) {
  await connection();
  const { nomor } = await params;
  const me = await requireStaff(`/admin/pesanan/${nomor}`);
  if (!can(me, "pesanan.lihat")) return <Denied />;
  await expireIfDue(db, nomor, undefined, siteUrl());
  await completeIfDue(db, nomor, undefined, siteUrl());
  const o = await getOrderDetail(db, nomor);
  if (!o) return <Denied message="Pesanan tidak ditemukan." />;
  // Staf Cabang hanya boleh membuka pesanan di lokasinya.
  if (!can(me, "pesanan.lihat", { lokasiId: o.locationId })) return <Denied message="Pesanan ini ada di luar lokasi yang kamu ampu." />;
  const actions = availableActions({ status: o.status, method: o.method, paymentMethod: o.payment?.method ?? null }).filter((a) => can(me, a.plan.permission, { lokasiId: o.locationId }));
  const canPrint = can(me, "pesanan.cetak", { lokasiId: o.locationId });
  return (
    <div className="space-y-4">
      <Link href="/admin/pesanan" className="inline-flex items-center gap-1 text-sm font-semibold text-aksen hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Semua pesanan
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-kopi tabular-nums md:text-3xl">{o.number}</h1>
          <p className="text-sm text-abu-hangat">
            Dibuat {formatDateTimeWib(o.createdAt)} · {o.method === "ambil" ? `Ambil di ${o.location.name}` : `Kirim dari ${o.location.name}`}
          </p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel title="Aksi">
            <OrderAdminActions number={o.number} status={o.status} actions={actions} courier={o.courier ? courierName(o.courier) : null} />
            <div className="mt-3 flex flex-wrap gap-2 border-t border-garis pt-3">
              {o.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/${toWa(o.phone)}?text=${encodeURIComponent(waMessage(o))}`} target="_blank" rel="noreferrer">
                    <MessageCircle /> Hubungi pembeli via WA
                  </a>
                </Button>
              ) : null}
              {canPrint ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/admin/label?nomor=${o.number}`} target="_blank" rel="noreferrer">
                      <FileText /> Label A6 (PDF)
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/pesanan/${o.number}/label`}>
                      <Eye /> Pratinjau label
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href={`/api/admin/daftar-ambil?nomor=${o.number}`} target="_blank" rel="noreferrer">
                      <ListChecks /> Daftar ambil
                    </a>
                  </Button>
                </>
              ) : null}
            </div>
          </Panel>
          <Panel title="Lini masa">
            <OrderTimeline method={o.method} status={o.status} history={o.history} />
            {o.shipment?.trackingNumber ? (
              <p className="mt-3 rounded-lg bg-porselen p-3 text-sm">
                Resi {o.shipment.courier}: <span className="font-mono font-semibold" data-testid="resi">{o.shipment.trackingNumber}</span>
              </p>
            ) : null}
          </Panel>
          <Panel title={`Item (${o.items.reduce((s, i) => s + i.quantity, 0)} barang)`}>
            <OrderItems order={o} />
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Rincian harga">
            <OrderCosts order={o} />
          </Panel>
          <Panel title="Pembayaran">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-abu-hangat">Metode</dt>
                <dd>{paymentLabel[o.payment?.method ?? ""] ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-abu-hangat">Status</dt>
                <dd className="capitalize">{o.payment?.status ?? "-"}</dd>
              </div>
              {o.paidAt ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-abu-hangat">Dibayar</dt>
                  <dd>{formatDateTimeWib(o.paidAt)}</dd>
                </div>
              ) : o.expiresAt && o.status === "menunggu_pembayaran" ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-abu-hangat">Batas bayar</dt>
                  <dd>{formatDateTimeWib(o.expiresAt)}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          <Panel title="Pembeli">
            <p className="text-sm font-semibold text-kopi">{o.name || "Tamu"}</p>
            <p className="text-sm text-abu-hangat">{o.phone}</p>
            {o.email ? <p className="text-sm text-abu-hangat">{o.email}</p> : null}
            <p className="mt-1 text-xs text-abu-hangat">{o.customerId ? `Punya akun ${MEREK.nama}` : "Belanja sebagai tamu"}</p>
            {o.customerId && can(me, "pelanggan.lihat") ? (
              <Link href={`/admin/pelanggan/${o.customerId}`} className="mt-1 inline-block text-sm font-semibold text-aksen hover:underline" data-testid="tautan-pelanggan">
                Lihat detail pelanggan
              </Link>
            ) : null}
          </Panel>
          <Panel title={o.method === "kirim" ? "Alamat kirim" : "Cabang pengambilan"}>
            {o.method === "kirim" && o.address ? (
              <div className="text-sm">
                <p className="font-semibold text-kopi">
                  {o.address.recipient} · {o.address.phone}
                </p>
                <p className="text-abu-hangat">
                  {o.address.street}, {o.address.district}, {o.address.city}, {o.address.province} {o.address.postalCode}
                </p>
                <p className="mt-1 text-xs text-abu-hangat">Kurir: {o.service}</p>
              </div>
            ) : (
              <div className="text-sm">
                <p className="font-semibold text-kopi">{o.location.name}</p>
                <p className="text-abu-hangat">
                  {o.location.address}, {o.location.district}
                </p>
              </div>
            )}
            {o.note ? <p className="mt-2 rounded-lg bg-[#FBF4E6] p-2 text-sm">Catatan pembeli: {o.note}</p> : null}
          </Panel>
          {o.cancelReason ? (
            <Panel title="Alasan batal">
              <p className="text-sm">{o.cancelReason}</p>
            </Panel>
          ) : null}
          <p className="text-xs text-abu-hangat">Status sekarang: {statusLabels[o.status]}. Setiap aksi tercatat di log aktivitas dan mengirim kabar ke pembeli.</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Content {...props} />
    </Suspense>
  );
}
