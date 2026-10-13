import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { RestockList } from "@/components/account/restock-list";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { listRestock } from "@/lib/account/restock";
import { formatDateTimeWib } from "@/lib/format";

export const metadata: Metadata = { title: "Kabari aku" };

async function Restock() {
  await connection();
  const me = await requireCustomer("/akun/kabari-aku");
  const rows = await listRestock(db, me.customerId);
  if (rows.length === 0) return <p className="rounded-card border border-dashed border-garis bg-putih p-6 text-sm text-abu-hangat">Belum ada. Tekan &quot;Kabari aku&quot; di shade yang sedang habis, nanti kami kabari lewat WhatsApp saat tersedia lagi.</p>;
  return <RestockList rows={rows.map((r) => ({ ...r, createdLabel: formatDateTimeWib(r.createdAt), notifiedLabel: r.notifiedAt ? formatDateTimeWib(r.notifiedAt) : null }))} />;
}

export default function KabariAkuPage() {
  return (
    <>
      <AccountPageHead title="Kabari aku" description="Produk yang sedang kamu tunggu stoknya." />
      <Suspense fallback={<AccountSkeleton />}>
        <Restock />
      </Suspense>
    </>
  );
}
