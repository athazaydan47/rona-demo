// Bagian tampilan halaman Laporan. Tanpa state, jadi dirender di server.
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatNumber, formatRupiah } from "@/lib/format";
import { percentChange } from "@/lib/reports";
import { cn } from "@/lib/utils";

export function ChangeChip({ current, previous, inverse = false }: { current: number; previous: number | null | undefined; inverse?: boolean }) {
  if (previous == null) return null;
  const pct = percentChange(current, previous);
  if (pct == null) return <span className="text-[11px] text-abu-hangat">belum ada pembanding</span>;
  const up = pct > 0;
  const good = pct === 0 ? null : inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums", good == null ? "text-abu-hangat" : good ? "text-sukses" : "text-bahaya")} data-testid="perubahan">
      {pct !== 0 ? <Icon className="size-3" aria-hidden /> : null}
      {pct > 0 ? "+" : ""}
      {pct.toLocaleString("id-ID")}% <span className="font-normal text-abu-hangat">dari periode sebelumnya</span>
    </span>
  );
}

export function ReportStat({ label, value, hint, change, testId }: { label: string; value: string; hint?: string; change?: React.ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-garis bg-putih p-3 sm:p-4">
      <p className="text-xs font-medium text-abu-hangat">{label}</p>
      <p className="mt-1 truncate font-serif text-xl text-kopi tabular-nums sm:text-2xl" data-testid={testId}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-abu-hangat">{hint}</p> : null}
      {change ? <div className="mt-0.5">{change}</div> : null}
    </div>
  );
}

// Grafik batang harian. Mode keuangan memakai omzet, tanpa izin keuangan memakai jumlah pesanan.
export function DailyChart({ series, finance }: { series: { day: string; revenue: number; orders: number }[]; finance: boolean }) {
  const value = (d: (typeof series)[number]) => (finance ? d.revenue : d.orders);
  const max = Math.max(1, ...series.map(value));
  const W = 600;
  const H = 160;
  const bw = W / Math.max(1, series.length);
  const every = Math.max(1, Math.ceil(series.length / 8));
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-44 w-full" role="img" aria-label={finance ? "Grafik omzet harian" : "Grafik jumlah pesanan harian"} data-testid="grafik-laporan">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--color-garis)" strokeWidth={1} />
        ))}
        {series.map((d, i) => {
          const h = Math.max(value(d) ? 2 : 0, (value(d) / max) * (H - 8));
          return (
            <g key={d.day}>
              <rect x={i * bw + Math.min(2, bw * 0.15)} y={H - h} width={Math.max(1, bw - Math.min(4, bw * 0.3))} height={h} rx={Math.min(2, bw / 4)} fill="var(--color-kopi)" opacity={0.8}>
                <title>{`${d.day}: ${finance ? `${formatRupiah(d.revenue)}, ` : ""}${d.orders} pesanan`}</title>
              </rect>
              {i % every === 0 || i === series.length - 1 ? (
                <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize={10} fill="var(--color-abu-hangat)">
                  {Number(d.day.slice(8))}/{Number(d.day.slice(5, 7))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-abu-hangat">{finance ? "Omzet per tanggal bayar (WIB)." : "Jumlah pesanan dalam omzet per tanggal bayar (WIB)."}</figcaption>
    </figure>
  );
}

export type TableCol<T> = { header: string; cell: (r: T) => React.ReactNode; align?: "right"; money?: boolean; total?: React.ReactNode };

// Tabel rincian: digulir ke samping di dalam kartunya, halaman tidak ikut melebar.
export function ReportTable<T>({ title, rows, cols, finance, empty = "Belum ada data di periode ini.", testId, note }: { title: string; rows: T[]; cols: TableCol<T>[]; finance: boolean; empty?: string; testId?: string; note?: string }) {
  const shown = cols.filter((c) => finance || !c.money);
  const hasTotal = shown.some((c) => c.total != null);
  return (
    <section className="min-w-0 rounded-xl border border-garis bg-putih" data-testid={testId}>
      <div className="border-b border-garis px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note ? <p className="text-xs text-abu-hangat">{note}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-porselen/60 text-left text-xs text-abu-hangat">
            <tr>
              {shown.map((c) => (
                <th key={c.header} className={cn("px-3 py-2 font-semibold whitespace-nowrap", c.align === "right" && "text-right")}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {rows.map((r, i) => (
              <tr key={i}>
                {shown.map((c) => (
                  <td key={c.header} className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums whitespace-nowrap")}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={shown.length} className="px-3 py-6 text-center text-abu-hangat">
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
          {hasTotal && rows.length ? (
            <tfoot className="border-t-2 border-garis font-semibold">
              <tr>
                {shown.map((c, i) => (
                  <td key={c.header} className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums whitespace-nowrap")}>
                    {c.total ?? (i === 0 ? "Total" : "")}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

export const rp = (n: number) => formatRupiah(n);
export const num = (n: number) => formatNumber(n);
export const pct = (n: number) => `${n.toLocaleString("id-ID")}%`;
