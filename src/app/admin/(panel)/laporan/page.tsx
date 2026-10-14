import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Download } from "lucide-react";
import { ChangeChip, DailyChart, num, pct, ReportStat, ReportTable, rp } from "@/components/admin/report-parts";
import { Denied, fieldClass, PageHead, Skeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";
import { formatDateTimeWib } from "@/lib/format";
import { PERIOD_PRESETS } from "@/lib/reports";
import { periodLabel } from "@/lib/reports/excel";
import { reportForRequest, type ReportParams } from "@/lib/reports/request";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Laporan" };

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "merek", label: "Per merek" },
  { key: "kategori", label: "Per kategori" },
  { key: "cabang", label: "Per cabang" },
  { key: "kanal", label: "Per kanal" },
  { key: "produk", label: "Produk terlaris" },
  { key: "promo", label: "Voucher dan flash sale" },
  { key: "pelanggan", label: "Pelanggan" },
] as const;
type Tab = (typeof TABS)[number]["key"];
type SP = ReportParams & { tab?: string };

const sumOf = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const me = await requireStaff("/admin/laporan");
  if (!can(me, "laporan.lihat")) return <Denied />;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "ringkasan";
  const r = await reportForRequest(db, me, sp, now());
  const { report, finance, compare, period } = r;
  const s = report.summary;
  const query = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = { periode: period.preset, dari: period.preset === "kustom" ? period.firstDay : undefined, sampai: period.preset === "kustom" ? period.lastDay : undefined, lokasi: r.selectedLocation && r.locations.length > 1 ? String(r.selectedLocation) : undefined, banding: compare ? "1" : undefined, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v);
    return q.toString();
  };
  const excelHref = `/api/admin/laporan/excel?${query({ tab: undefined, banding: undefined })}`;

  return (
    <>
      <PageHead title="Laporan" description={`${periodLabel(period.from, period.to)} · ${r.locationLabel}`}>
        <Button asChild variant="dark" size="sm">
          <a href={excelHref} download data-testid="unduh-excel">
            <Download /> Unduh Excel
          </a>
        </Button>
      </PageHead>

      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-garis bg-putih p-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,auto)_1fr] lg:items-end" aria-label="Filter laporan">
        <input type="hidden" name="tab" value={tab} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-abu-hangat">Periode</span>
          <select name="periode" defaultValue={period.preset} className={fieldClass} aria-label="Periode laporan">
            {PERIOD_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-abu-hangat">Dari (kustom)</span>
          <input type="date" name="dari" defaultValue={period.preset === "kustom" ? period.firstDay : (sp.dari ?? "")} className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-abu-hangat">Sampai (kustom)</span>
          <input type="date" name="sampai" defaultValue={period.preset === "kustom" ? period.lastDay : (sp.sampai ?? "")} className={fieldClass} />
        </label>
        {r.locations.length > 1 ? (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-abu-hangat">Cabang asal</span>
            <select name="lokasi" defaultValue={r.selectedLocation && r.locationIds && r.locationIds.length === 1 && r.locations.length > 1 ? String(r.selectedLocation) : ""} className={fieldClass} aria-label="Cabang">
              <option value="">Semua cabang</option>
              {r.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="banding" value="1" defaultChecked={Boolean(compare)} className="size-4 accent-rona" /> Bandingkan periode sebelumnya
        </label>
        <div className="flex justify-end">
          <Button type="submit" size="sm">
            Terapkan
          </Button>
        </div>
      </form>
      {period.error ? (
        <p className="mb-3 rounded-lg bg-[#F7E3E1] px-3 py-2 text-sm text-bahaya" role="alert">
          {period.error} Laporan menampilkan 30 hari terakhir.
        </p>
      ) : null}
      {!finance ? <p className="mb-3 rounded-lg bg-porselen px-3 py-2 text-sm text-abu-hangat">Angka rupiah disembunyikan karena akunmu tidak punya izin laporan keuangan. Yang tampil hanya jumlah.</p> : null}

      <nav className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Bagian laporan">
        <div className="flex gap-1.5" role="tablist">
          {TABS.map((t) => (
            <Link key={t.key} role="tab" aria-selected={tab === t.key} href={`/admin/laporan?${query({ tab: t.key })}`} className={cn("inline-flex h-9 shrink-0 items-center rounded-pill border px-3 text-sm", tab === t.key ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih")}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "ringkasan" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" data-testid="ringkasan-laporan">
            {finance ? <ReportStat label="Omzet" value={rp(s.revenue)} testId="laporan-omzet" change={<ChangeChip current={s.revenue} previous={compare?.revenue} />} /> : null}
            <ReportStat label="Pesanan" value={num(s.orders)} testId="laporan-pesanan" hint="Dibayar, tidak batal atau retur" change={<ChangeChip current={s.orders} previous={compare?.orders} />} />
            {finance ? <ReportStat label="Rata-rata nilai pesanan" value={rp(s.averageOrder)} change={<ChangeChip current={s.averageOrder} previous={compare?.averageOrder} />} /> : null}
            <ReportStat label="Barang terjual" value={`${num(s.itemsSold)} unit`} change={<ChangeChip current={s.itemsSold} previous={compare?.itemsSold} />} />
            {finance ? (
              <>
                <ReportStat label="Diskon produk" value={rp(s.productDiscount)} hint="Selisih harga normal dan harga jual" />
                <ReportStat label="Potongan voucher" value={rp(s.voucherDiscount)} />
                <ReportStat label="Poin dipakai" value={rp(s.pointsUsed)} />
                <ReportStat label="Ongkir dibayar pembeli" value={rp(s.shippingCharged)} hint={`Potongan ongkir ${rp(s.shippingDiscount)}`} />
              </>
            ) : null}
            <ReportStat label="Tingkat pembatalan" value={pct(s.cancelRate)} hint={`${num(s.cancelled)} dari ${num(s.created)} pesanan dibuat`} change={<ChangeChip current={s.cancelRate} previous={compare?.cancelRate} inverse />} />
            <ReportStat label="Tingkat retur" value={pct(s.returnRate)} hint={`${num(s.returned)} dari ${num(s.paid)} pesanan dibayar`} change={<ChangeChip current={s.returnRate} previous={compare?.returnRate} inverse />} />
          </div>
          {finance ? (
            <section className="rounded-xl border border-garis bg-putih p-4" data-testid="rekonsiliasi-omzet">
              <h2 className="text-sm font-semibold">Dari penjualan barang ke omzet</h2>
              <p className="mb-2 text-xs text-abu-hangat">Voucher gratis ongkir dihitung di baris ongkir, bukan di potongan voucher belanja, jadi tidak terhitung dua kali.</p>
              <dl className="grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
                <dt>Penjualan barang</dt>
                <dd className="text-right">{rp(report.reconciliation.itemSales)}</dd>
                <dt>Dikurangi potongan voucher belanja</dt>
                <dd className="text-right">-{rp(report.reconciliation.voucherDiscount)}</dd>
                <dt>Dikurangi poin dipakai</dt>
                <dd className="text-right">-{rp(report.reconciliation.pointsUsed)}</dd>
                <dt>Ditambah ongkir dibayar pembeli</dt>
                <dd className="text-right">+{rp(report.reconciliation.shippingPaid)}</dd>
                <dt className="pl-3 text-xs text-abu-hangat">Tarif ongkir {rp(report.reconciliation.shippingCost)}, gratis ongkir otomatis -{rp(report.reconciliation.autoFreeShipping)}, voucher gratis ongkir -{rp(report.reconciliation.voucherShipping)}</dt>
                <dd />
                <dt className="border-t border-garis pt-1 font-semibold">Omzet</dt>
                <dd className="border-t border-garis pt-1 text-right font-semibold">{rp(report.reconciliation.revenue)}</dd>
              </dl>
              {!report.reconciliation.balanced ? <p className="mt-2 text-xs text-bahaya">Selisih {rp(report.reconciliation.revenue - report.reconciliation.computed)}. Hubungi tim teknis.</p> : null}
            </section>
          ) : null}
          <section className="rounded-xl border border-garis bg-putih p-4">
            <h2 className="mb-2 text-sm font-semibold">{finance ? "Omzet harian" : "Pesanan harian"}</h2>
            <DailyChart series={report.daily} finance={finance} />
          </section>
        </div>
      ) : null}

      {tab === "merek" || tab === "kategori" ? (
        <ReportTable
          title={tab === "merek" ? "Penjualan per merek" : "Penjualan per kategori"}
          note="Penjualan barang = harga satuan dikali jumlah, dari pesanan dalam omzet (sebelum voucher, ongkir, dan poin)."
          finance={finance}
          testId="tabel-rincian"
          rows={tab === "merek" ? report.brands : report.categories}
          cols={[
            { header: tab === "merek" ? "Merek" : "Kategori", cell: (x) => x.label },
            { header: "Pesanan", align: "right", cell: (x) => num(x.orders) },
            { header: "Unit", align: "right", cell: (x) => num(x.quantity), total: num(sumOf(tab === "merek" ? report.brands : report.categories, (x) => x.quantity)) },
            { header: "Penjualan barang", align: "right", money: true, cell: (x) => rp(x.sales), total: rp(sumOf(tab === "merek" ? report.brands : report.categories, (x) => x.sales)) },
          ]}
        />
      ) : null}

      {tab === "cabang" ? (
        <ReportTable
          title="Omzet per cabang asal"
          finance={finance}
          testId="tabel-rincian"
          rows={report.locations}
          cols={[
            { header: "Cabang asal", cell: (x) => x.label },
            { header: "Pesanan", align: "right", cell: (x) => num(x.orders), total: num(sumOf(report.locations, (x) => x.orders)) },
            { header: "Omzet", align: "right", money: true, cell: (x) => rp(x.revenue), total: rp(sumOf(report.locations, (x) => x.revenue)) },
            { header: "Porsi", align: "right", money: true, cell: (x) => pct(x.share) },
          ]}
        />
      ) : null}

      {tab === "kanal" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {(
            [
              ["Kirim dibanding ambil", report.channels.method],
              ["Metode bayar", report.channels.payment],
              ["Kurir", report.channels.courier],
            ] as const
          ).map(([title, rows]) => (
            <ReportTable
              key={title}
              title={title}
              finance={finance}
              testId="tabel-rincian"
              rows={[...rows]}
              cols={[
                { header: "Kanal", cell: (x) => x.label },
                { header: "Pesanan", align: "right", cell: (x) => num(x.orders), total: num(sumOf([...rows], (x) => x.orders)) },
                { header: "Omzet", align: "right", money: true, cell: (x) => rp(x.revenue), total: rp(sumOf([...rows], (x) => x.revenue)) },
                { header: "Porsi", align: "right", money: true, cell: (x) => pct(x.share) },
              ]}
            />
          ))}
        </div>
      ) : null}

      {tab === "produk" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportTable
            title="Produk terlaris"
            finance={finance}
            testId="tabel-rincian"
            rows={report.products.slice(0, 20)}
            cols={[
              { header: "Produk", cell: (x) => <Link href={`/p/${x.slug}`} className="hover:underline">{x.label}</Link> },
              { header: "Merek", cell: (x) => x.brandName },
              { header: "Unit", align: "right", cell: (x) => num(x.quantity) },
              { header: "Penjualan", align: "right", money: true, cell: (x) => rp(x.sales) },
            ]}
          />
          <ReportTable
            title="Varian terlaris"
            finance={finance}
            rows={report.variants.slice(0, 20)}
            cols={[
              {
                header: "Varian",
                cell: (x) => (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 shrink-0 rounded-full border border-garis" style={{ background: x.hex }} aria-hidden />
                    {x.label}
                  </span>
                ),
              },
              { header: "SKU", cell: (x) => <span className="font-mono text-xs">{x.sku}</span> },
              { header: "Unit", align: "right", cell: (x) => num(x.quantity) },
              { header: "Penjualan", align: "right", money: true, cell: (x) => rp(x.sales) },
            ]}
          />
        </div>
      ) : null}

      {tab === "promo" ? (
        <div className="space-y-4">
          <ReportTable
            title="Kinerja voucher"
            finance={finance}
            testId="tabel-rincian"
            rows={report.vouchers}
            cols={[
              { header: "Kode", cell: (x) => <span className="font-mono font-semibold">{x.code}</span> },
              { header: "Pesanan", align: "right", cell: (x) => num(x.orders), total: num(sumOf(report.vouchers, (x) => x.orders)) },
              { header: "Kuota terpakai", align: "right", cell: (x) => (x.quota == null ? `${num(x.used)} (tanpa batas)` : `${num(x.used)} dari ${num(x.quota)}`) },
              { header: "Omzet", align: "right", money: true, cell: (x) => rp(x.revenue), total: rp(sumOf(report.vouchers, (x) => x.revenue)) },
              { header: "Potongan", align: "right", money: true, cell: (x) => rp(x.discount), total: rp(sumOf(report.vouchers, (x) => x.discount)) },
            ]}
          />
          <ReportTable
            title="Kinerja flash sale"
            note="Slot yang mulai dalam periode ini. Potongan = selisih harga normal dan harga flash."
            finance={finance}
            rows={report.flash}
            cols={[
              { header: "Slot", cell: (x) => `${x.name}, ${formatDateTimeWib(x.startsAt)}${x.source === "admin" ? " (admin)" : ""}` },
              { header: "Unit terjual", align: "right", cell: (x) => num(x.quantity), total: num(sumOf(report.flash, (x) => x.quantity)) },
              { header: "Kuota terpakai", align: "right", cell: (x) => `${num(x.sold)} dari ${num(x.quota)}` },
              { header: "Penjualan", align: "right", money: true, cell: (x) => rp(x.sales), total: rp(sumOf(report.flash, (x) => x.sales)) },
              { header: "Potongan", align: "right", money: true, cell: (x) => rp(x.discount), total: rp(sumOf(report.flash, (x) => x.discount)) },
            ]}
          />
        </div>
      ) : null}

      {tab === "pelanggan" ? (
        <ReportTable
          title="Pembeli baru dibanding kembali"
          note="Baru: pesanan dalam omzet pertamanya jatuh di periode ini. Kembali: sudah pernah membeli sebelumnya. Tamu dihitung per nomor WA."
          finance={finance}
          testId="tabel-rincian"
          rows={[
            { label: "Pembeli baru", buyers: report.customers.newBuyers, orders: report.customers.newOrders, revenue: report.customers.newRevenue },
            { label: "Pembeli kembali", buyers: report.customers.returningBuyers, orders: report.customers.returningOrders, revenue: report.customers.returningRevenue },
          ]}
          cols={[
            { header: "Kelompok", cell: (x) => x.label },
            { header: "Pembeli", align: "right", cell: (x) => num(x.buyers), total: num(report.customers.newBuyers + report.customers.returningBuyers) },
            { header: "Pesanan", align: "right", cell: (x) => num(x.orders), total: num(report.customers.newOrders + report.customers.returningOrders) },
            { header: "Omzet", align: "right", money: true, cell: (x) => rp(x.revenue), total: rp(report.customers.newRevenue + report.customers.returningRevenue) },
          ]}
        />
      ) : null}
    </>
  );
}

export default function ReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
