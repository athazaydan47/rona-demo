import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { Denied, fieldClass, Panel, Skeleton, tdClass, thClass } from "@/components/admin/ui";
import { ProductArt } from "@/components/product-art";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { variantStock } from "@/lib/admin/stock";
import { formatDateTimeWib, wibDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detail stok" };

type SP = { jenis?: string; dari?: string; sampai?: string; hal?: string };
type Props = { params: Promise<{ variantId: string }>; searchParams: Promise<SP> };

const TYPES: Record<string, string> = { masuk: "Masuk", keluar: "Keluar", transfer: "Transfer", opname: "Opname", retur: "Retur", pesan: "Dipesan", lepas: "Dilepas" };
const parseDay = (v?: string) => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? wibDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

async function Content({ params, searchParams }: Props) {
  await connection();
  const [{ variantId }, sp] = await Promise.all([params, searchParams]);
  const me = await requireStaff(`/admin/stok/${variantId}`);
  if (!can(me, "stok.lihat")) return <Denied />;
  const id = Number.parseInt(variantId, 10);
  if (!Number.isInteger(id)) notFound();
  const to = parseDay(sp.sampai);
  const page = Number.parseInt(sp.hal ?? "1", 10) || 1;
  const d = await variantStock(db, me, id, { type: sp.jenis, from: parseDay(sp.dari), to: to ? new Date(to.getTime() + 86_400_000) : null, page });
  if (!d) notFound();
  const locName = new Map(d.locations.map((l) => [l.id, l.name]));
  const qs = (p: number) => `/admin/stok/${id}?${new URLSearchParams(Object.entries({ ...sp, hal: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <div className="space-y-4">
      <Link href="/admin/stok" className="inline-flex items-center gap-1 text-sm font-semibold text-aksen hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Matriks stok
      </Link>
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 overflow-hidden rounded-lg">
          <ProductArt packaging={d.variant.packaging} shade={d.variant.hex} brandColor={d.variant.brandColor} brandName={d.variant.brandName} title="" />
        </span>
        <div>
          <p className="text-xs text-abu-hangat">{d.variant.brandName}</p>
          <h1 className="font-serif text-2xl text-kopi">{d.variant.productName}</h1>
          <p className="text-sm text-abu-hangat">
            {d.variant.shadeName} · {d.variant.sku}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {d.locations.map((l) => (
          <div key={l.id} className="rounded-xl border border-garis bg-putih p-3" data-lokasi={l.slug}>
            <p className="text-xs text-abu-hangat">{l.name}</p>
            <p className="font-serif text-2xl tabular-nums" data-testid={`tersedia-${l.slug}`}>
              {l.available}
            </p>
            <p className="text-xs text-abu-hangat tabular-nums">
              fisik {l.onHand} · dipesan {l.reserved}
            </p>
          </div>
        ))}
      </div>
      <Panel title="Buku stok" padded={false}>
        <form className="grid grid-cols-2 gap-2 border-b border-garis p-3 md:grid-cols-4" action={`/admin/stok/${id}`}>
          <select name="jenis" defaultValue={sp.jenis ?? ""} aria-label="Jenis gerakan" className={fieldClass}>
            <option value="">Semua jenis</option>
            {Object.entries(TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input type="date" name="dari" defaultValue={sp.dari ?? ""} aria-label="Dari tanggal" className={fieldClass} />
          <input type="date" name="sampai" defaultValue={sp.sampai ?? ""} aria-label="Sampai tanggal" className={fieldClass} />
          <button type="submit" className="h-10 rounded-lg bg-kopi px-4 text-sm font-semibold text-putih">
            Saring
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="buku-stok">
            <thead className="border-b border-garis bg-porselen/70">
              <tr>
                <th className={thClass}>Waktu</th>
                <th className={thClass}>Lokasi</th>
                <th className={thClass}>Jenis</th>
                <th className={`${thClass} text-right`}>Jumlah</th>
                <th className={thClass}>Referensi</th>
                <th className={thClass}>Oleh</th>
                <th className={thClass}>Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-garis">
              {d.movements.map((mv) => (
                <tr key={mv.id}>
                  <td className={`${tdClass} whitespace-nowrap text-abu-hangat`}>{formatDateTimeWib(mv.createdAt)}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{locName.get(mv.locationId)}</td>
                  <td className={tdClass}>{TYPES[mv.type] ?? mv.type}</td>
                  <td className={cn(tdClass, "text-right font-semibold tabular-nums", mv.quantity < 0 ? "text-bahaya" : "text-sukses")}>
                    {mv.quantity > 0 ? "+" : ""}
                    {mv.quantity}
                  </td>
                  <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>{mv.reference}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{mv.actor}</td>
                  <td className={`${tdClass} max-w-56 truncate text-abu-hangat`}>{mv.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.movements.length === 0 ? <p className="p-4 text-center text-sm text-abu-hangat">Belum ada gerakan yang cocok.</p> : null}
        <div className="flex justify-between gap-2 p-3 text-sm">
          {d.page > 1 ? (
            <Link href={qs(d.page - 1)} className="font-semibold text-aksen">
              Lebih baru
            </Link>
          ) : (
            <span />
          )}
          {d.hasMore ? (
            <Link href={qs(d.page + 1)} className="font-semibold text-aksen">
              Lebih lama
            </Link>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

export default function VariantStockPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Content {...props} />
    </Suspense>
  );
}
