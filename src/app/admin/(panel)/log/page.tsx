import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { Denied, fieldClass, PageHead, Pager, Skeleton } from "@/components/admin/ui";
import { db, schema } from "@/db/client";
import { AUDIT_ACTIONS } from "@/lib/admin/audit";
import { groupLogins, listAudit } from "@/lib/admin/audit-query";
import { auditDiffView, auditObjectLabel, loadAuditNames } from "@/lib/admin/audit-view";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { formatDateTimeWib, wibDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Log aktivitas" };

type SP = { staf?: string; aksi?: string; objek?: string; cari?: string; dari?: string; sampai?: string; hal?: string; login?: string };
type Props = { searchParams: Promise<SP> };

const OBJECTS: Record<string, string> = { pesanan: "Pesanan", stok: "Stok", staf: "Staf", produk: "Produk", kategori: "Kategori", merek: "Merek", promo: "Promo", pengaturan: "Pengaturan", ulasan: "Ulasan", pelanggan: "Pelanggan", notifikasi: "Notifikasi", laporan: "Laporan", demo: "Demo" };
const parseDay = (v?: string) => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? wibDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

async function Content({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/log");
  if (!can(me, "log.lihat")) return <Denied />;
  const to = parseDay(sp.sampai);
  const [r, staff] = await Promise.all([
    listAudit(db, { staffId: Number(sp.staf) || null, action: sp.aksi && AUDIT_ACTIONS[sp.aksi] ? sp.aksi : null, objectType: sp.objek && OBJECTS[sp.objek] ? sp.objek : null, object: sp.cari ?? null, from: parseDay(sp.dari), to: to ? new Date(to.getTime() + 86_400_000) : null, page: Number.parseInt(sp.hal ?? "1", 10) || 1, includeLogins: sp.login === "1" }),
    db.select({ id: schema.staff.id, name: schema.staff.name }).from(schema.staff).orderBy(asc(schema.staff.name)),
  ]);
  const names = await loadAuditNames(db, r.rows);
  const href = (p: number) => `/admin/log?${new URLSearchParams(Object.entries({ ...sp, hal: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <form action="/admin/log" className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-garis bg-putih p-3 md:grid-cols-3 xl:grid-cols-7">
        <select name="staf" defaultValue={sp.staf ?? ""} aria-label="Staf" className={fieldClass}>
          <option value="">Semua staf</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="aksi" defaultValue={sp.aksi ?? ""} aria-label="Jenis aksi" className={fieldClass}>
          <option value="">Semua aksi</option>
          {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="objek" defaultValue={sp.objek ?? ""} aria-label="Objek" className={fieldClass}>
          <option value="">Semua objek</option>
          {Object.entries(OBJECTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input name="cari" defaultValue={sp.cari ?? ""} placeholder="Nomor pesanan, referensi" aria-label="Cari objek" className={fieldClass} />
        <input type="date" name="dari" defaultValue={sp.dari ?? ""} aria-label="Dari tanggal" className={fieldClass} />
        <input type="date" name="sampai" defaultValue={sp.sampai ?? ""} aria-label="Sampai tanggal" className={fieldClass} />
        <button type="submit" className="h-10 rounded-lg bg-kopi px-4 text-sm font-semibold text-putih">
          Saring
        </button>
        <label className="col-span-2 inline-flex items-center gap-2 text-sm md:col-span-3 xl:col-span-7">
          <input type="checkbox" name="login" value="1" defaultChecked={sp.login === "1"} className="size-4 accent-[var(--color-kopi)]" /> Tampilkan login (login berulang dalam 10 menit digabung)
        </label>
      </form>
      <ul className="space-y-2" data-testid="log-aktivitas">
        {groupLogins(r.rows).map((row) => {
          const diff = auditDiffView(row.action, row.before, row.after, names);
          return (
            <li key={row.id} className="rounded-xl border border-garis bg-putih p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className={cn("rounded-full px-2 text-[11px] font-semibold", row.action.endsWith("gagal") ? "bg-[#F7E3E1] text-bahaya" : "bg-porselen text-kopi")}>{AUDIT_ACTIONS[row.action] ?? row.action}</span>
                <span className="font-semibold">{row.actorName || "sistem"}</span>
                <span className="text-abu-hangat">
                  {OBJECTS[row.objectType] ?? row.objectType} {auditObjectLabel(row.objectType, row.objectId, names)}
                </span>
                {row.repeat > 1 ? <span className="rounded-full bg-porselen px-2 text-[11px] text-abu-hangat">{row.repeat} kali, sejak {formatDateTimeWib(row.firstAt)}</span> : null}
                <span className="ml-auto text-xs text-abu-hangat">{formatDateTimeWib(row.createdAt)}</span>
              </div>
              {row.summary ? <p className="mt-1 text-sm text-kopi/90">{row.summary}</p> : null}
              {diff.length ? (
                <table className="mt-2 w-full table-fixed text-xs">
                  <thead>
                    <tr className="text-left text-abu-hangat">
                      <th className="w-1/4 py-0.5 font-medium">Bagian</th>
                      <th className="py-0.5 font-medium">Sebelum</th>
                      <th className="py-0.5 font-medium">Sesudah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.slice(0, 12).map((d) => (
                      <tr key={d.key} className="align-top" data-kunci={d.key}>
                        <td className="py-0.5 pr-2 text-abu-hangat">{d.label}</td>
                        <td className="py-0.5 pr-2 break-words">{d.before !== undefined ? <span className="rounded bg-[#F7E3E1] px-1 text-bahaya line-through decoration-bahaya/40">{d.before}</span> : <span className="text-abu-hangat">-</span>}</td>
                        <td className="py-0.5 break-words">{d.after !== undefined ? <span className="rounded bg-[#EAF6EF] px-1 text-sukses">{d.after}</span> : <span className="text-abu-hangat">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </li>
          );
        })}
        {r.rows.length === 0 ? <li className="rounded-xl border border-dashed border-garis bg-putih p-6 text-center text-sm text-abu-hangat">Belum ada aktivitas yang cocok.</li> : null}
      </ul>
      <Pager page={r.page} pageCount={r.pageCount} href={href} />
    </>
  );
}

export default function AuditLogPage(props: Props) {
  return (
    <>
      <PageHead title="Log aktivitas" description="Siapa mengubah apa dan kapan: status pesanan, gerakan stok manual, staf dan izin, serta login staf." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Content {...props} />
      </Suspense>
    </>
  );
}
