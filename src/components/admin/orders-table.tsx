"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ListChecks, Loader2, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/order/order-parts";
import { processOrdersAction } from "@/lib/admin/actions";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import type { CardOrder } from "./order-card";
import { tdClass, thClass } from "./ui";

export function OrdersTable({ rows, canProcess, canPrint }: { rows: CardOrder[]; canProcess: boolean; canPrint: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [report, setReport] = useState<string | null>(null);
  const all = rows.length > 0 && selected.length === rows.length;
  const toggle = (n: string) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  const query = encodeURIComponent(selected.join(","));

  return (
    <div>
      {selected.length ? (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-kopi/20 bg-putih p-2 shadow-soft lg:top-2">
          <span className="px-2 text-sm font-semibold">{selected.length} dipilih</span>
          {canProcess ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await processOrdersAction(selected);
                  if (!r.ok) return setReport(r.message);
                  const ok = r.results.filter((x) => x.ok).length;
                  const skipped = r.results.filter((x) => !x.ok);
                  setReport(`${ok} pesanan diproses.${skipped.length ? ` Dilewati: ${skipped.map((s) => `${s.number} (${s.message})`).join("; ")}` : ""}`);
                  setSelected([]);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />} Proses terpilih
            </Button>
          ) : null}
          {canPrint ? (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/admin/label?nomor=${query}`} target="_blank" rel="noreferrer">
                  <FileText /> Cetak label A6
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/admin/daftar-ambil?nomor=${query}`} target="_blank" rel="noreferrer">
                  <ListChecks /> Daftar ambil
                </a>
              </Button>
            </>
          ) : null}
          <button type="button" className="ml-auto px-2 text-xs font-semibold text-abu-hangat hover:text-kopi" onClick={() => setSelected([])}>
            Batal pilih
          </button>
        </div>
      ) : null}
      {report ? (
        <p className="mb-3 rounded-lg bg-[#E5F2EA] px-3 py-2 text-sm text-sukses" role="status">
          {report}
        </p>
      ) : null}

      {/* HP: daftar kartu dengan kotak pilih. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((o) => (
          <li key={o.id} className="flex gap-3 rounded-xl border border-garis bg-putih p-3">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--color-kopi)]" checked={selected.includes(o.number)} onChange={() => toggle(o.number)} aria-label={`Pilih ${o.number}`} />
            <Link href={`/admin/pesanan/${o.number}`} className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular-nums">{o.number}</span>
                <Badge variant={statusTone[o.status as OrderStatus]}>{statusLabels[o.status as OrderStatus]}</Badge>
              </span>
              <span className="mt-0.5 block truncate text-sm text-abu-hangat">
                {o.name || "Tamu"} · {o.method === "ambil" ? `Ambil di ${o.locationName}` : (o.service ?? "Kirim")}
              </span>
              <span className="mt-0.5 flex justify-between text-xs text-abu-hangat">
                <span>{formatDateTimeWib(new Date(o.createdAt))}</span>
                <span className="font-semibold text-kopi tabular-nums">{formatRupiah(o.total)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: tabel padat. */}
      <div className="hidden overflow-x-auto rounded-xl border border-garis bg-putih md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-garis bg-porselen/70">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" className="size-4 accent-[var(--color-kopi)]" checked={all} onChange={() => setSelected(all ? [] : rows.map((r) => r.number))} aria-label="Pilih semua" />
              </th>
              <th className={thClass}>Nomor</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Pembeli</th>
              <th className={thClass}>Metode</th>
              <th className={thClass}>Lokasi</th>
              <th className={`${thClass} text-right`}>Barang</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={thClass}>Dibuat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-porselen/60">
                <td className="px-3 py-2">
                  <input type="checkbox" className="size-4 accent-[var(--color-kopi)]" checked={selected.includes(o.number)} onChange={() => toggle(o.number)} aria-label={`Pilih ${o.number}`} />
                </td>
                <td className={tdClass}>
                  <Link href={`/admin/pesanan/${o.number}`} className="font-semibold tabular-nums hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className={tdClass}>
                  <Badge variant={statusTone[o.status as OrderStatus]}>{statusLabels[o.status as OrderStatus]}</Badge>
                </td>
                <td className={`${tdClass} max-w-40 truncate`}>{o.name || "Tamu"}</td>
                <td className={tdClass}>{o.method === "ambil" ? "Ambil" : (o.service ?? "Kirim")}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{o.locationName}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{o.itemCount}</td>
                <td className={`${tdClass} text-right whitespace-nowrap tabular-nums`}>{formatRupiah(o.total)}</td>
                <td className={`${tdClass} whitespace-nowrap text-abu-hangat`}>{formatDateTimeWib(new Date(o.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-garis bg-putih p-6 text-center text-sm text-abu-hangat">Tidak ada pesanan yang cocok dengan filter.</p> : null}
    </div>
  );
}
