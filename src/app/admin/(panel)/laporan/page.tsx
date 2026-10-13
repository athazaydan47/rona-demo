import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Denied, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Laporan" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/laporan");
  if (!can(me, "laporan.lihat")) return <Denied />;
  return <AdminComingSoon title="Laporan" points={["Penjualan per hari, merek, kategori, cabang, kanal", "Unduh Excel multi-sheet"]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={1} />}>
      <Content />
    </Suspense>
  );
}
