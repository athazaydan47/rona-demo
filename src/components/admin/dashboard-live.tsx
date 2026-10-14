"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, Clock, MessageSquareWarning, PackageOpen, RefreshCw, RotateCcw, Store } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountUp } from "@/components/ui/count-up";
import { statusTone } from "@/components/order/order-parts";
import { dashboardAction, resetDemoNowAction } from "@/lib/admin/actions";
import type { DashboardData } from "@/lib/admin/dashboard";
import { formatDateTimeWib, formatNumber, formatRupiah, formatTimeWib } from "@/lib/format";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import type { Packaging } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;
const STATUS_ORDER: OrderStatus[] = ["menunggu_pembayaran", "dibayar", "diproses", "siap_diambil", "dikirim", "selesai", "dibatalkan", "diretur"];
const ACTION_ICON = { belum_diproses: Clock, bayar_di_toko: Store, siap_lama: PackageOpen, kabari_aku: BellRing, ulasan_rendah: MessageSquareWarning };

function Stat({ label, value, format, hint, testId }: { label: string; value: number; format: (n: number) => string; hint?: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-garis bg-putih p-4">
      <p className="text-xs font-medium text-abu-hangat">{label}</p>
      <p className="mt-1 font-serif text-2xl text-kopi tabular-nums">
        <CountUp value={value} format={format} testId={testId} />
      </p>
      {hint ? <p className="text-xs text-abu-hangat">{hint}</p> : null}
    </div>
  );
}

