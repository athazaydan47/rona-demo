import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { Denied, fieldClass, PageHead, Pager, Skeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { listAdminReviews } from "@/lib/admin/reviews";
import { formatDateTimeWib, formatDateWib, wibDate } from "@/lib/format";

export const metadata: Metadata = { title: "Ulasan" };

type SP = { bintang?: string; status?: string; belum?: string; foto?: string; produk?: string; dari?: string; sampai?: string; hal?: string };
const parseDay = (v?: string) => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? wibDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const me = await requireStaff("/admin/ulasan");
  if (!can(me, "ulasan.kelola")) return <Denied />;
  const sp = await searchParams;
  const rating = Number(sp.bintang);
  const to = parseDay(sp.sampai);
  const r = await listAdminReviews(db, {
    rating: rating >= 1 && rating <= 5 ? rating : null,
    status: sp.status === "tampil" || sp.status === "sembunyi" ? sp.status : null,
    unreplied: sp.belum === "1",
    photo: sp.foto === "1",
    product: sp.produk ?? null,
    from: parseDay(sp.dari),
    to: to ? new Date(to.getTime() + 86_400_000) : null,
    page: Number.parseInt(sp.hal ?? "1", 10) || 1,
  });
  const href = (p: number) => `/admin/ulasan?${new URLSearchParams(Object.entries({ ...sp, hal: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-garis bg-putih p-3 sm:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]" aria-label="Filter ulasan">
        <select name="bintang" defaultValue={sp.bintang ?? ""} className={fieldClass} aria-label="Bintang">
          <option value="">Semua bintang</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} bintang
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={fieldClass} aria-label="Status ulasan">
          <option value="">Tampil dan tersembunyi</option>
          <option value="tampil">Tampil</option>
          <option value="sembunyi">Tersembunyi</option>
        </select>
        <input name="produk" defaultValue={sp.produk ?? ""} placeholder="Nama produk" className={fieldClass} aria-label="Cari produk" />
        <div className="flex gap-2">
          <input type="date" name="dari" defaultValue={sp.dari ?? ""} className={fieldClass} aria-label="Dari tanggal" />
          <input type="date" name="sampai" defaultValue={sp.sampai ?? ""} className={fieldClass} aria-label="Sampai tanggal" />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="belum" value="1" defaultChecked={sp.belum === "1"} className="size-4 accent-rona" /> Belum dibalas
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="foto" value="1" defaultChecked={sp.foto === "1"} className="size-4 accent-rona" /> Ada foto
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Terapkan
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/ulasan">Reset</Link>
          </Button>
        </div>
      </form>
      <p className="mb-2 text-sm text-abu-hangat">{r.total} ulasan</p>
      <ReviewModeration
        key={href(r.page)}
        rows={r.rows.map((x) => ({ ...x, createdLabel: formatDateWib(x.createdAt), repliedLabel: x.repliedAt ? formatDateTimeWib(x.repliedAt) : null }))}
      />
      <Pager page={r.page} pageCount={r.pageCount} href={href} />
    </>
  );
}

export default function ReviewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <PageHead title="Ulasan" description="Sembunyikan ulasan yang melanggar (wajib alasan) dan balas sebagai toko. Semua aksi tercatat di log." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
