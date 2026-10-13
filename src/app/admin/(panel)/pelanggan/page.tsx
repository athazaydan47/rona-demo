import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Denied, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Pelanggan" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/pelanggan");
  if (!can(me, "pelanggan.lihat")) return <Denied />;
  return <AdminComingSoon title="Pelanggan" points={["Riwayat belanja, poin, profil kulit", "Segmen baru, setia, tidak aktif"]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={1} />}>
      <Content />
    </Suspense>
  );
}
