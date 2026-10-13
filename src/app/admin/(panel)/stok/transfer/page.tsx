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

export const metadata: Metadata = { title: "Transfer stok" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/stok/transfer");
  if (!can(me, "stok.transfer")) return <Denied />;
  const locations = (await visibleLocations(db, me)).filter((l) => can(me, "stok.transfer", { lokasiId: l.id }));
  if (locations.length < 2) return <Denied message="Transfer butuh minimal dua lokasi yang kamu ampu." />;
  const gudang = locations.find((l) => l.type === "gudang");
  return <StockLinesForm mode="transfer" locations={locations.map((l) => ({ id: l.id, name: l.name }))} defaultFrom={gudang?.id ?? locations[0].id} />;
}

export default function TransferPage() {
  return (
    <>
      <Link href="/admin/stok" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Stok
      </Link>
      <PageHead title="Transfer antar lokasi" description="Satu transaksi: stok keluar dari asal dan masuk ke tujuan dengan referensi yang sama. Jumlah tidak boleh melebihi stok tersedia di asal." />
      <Suspense fallback={<Skeleton rows={2} />}>
        <Content />
      </Suspense>
    </>
  );
}