function RevenueChart({ series }: { series: { day: string; revenue: number; orders: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.revenue));
  const W = 600;
  const H = 160;
  const bw = W / series.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-44 w-full" role="img" aria-label="Grafik omzet 30 hari">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--color-garis)" strokeWidth={1} />
        ))}
        {series.map((d, i) => {
          const h = Math.max(d.revenue ? 2 : 0, (d.revenue / max) * (H - 8));
          const today = i === series.length - 1;
          return (
            <g key={d.day}>
              <rect x={i * bw + 2} y={H - h} width={bw - 4} height={h} rx={2} fill={today ? "var(--color-rona)" : "var(--color-kopi)"} opacity={today ? 1 : 0.75}>
                <title>{`${d.day}: ${formatRupiah(d.revenue)}, ${d.orders} pesanan`}</title>
              </rect>
              {i % 5 === 4 || today ? (
                <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize={10} fill="var(--color-abu-hangat)">
                  {Number(d.day.slice(8))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-abu-hangat">Omzet per tanggal bayar (WIB), 30 hari terakhir. Batang merah: hari ini.</figcaption>
    </figure>
  );
}

function DemoReset({ seedVersion, installedVersion }: { seedVersion: number; installedVersion: number }) {
  const [open, setOpen] = useState(false);
  const newer = seedVersion > installedVersion;
  return (
    <div className="rounded-xl border border-dashed border-emas/70 bg-[#FBF4E6] p-4" data-testid="kartu-reset-demo">
      <p className="text-sm font-semibold text-[#7A5A1E]">Mode demo</p>
      {newer ? (
        <p className="mt-1 rounded-lg bg-putih/80 px-2 py-1.5 text-xs font-semibold text-rona" role="status" data-testid="versi-seed-baru">
          Data demo versi baru tersedia, reset sekarang? (terpasang versi {installedVersion}, kode versi {seedVersion})
        </p>
      ) : (
        <p className="mt-1 text-xs text-[#7A5A1E]">Data demo versi {installedVersion}, sudah terbaru.</p>
      )}
      <p className="mt-1 text-xs text-[#7A5A1E]">Kembalikan semua data (pesanan, stok, akun, ulasan, pengaturan) ke keadaan awal. Semua sesi ikut keluar. Paling sering sekali per 5 menit.</p>
      <Button className="mt-3" size="sm" variant="dark" onClick={() => setOpen(true)}>
        <RotateCcw /> Reset data demo sekarang
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset data demo?"
        description="Semua perubahan pengunjung hilang dan data kembali ke keadaan awal. Ketik RESET untuk melanjutkan."
        confirmLabel="Reset sekarang"
        danger
        input={{ label: "Ketik RESET", placeholder: "RESET", mustEqual: "RESET" }}
        onConfirm={async (v) => {
          const r = await resetDemoNowAction(v);
          return r && !r.ok ? r.message : null;
        }}
      />
    </div>
  );
}

export function DashboardLive({ initial, canReset, seedVersion = 0, installedVersion = 0 }: { initial: DashboardData; canReset: boolean; seedVersion?: number; installedVersion?: number }) {
  const [data, setData] = useState(initial);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const seen = useRef(new Set(initial.recent.map((r) => r.id)));

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await dashboardAction();
      if (!next) return;
      const added = next.recent.filter((r) => !seen.current.has(r.id)).map((r) => r.id);
      for (const r of next.recent) seen.current.add(r.id);
      setData(next);
      if (added.length) {
        setFresh(new Set(added));
        window.setTimeout(() => setFresh(new Set()), 6000);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Muat ulang tiap 30 detik, berhenti saat tab tidak aktif, langsung muat saat tab kembali aktif.
  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") timer = window.setInterval(() => void refresh(), REFRESH_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const r = data.revenue;
  const active = (data.counts.dibayar ?? 0) + (data.counts.diproses ?? 0) + (data.counts.siap_diambil ?? 0);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-xs text-abu-hangat">
        <span>Diperbarui {formatTimeWib(new Date(data.generatedAt))}, otomatis tiap 30 detik.</span>
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 font-semibold text-rona hover:underline" disabled={refreshing}>
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden /> Muat ulang
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {r ? (
          <>
            <Stat label="Omzet hari ini" value={r.today} format={formatRupiah} hint={`${r.todayOrders} pesanan dibayar`} testId="omzet-hari-ini" />
            <Stat label="Omzet 30 hari" value={r.total} format={formatRupiah} hint={`${r.paidOrders} pesanan dibayar`} />
            <Stat label="Rata-rata nilai pesanan" value={r.averageOrder} format={formatRupiah} hint="30 hari terakhir" />
          </>
        ) : (
          <Stat label="Pesanan dibayar 30 hari" value={data.paidOrders30} format={formatNumber} hint="Angka keuangan butuh izin laporan keuangan" />
        )}
        <Stat label="Perlu diproses" value={active} format={formatNumber} hint="Dibayar, diproses, siap diambil" testId="perlu-diproses" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {r ? (
            <section className="rounded-xl border border-garis bg-putih p-4">
              <h2 className="mb-2 text-sm font-semibold text-kopi">Grafik omzet</h2>
              <RevenueChart series={r.series} />
            </section>
          ) : null}

          <section className="rounded-xl border border-garis bg-putih p-4">
            <h2 className="mb-3 text-sm font-semibold text-kopi">Pesanan per status</h2>
            <ul className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <Link href={`/admin/pesanan?tampilan=tabel&status=${s}`} className="inline-flex items-center gap-2 rounded-lg border border-garis px-3 py-1.5 text-sm hover:border-kopi/30">
                    <Badge variant={statusTone[s]}>{statusLabels[s]}</Badge>
                    <span className="font-semibold tabular-nums" data-testid={`jumlah-${s}`}>
                      {data.counts[s] ?? 0}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-garis bg-putih">
            <h2 className="border-b border-garis px-4 py-2.5 text-sm font-semibold text-kopi">Pesanan terbaru</h2>
            <ul className="divide-y divide-garis" data-testid="pesanan-terbaru">
              {data.recent.map((o) => (
                <li key={o.id} className={cn("rounded-lg", fresh.has(o.id) && "animate-cahaya")} data-baru={fresh.has(o.id) ? "1" : undefined}>
                  <Link href={`/admin/pesanan/${o.number}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-porselen">
                    <span className="font-semibold tabular-nums">{o.number}</span>
                    {fresh.has(o.id) ? <span className="rounded-full bg-rona px-2 text-[10px] font-bold text-putih">Baru</span> : null}
                    <Badge variant={statusTone[o.status as OrderStatus]}>{statusLabels[o.status as OrderStatus]}</Badge>
                    <span className="min-w-0 flex-1 truncate text-abu-hangat">
                      {o.name ?? "Tamu"} · {o.method === "ambil" ? `Ambil di ${o.locationName}` : "Kirim"}
                    </span>
                    {o.total != null ? <span className="tabular-nums">{formatRupiah(o.total)}</span> : null}
                    <span className="w-full text-xs text-abu-hangat sm:w-auto">{formatDateTimeWib(new Date(o.createdAt))}</span>
                  </Link>
                </li>
              ))}
              {data.recent.length === 0 ? <li className="px-4 py-6 text-center text-sm text-abu-hangat">Belum ada pesanan.</li> : null}
            </ul>
          </section>

          {data.best.length ? (
            <section className="rounded-xl border border-garis bg-putih">
              <h2 className="border-b border-garis px-4 py-2.5 text-sm font-semibold text-kopi">Produk terlaris 30 hari</h2>
              <ol className="divide-y divide-garis">
                {data.best.map((b, i) => (
                  <li key={b.productId} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-4 text-xs font-bold text-abu-hangat">{i + 1}</span>
                    <span className="w-9 shrink-0 overflow-hidden rounded-md">
                      <ProductArt packaging={b.packaging as Packaging} shade={b.hex} brandColor={b.brandColor} brandName={b.brandName} title="" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{b.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{b.qty} pcs</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-garis bg-putih">
            <h2 className="flex items-center gap-2 border-b border-garis px-4 py-2.5 text-sm font-semibold text-kopi">
              <AlertTriangle className="size-4 text-peringatan" aria-hidden /> Perlu tindakan
              <span className="ml-auto rounded-full bg-porselen px-2 text-xs tabular-nums">{data.actions.length}</span>
            </h2>
            <ul className="divide-y divide-garis" data-testid="perlu-tindakan">
              {data.actions.map((a, i) => {
                const Icon = ACTION_ICON[a.kind];
                return (
                  <li key={`${a.kind}-${i}`}>
                    <Link href={a.href} className="flex gap-3 px-4 py-2.5 hover:bg-porselen">
                      <Icon className="mt-0.5 size-4 shrink-0 text-rona" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm text-kopi">{a.title}</span>
                        <span className="block text-xs text-abu-hangat">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {data.actions.length === 0 ? <li className="px-4 py-5 text-center text-sm text-abu-hangat">Semua beres. Tidak ada yang menunggu.</li> : null}
            </ul>
          </section>

          <section className="rounded-xl border border-garis bg-putih" data-testid="stok-kritis">
            <h2 className="flex items-center justify-between gap-2 border-b border-garis px-4 py-2.5 text-sm font-semibold text-kopi">
              <span>Stok kritis</span>
              <span className="text-xs font-normal tabular-nums">
                <span className="text-bahaya">{data.lowTotals.out} habis</span> · <span className="text-peringatan-teks">{data.lowTotals.low} menipis</span>
              </span>
            </h2>
            {data.critical.length ? (
              <ol className="divide-y divide-garis">
                {data.critical.map((it) => (
                  <li key={`${it.variantId}-${it.locationName}`}>
                    <Link href={`/admin/stok/${it.variantId}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-porselen">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-kopi">
                          {it.productName} <span className="text-abu-hangat">({it.shadeName})</span>
                        </span>
                        <span className="block text-xs text-abu-hangat">{it.locationName}</span>
                      </span>
                      <span className={cn("shrink-0 text-xs font-semibold tabular-nums", it.available === 0 ? "text-bahaya" : "text-peringatan-teks")}>{it.available === 0 ? "Habis" : `Sisa ${it.available}`}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-5 text-center text-sm text-abu-hangat">Semua stok di atas ambang {data.threshold}. Aman.</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-garis px-4 py-2 text-[11px] text-abu-hangat">
              {data.lowStock.map((l) => (
                <span key={l.location.id} className="tabular-nums">
                  {l.location.name.replace("Rona ", "")}: {l.out} habis, {l.low} menipis
                </span>
              ))}
              <Link href="/admin/stok?status=menipis" className="ml-auto font-semibold text-rona hover:underline">
                Lihat semua
              </Link>
            </div>
          </section>

          {canReset ? <DemoReset seedVersion={seedVersion} installedVersion={installedVersion} /> : null}
        </div>
      </div>
    </div>
  );
}
