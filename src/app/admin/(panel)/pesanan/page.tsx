import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { OrdersKanban } from "@/components/admin/orders-kanban";
import { OrdersTable } from "@/components/admin/orders-table";
import { Denied, fieldClass, PageHead, Pager, Skeleton } from "@/components/admin/ui";
import type { CardOrder } from "@/components/admin/order-card";
import { db, schema } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { kanbanBoard, listAdminOrders, type AdminOrderRow } from "@/lib/admin/orders";
import { can, canAccessLocation, type StaffPrincipal } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";
import { wibDate } from "@/lib/format";
import { ORDER_STATUSES, statusLabels, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pesanan" };

type SP = { tampilan?: string; status?: string; metode?: string; lokasi?: string; kurir?: string; dari?: string; sampai?: string; q?: string; hal?: string };
type Props = { searchParams: Promise<SP> };

const COURIERS: [string, string][] = [
  ["jne_reg", "JNE REG"],
  ["jne_yes", "JNE YES"],
  ["jnt_ez", "J&T EZ"],
  ["sicepat_reg", "SiCepat REG"],
  ["instan", "Kurir Instan"],
];

const parseDay = (v?: string) => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? wibDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

function toCard(staff: StaffPrincipal, o: AdminOrderRow): CardOrder {
  return { ...o, createdAt: o.createdAt.toISOString(), canChange: can(staff, "pesanan.ubah_status", { lokasiId: o.locationId }), canCancel: can(staff, "pesanan.batalkan", { lokasiId: o.locationId }) };
}

async function Content({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/pesanan");
  if (!can(me, "pesanan.lihat")) return <Denied />;
  const view = sp.tampilan === "tabel" ? "tabel" : "kanban";
  const locations = (await db.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(asc(schema.locations.sortOrder))).filter((l) => canAccessLocation(me, l.id));
  const tabs = (
    <div className="inline-flex rounded-lg border border-garis bg-putih p-0.5 text-sm" role="tablist" aria-label="Tampilan">
      {(["kanban", "tabel"] as const).map((v) => (
        <Link key={v} role="tab" aria-selected={view === v} href={`/admin/pesanan?tampilan=${v}`} className={cn("rounded-md px-3 py-1.5 font-medium", view === v ? "bg-kopi text-putih" : "text-kopi")}>
          {v === "kanban" ? "Kanban" : "Tabel"}
        </Link>
      ))}
    </div>
  );

  if (view === "kanban") {
    const board = await kanbanBoard(db, me, now());
    return (
      <>
        <PageHead title="Pesanan" description="Seret kartu ke kolom lain untuk mengubah status. Hanya perpindahan yang sah yang diterima.">
          {tabs}
        </PageHead>
        <OrdersKanban columns={board.map((c) => ({ status: c.status, total: c.total, orders: c.orders.map((o) => toCard(me, o)) }))} />
      </>
    );
  }

  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : null;
  const method = sp.metode === "kirim" || sp.metode === "ambil" ? sp.metode : null;
  const locationId = Number(sp.lokasi) || null;
  const page = Number.parseInt(sp.hal ?? "1", 10) || 1;
  const to = parseDay(sp.sampai);
  const r = await listAdminOrders(db, me, { status, method, locationId, courier: COURIERS.some(([c]) => c === sp.kurir) ? sp.kurir! : null, from: parseDay(sp.dari), to: to ? new Date(to.getTime() + 24 * 60 * 60_000) : null, q: sp.q, page });
  const params = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, tampilan: "tabel", hal: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/admin/pesanan?${u}`;
  };
  return (
    <>
      <PageHead title="Pesanan" description={`${r.total} pesanan`}>
        {tabs}
      </PageHead>
      <form className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-garis bg-putih p-3 md:grid-cols-4 xl:grid-cols-8" action="/admin/pesanan">
        <input type="hidden" name="tampilan" value="tabel" />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Nomor, nama, nomor WA" aria-label="Cari" className={cn(fieldClass, "col-span-2")} />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={fieldClass}>
          <option value="">Semua status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <select name="metode" defaultValue={method ?? ""} aria-label="Metode" className={fieldClass}>
          <option value="">Kirim dan ambil</option>
          <option value="kirim">Kirim</option>
          <option value="ambil">Ambil di Toko</option>
        </select>
        <select name="lokasi" defaultValue={locationId ?? ""} aria-label="Lokasi" className={fieldClass}>
          <option value="">Semua lokasi</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select name="kurir" defaultValue={sp.kurir ?? ""} aria-label="Kurir" className={fieldClass}>
          <option value="">Semua kurir</option>
          {COURIERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input type="date" name="dari" defaultValue={sp.dari ?? ""} aria-label="Dari tanggal" className={fieldClass} />
        <input type="date" name="sampai" defaultValue={sp.sampai ?? ""} aria-label="Sampai tanggal" className={fieldClass} />
        <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-8">
          <button type="submit" className="h-10 rounded-lg bg-kopi px-4 text-sm font-semibold text-putih">
            Terapkan
          </button>
          <Link href="/admin/pesanan?tampilan=tabel" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-abu-hangat hover:text-kopi">
            Hapus filter
          </Link>
        </div>
      </form>
      <OrdersTable rows={r.rows.map((o) => toCard(me, o))} canProcess={can(me, "pesanan.ubah_status")} canPrint={can(me, "pesanan.cetak")} />
      <Pager page={r.page} pageCount={r.pageCount} href={params} />
    </>
  );
}

export default function AdminOrdersPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Content {...props} />
    </Suspense>
  );
}
