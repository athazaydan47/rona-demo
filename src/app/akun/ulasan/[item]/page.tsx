import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { ReviewForm, ReviewThanks } from "@/components/account/review-form";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { getProfile } from "@/lib/account/profile";
import { reviewableItems } from "@/lib/reviews/service";
import { storageKind } from "@/lib/reviews/storage";

export const metadata: Metadata = { title: "Tulis ulasan" };

type Props = { params: Promise<{ item: string }> };

async function ReviewContent({ params }: Props) {
  await connection();
  const { item } = await params;
  const me = await requireCustomer(`/akun/ulasan/${item}`);
  const id = Number.parseInt(item, 10);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [row] = await db
    .select({ orderNumber: schema.orders.number, status: schema.orders.status, customerId: schema.orders.customerId, variantId: schema.orderItems.variantId })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(eq(schema.orderItems.id, id))
    .limit(1);
  // Item milik pembeli lain dijawab sama dengan item yang tidak ada.
  if (!row || row.customerId !== me.customerId) notFound();
  if (row.status !== "selesai") {
    return (
      <div className="rounded-card border border-garis bg-putih p-6">
        <p className="text-kopi">Ulasan bisa ditulis setelah pesanan {row.orderNumber} selesai.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/pesanan/${row.orderNumber}`}>Lihat pesanan</Link>
        </Button>
      </div>
    );
  }
  const [items, profile] = await Promise.all([reviewableItems(db, me.customerId, row.orderNumber), getProfile(db, me.customerId)]);
  const target = items.find((i) => i.variantId === row.variantId);
  if (!target) notFound();
  if (target.reviewId) {
    // Setelah dikirim, aksi server memperbarui halaman ini: tampilkan terima kasih dan bonus dari ledger.
    const [bonus] = await db
      .select({ amount: schema.pointsLedger.amount })
      .from(schema.pointsLedger)
      .where(and(eq(schema.pointsLedger.customerId, me.customerId), eq(schema.pointsLedger.reference, `ulasan:${target.reviewId}`)))
      .limit(1);
    return <ReviewThanks productName={target.productName} productSlug={target.productSlug} orderNumber={target.orderNumber} bonus={bonus?.amount ?? 0} />;
  }
  return (
    <ReviewForm
      item={{ orderItemId: target.orderItemId, orderNumber: target.orderNumber, productName: target.productName, productSlug: target.productSlug, shadeName: target.shadeName, showShade: target.showShade, packaging: target.packaging, hex: target.hex, brandName: target.brandName, brandColor: target.brandColor }}
      defaultSkin={profile?.skinProfile?.skinType ?? null}
      photosEnabled={storageKind() !== "nonaktif"}
    />
  );
}

export default function TulisUlasanPage(props: Props) {
  return (
    <div className="max-w-2xl">
      <AccountPageHead title="Tulis ulasan" description="Ulasanmu langsung tayang dengan label Pembeli terverifikasi." />
      <Suspense fallback={<AccountSkeleton />}>
        <ReviewContent {...props} />
      </Suspense>
    </div>
  );
}
