import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Denied, fieldClass, PageHead, Pager, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { contactView, listCustomers, SEGMENT_LABELS, SEGMENT_TONE, type CustomerSort, type Segment } from "@/lib/admin/customers";
import { can } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";
import { formatDateWib, formatNumber, formatRupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Pelanggan" };

type SP = { q?: string; segmen?: string; urut?: string; hal?: string };
const SORTS: [CustomerSort, string][] = [
  ["belanja", "Total belanja"],
  ["pesanan", "Jumlah pesanan"],
  ["terakhir", "Terakhir belanja"],
];

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const me = await requireStaff("/admin/pelanggan");
  if (!can(me, "pelanggan.lihat")) return <Denied />;
  const sp = await searchParams;
  const segment = (Object.keys(SEGMENT_LABELS) as Segment[]).includes(sp.segmen as Segment) ? (sp.segmen as Segment) : null;
  const sort = SORTS.some(([k]) => k === sp.urut) ? (sp.urut as CustomerSort) : "belanja";
  const r = await listCustomers(db, { q: sp.q, segment, sort, page: Number.parseInt(sp.hal ?? "1", 10) || 1 }, now());
  const href = (p: number) => `/admin/pelanggan?${new URLSearchParams(Object.entries({ ...sp, hal: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-garis bg-putih p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]" aria-label="Filter pelanggan">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari nama atau nomor WA" className={fieldClass} aria-label="Cari pelanggan" />
        <select name="segmen" defaultValue={segment ?? ""} className={fieldClass} aria-label="Segmen">
          <option value="">Semua segmen</option>
          {(Object.keys(SEGMENT_LABELS) as Segment[]).map((s) => (
            <option key={s} value={s}>
              {SEGMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="urut" defaultValue={sort} className={fieldClass} aria-label="Urutkan">
          {SORTS.map(([k, l]) => (
            <option key={k} value={k}>
              Urut: {l}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Terapkan
        </Button>
      </form>
      <p className="mb-2 text-sm text-abu-hangat">{formatNumber(r.total)} pelanggan terdaftar</p>
      <div className="overflow-x-auto rounded-xl border border-garis bg-putih">
        <table className="w-full min-w-[640px] text-sm" data-testid="tabel-pelanggan">
          <thead className="bg-porselen/60 text-left text-xs text-abu-hangat">
            <tr>
              <th className="px-3 py-2 font-semibold">Pelanggan</th>
              <th className="px-3 py-2 font-semibold">Segmen</th>
              <th className="px-3 py-2 text-right font-semibold">Total belanja</th>
              <th className="px-3 py-2 text-right font-semibold">Pesanan</th>
              <th className="px-3 py-2 font-semibold">Terakhir belanja</th>
              <th className="px-3 py-2 text-right font-semibold">Poin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {r.rows.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2">
                  <Link href={`/admin/pelanggan/${c.id}`} className="font-semibold hover:underline">
                    {c.name}
                  </Link>
                  <span className="block text-xs text-abu-hangat tabular-nums">{contactView(me, c).phone}</span>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={SEGMENT_TONE[c.segment]}>{SEGMENT_LABELS[c.segment]}</Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(c.spend)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(c.orders)}</td>
                <td className="px-3 py-2 text-xs">{c.lastOrderAt ? formatDateWib(c.lastOrderAt) : "Belum pernah"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(c.points)}</td>
              </tr>
            ))}
            {!r.rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-abu-hangat">
                  Tidak ada pelanggan yang cocok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={r.page} pageCount={r.pageCount} href={href} />
    </>
  );
}

export default function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <PageHead title="Pelanggan" description="Baru: 1 pesanan Selesai dalam 30 hari. Setia: 3 pesanan Selesai dalam 180 hari. Tidak aktif: tanpa pesanan 90 hari." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
