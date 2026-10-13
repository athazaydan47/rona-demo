import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Denied, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Promo" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/promo");
  if (!can(me, "promo.kelola")) return <Denied />;
  return <AdminComingSoon title="Promo" points={["Slot flash sale dengan kuota", "Voucher dan banner beranda terjadwal"]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={1} />}>
      <Content />
    </Suspense>
  );
}
