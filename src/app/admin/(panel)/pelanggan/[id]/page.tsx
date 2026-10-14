import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { PointsAdjust } from "@/components/admin/points-adjust";
import { Denied, PageHead, Panel, Skeleton } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/order/order-parts";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { contactView, customerDetail, SEGMENT_LABELS, SEGMENT_TONE, waNumber } from "@/lib/admin/customers";
import { can } from "@/lib/admin/permissions";
import { concernLabels, skinTypeLabels } from "@/lib/catalog/filters";
import { now } from "@/lib/clock";
import { emailConfig, emailReady } from "@/lib/email";
import { formatDateTimeWib, formatDateWib, formatNumber, formatRupiah } from "@/lib/format";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detail pelanggan" };

const NOTIF_STATUS: Record<string, string> = { antre: "Menunggu", terkirim: "Terkirim", gagal: "Gagal", dilewati: "Dilewati" };

function Fact({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-garis bg-putih p-3">
      <p className="text-xs text-abu-hangat">{label}</p>
      <p className="mt-0.5 truncate font-serif text-lg text-kopi tabular-nums" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const me = await requireStaff(`/admin/pelanggan/${id}`);
  if (!can(me, "pelanggan.lihat")) return <Denied />;
  const d = await customerDetail(db, Number.parseInt(id, 10) || 0, now());
  if (!d) return <Denied message="Pelanggan tidak ditemukan." />;
  const c = d.customer;
  const contact = contactView(me, c);
  const sp = c.skinProfile;
  const emailLive = emailReady(emailConfig());
  return (
    <>
      <PageHead
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={SEGMENT_TONE[d.segment]}>{SEGMENT_LABELS[d.segment]}</Badge>
            <span className="tabular-nums" data-testid="kontak-wa">
              {contact.phone}
            </span>
            {contact.email ? <span>{contact.email}</span> : null}
            {contact.masked ? <span className="text-xs">(kontak disamarkan)</span> : null}
            <span>Terdaftar {formatDateWib(c.registeredAt)}</span>
          </span>
        }
      >
        {!contact.masked ? (
          <Button asChild size="sm" variant="outline">
            <a href={`https://wa.me/${waNumber(c.phone)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> Hubungi via WA
            </a>
          </Button>
        ) : null}
      </PageHead>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="ringkasan-pelanggan">
        <Fact label="Total belanja bersih" value={formatRupiah(d.summary.spend)} />
        <Fact label="Pesanan" value={formatNumber(d.summary.orders)} />
        <Fact label="Rata-rata pesanan" value={formatRupiah(d.summary.averageOrder)} />
        <Fact label="Terakhir belanja" value={d.summary.lastOrderAt ? formatDateWib(d.summary.lastOrderAt) : "Belum pernah"} />
        <Fact label="Cabang favorit" value={d.summary.favoriteLocation ?? "-"} />
        <Fact label="Merek favorit" value={d.summary.favoriteBrand ?? "-"} />
      </div>
      <p className="mt-1 text-xs text-abu-hangat">Belanja bersih: subtotal setelah diskon produk, dikurangi voucher dan poin, tanpa ongkir, dari pesanan yang dibayar dan tidak batal atau retur.</p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Panel title={`Pesanan (${d.totalOrders})`} padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <tbody className="divide-y divide-garis">
                  {d.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-3 py-2">
                        <Link href={`/admin/pesanan/${o.number}`} className="font-mono text-xs font-semibold hover:underline">
                          {o.number}
                        </Link>
                        <span className="block text-xs text-abu-hangat">{formatDateTimeWib(o.createdAt)}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {o.method === "kirim" ? "Kirim" : "Ambil"} · {o.locationName}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusTone[o.status as OrderStatus]}>{statusLabels[o.status as OrderStatus]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(o.total)}</td>
                    </tr>
                  ))}
                  {!d.orders.length ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-abu-hangat">Belum ada pesanan.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {d.totalOrders > d.orders.length ? <p className="px-3 py-2 text-xs text-abu-hangat">Menampilkan 30 pesanan terbaru.</p> : null}
          </Panel>

          <Panel title={`Poin: ${formatNumber(c.points)}`} action={can(me, "pelanggan.poin") ? <PointsAdjust customerId={c.id} balance={c.points} /> : null} padded={false}>
            <ul className="divide-y divide-garis text-sm" data-testid="buku-poin">
              {d.ledger.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block">{l.reason}</span>
                    <span className="block text-xs text-abu-hangat">{formatDateTimeWib(l.createdAt)}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", l.amount >= 0 ? "text-sukses" : "text-bahaya")}>
                    {l.amount > 0 ? "+" : ""}
                    {formatNumber(l.amount)}
                  </span>
                </li>
              ))}
              {!d.ledger.length ? <li className="px-3 py-6 text-center text-abu-hangat">Belum ada gerakan poin.</li> : null}
            </ul>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Profil kulit">
            {sp && (sp.skinType || sp.concerns?.length || sp.undertone) ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-abu-hangat">Jenis kulit</dt>
                <dd>{sp.skinType ? (skinTypeLabels[sp.skinType] ?? sp.skinType) : "-"}</dd>
                <dt className="text-abu-hangat">Masalah</dt>
                <dd>{sp.concerns?.length ? sp.concerns.map((x) => concernLabels[x] ?? x).join(", ") : "-"}</dd>
                <dt className="text-abu-hangat">Undertone</dt>
                <dd>{sp.undertone ?? "-"}</dd>
                <dt className="text-abu-hangat">Kedalaman shade</dt>
                <dd>{sp.depth ?? "-"}</dd>
                <dt className="text-abu-hangat">Finish</dt>
                <dd>{sp.finish ?? "-"}</dd>
              </dl>
            ) : (
              <p className="text-sm text-abu-hangat">Belum mengisi profil kulit.</p>
            )}
          </Panel>
          <Panel title="Alamat">
            {d.addresses.length ? (
              <ul className="space-y-2 text-sm">
                {d.addresses.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.label}</span>
                    {a.isPrimary ? <span className="ml-1 text-xs text-rona">Utama</span> : null}
                    <span className="block text-abu-hangat">
                      {contact.masked ? `${a.district}, ${a.city}` : `${a.street}, ${a.district}, ${a.city} ${a.postalCode}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-abu-hangat">Belum ada alamat tersimpan.</p>
            )}
          </Panel>
          <Panel title={`Wishlist (${d.wishlist.length})`}>
            {d.wishlist.length ? (
              <ul className="space-y-1 text-sm">
                {d.wishlist.map((w) => (
                  <li key={w.slug}>
                    <a href={`/p/${w.slug}`} target="_blank" rel="noreferrer" className="hover:underline">
                      {w.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-abu-hangat">Wishlist kosong.</p>
            )}
          </Panel>
          <Panel title={`Kabari aku (${d.restock.length})`}>
            {d.restock.length ? (
              <ul className="space-y-1 text-sm">
                {d.restock.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      {r.productName}, {r.shadeName}
                    </span>
                    <span className="shrink-0 text-xs text-abu-hangat">{r.status === "terkirim" ? "Sudah dikabari" : "Menunggu stok"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-abu-hangat">Tidak ada permintaan.</p>
            )}
          </Panel>
          <Panel title="Notifikasi terbaru">
            {d.notifications.length ? (
              <ul className="space-y-1.5 text-sm">
                {d.notifications.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="mr-1 text-xs font-semibold uppercase text-abu-hangat">{n.channel}</span>
                      {n.subject}
                    </span>
                    <span className="shrink-0 text-xs text-abu-hangat">
                      {n.channel === "wa" || (n.status === "antre" && !emailLive) ? "Pratinjau" : NOTIF_STATUS[n.status]} · {formatDateWib(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-abu-hangat">Belum ada notifikasi.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link href="/admin/pelanggan" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Pelanggan
      </Link>
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}
