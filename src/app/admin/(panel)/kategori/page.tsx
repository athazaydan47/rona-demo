import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Denied, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Kategori dan Merek" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/kategori");
  if (!can(me, "kategori.kelola")) return <Denied />;
  return <AdminComingSoon title="Kategori dan Merek" points={["Pohon kategori seret-lepas", "Peringatan nama mirip supaya tidak dobel"]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={1} />}>
      <Content />
    </Suspense>
  );
}
