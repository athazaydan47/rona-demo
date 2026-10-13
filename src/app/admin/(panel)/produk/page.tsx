import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Denied, Skeleton } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Produk" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/produk");
  if (!can(me, "produk.kelola")) return <Denied />;
  return <AdminComingSoon title="Produk" points={["Tambah dan ubah produk serta varian shade dengan pemilih warna", "Deskripsi per tab, bahan aktif, cocok untuk kulit, SEO", "Status aktif atau draf"]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={1} />}>
      <Content />
    </Suspense>
  );
}
