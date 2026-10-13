import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Denied, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Pengaturan" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/pengaturan");
  if (!can(me, "pengaturan.kelola")) return <Denied />;
  return <AdminComingSoon title="Pengaturan" points={["Profil toko, cabang dan jam buka, cut-off", "Kurir aktif, metode bayar, ambang stok menipis"]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={1} />}>
      <Content />
    </Suspense>
  );
}
