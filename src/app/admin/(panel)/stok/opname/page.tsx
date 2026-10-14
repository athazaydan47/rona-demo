import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { OpnameSheet } from "@/components/admin/opname-sheet";
import { Denied, fieldClass, PageHead, Skeleton } from "@/components/admin/ui";
import { db, schema } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { stockMatrix, visibleLocations } from "@/lib/admin/stock";

export const metadata: Metadata = { title: "Opname" };

type SP = { lokasi?: string; q?: string; merek?: string };
type Props = { searchParams: Promise<SP> };

async function Content({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/stok/opname");
  if (!can(me, "stok.opname")) return <Denied />;
  const locations = (await visibleLocations(db, me)).filter((l) => can(me, "stok.opname", { lokasiId: l.id }));
  if (!locations.length) return <Denied message="Tidak ada lokasi yang bisa kamu opname." />;
  const loc = locations.find((l) => l.id === Number(sp.lokasi)) ?? locations[0];
  const brands = await db.select({ slug: schema.brands.slug, name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name));
  // Lembar hitung boleh sebagian varian lewat filter; maksimal 300 baris sekali opname.
  const m = await stockMatrix(db, me, { q: sp.q, brand: sp.merek, pageSize: 300 });
  const rows = m.rows.map((r) => ({ variantId: r.variantId, productName: r.productName, shadeName: r.shadeName, sku: r.sku, hex: r.hex, onHand: r.cells[loc.id]?.onHand ?? 0, reserved: r.cells[loc.id]?.reserved ?? 0 }));
  return (
    <>
      <form action="/admin/stok/opname" className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-garis bg-putih p-3 md:grid-cols-4">
        <select name="lokasi" defaultValue={loc.id} aria-label="Lokasi opname" className={fieldClass}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select name="merek" defaultValue={sp.merek ?? ""} aria-label="Merek" className={fieldClass}>
          <option value="">Semua merek</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Produk, shade, SKU" aria-label="Saring varian" className={fieldClass} />
        <button type="submit" className="h-10 rounded-lg bg-kopi px-4 text-sm font-semibold text-putih">
          Tampilkan lembar
        </button>
      </form>
      <p className="mb-2 text-sm text-abu-hangat">
        Lembar hitung {loc.name}: {rows.length} varian. Isi hanya yang dihitung; baris kosong tidak ikut.
      </p>
      <OpnameSheet key={`${loc.id}-${sp.q ?? ""}-${sp.merek ?? ""}`} locationId={loc.id} locationName={loc.name} rows={rows} />
    </>
  );
}

export default function OpnamePage(props: Props) {
  return (
    <>
      <Link href="/admin/stok" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-aksen hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Stok
      </Link>
      <PageHead title="Opname" description="Hitung stok fisik, lihat selisihnya, lalu simpan. Stok fisik tidak boleh lebih kecil dari jumlah yang sedang dipesan." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content {...props} />
      </Suspense>
    </>
  );
}
