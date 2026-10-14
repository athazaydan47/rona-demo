import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { StockLinesForm } from "@/components/admin/stock-forms";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { MAX_LINES, MAX_QTY, visibleLocations } from "@/lib/admin/stock";

export const metadata: Metadata = { title: "Transfer stok" };

type SP = { dari?: string; ke?: string; draf?: string };

// Draf dari saran transfer: "draf=varianId:jumlah,..." mengisi formulir. Tidak ada yang tersimpan sebelum staf menekan simpan.
function parseDraft(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((x) => x.split(":").map(Number))
    .filter(([v, q]) => Number.isInteger(v) && v > 0 && Number.isInteger(q) && q > 0 && q <= MAX_QTY)
    .slice(0, MAX_LINES)
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/stok/transfer");
  if (!can(me, "stok.transfer")) return <Denied />;
  const locations = (await visibleLocations(db, me)).filter((l) => can(me, "stok.transfer", { lokasiId: l.id }));
  if (locations.length < 2) return <Denied message="Transfer butuh minimal dua lokasi yang kamu ampu." />;
  const gudang = locations.find((l) => l.type === "gudang");
  const ok = (id: number) => locations.some((l) => l.id === id);
  const from = Number(sp.dari);
  const to = Number(sp.ke);
  const draft = parseDraft(sp.draf);
  const rows = draft.length
    ? await db
        .select({ variantId: schema.variants.id, productName: schema.products.name, shadeName: schema.variants.shadeName, sku: schema.variants.sku, hex: schema.variants.hex, brandName: schema.brands.name })
        .from(schema.variants)
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
        .where(inArray(schema.variants.id, draft.map((d) => d.variantId)))
    : [];
  const initialLines = draft.flatMap((d) => {
    const v = rows.find((r) => r.variantId === d.variantId);
    return v ? [{ variant: v, quantity: d.quantity }] : [];
  });
  return (
    <StockLinesForm
      mode="transfer"
      locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      defaultFrom={ok(from) ? from : (gudang?.id ?? locations[0].id)}
      defaultTo={ok(to) ? to : undefined}
      initialLines={initialLines}
      draftNote={initialLines.length ? "Draf dari saran transfer. Periksa lokasi dan jumlahnya, lalu simpan sendiri bila sudah sesuai." : undefined}
    />
  );
}

export default function TransferPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <Link href="/admin/stok" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Stok
      </Link>
      <PageHead title="Transfer antar lokasi" description="Satu transaksi: stok keluar dari asal dan masuk ke tujuan dengan referensi yang sama. Jumlah tidak boleh melebihi stok tersedia di asal." />
      <Suspense fallback={<Skeleton rows={2} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
