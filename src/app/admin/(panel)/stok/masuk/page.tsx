import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { StockLinesForm } from "@/components/admin/stock-forms";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { visibleLocations } from "@/lib/admin/stock";

export const metadata: Metadata = { title: "Stok masuk" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/stok/masuk");
  if (!can(me, "stok.masuk")) return <Denied />;
  const locations = (await visibleLocations(db, me)).filter((l) => can(me, "stok.masuk", { lokasiId: l.id }));
  return <StockLinesForm mode="masuk" locations={locations.map((l) => ({ id: l.id, name: l.name }))} />;
}

export default function StockInPage() {
  return (
    <>
      <Link href="/admin/stok" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-aksen hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Stok
      </Link>
      <PageHead title="Stok masuk" description="Catat barang yang datang. Setiap baris menulis buku stok jenis masuk dan memicu Kabari aku bila stok online kembali ada." />
      <Suspense fallback={<Skeleton rows={2} />}>
        <Content />
      </Suspense>
    </>
  );
}
