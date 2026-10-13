// Ulasan pembeli: hanya untuk item pesanan Selesai milik sendiri, satu ulasan per item (per varian dalam pesanan).
// Ulasan langsung tayang, ulasan pertama memberi bonus 50 poin sekali, dan rating produk dihitung ulang.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";
import { FIRST_REVIEW_BONUS, movePoints, pointKeys } from "@/lib/points";

export const REVIEW_MIN_LENGTH = 20;
export const REVIEW_MAX_LENGTH = 1500;
export const REVIEW_MAX_PHOTOS = 3;
export const REVIEW_SKIN_TYPES = ["normal", "kering", "berminyak", "kombinasi", "sensitif"] as const;

export type ReviewableItem = {
  orderItemId: number; // baris pertama varian ini di pesanan, dipakai sebagai kunci ulasan
  orderNumber: string;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  shadeName: string;
  showShade: boolean;
  brandName: string;
  brandColor: string;
  packaging: Packaging;
  hex: string;
  reviewId: number | null;
};

// Nama tampil di ulasan: nama depan dan inisial nama belakang, misal "Nadia P.".
export function reviewerDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Pembeli Rona";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Item yang bisa (atau sudah) diulas dari satu pesanan Selesai milik pembeli. Kosong bila bukan miliknya.
export async function reviewableItems(db: AnyDb, customerId: number, orderNumber: string): Promise<ReviewableItem[]> {
  const [order] = await db
    .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status })
    .from(schema.orders)
    .where(and(eq(schema.orders.number, orderNumber), eq(schema.orders.customerId, customerId)))
    .limit(1);
  if (!order || order.status !== "selesai") return [];
  const rows = await db
    .select({
      orderItemId: schema.orderItems.id,
      variantId: schema.orderItems.variantId,
      productId: schema.products.id,
      productName: schema.orderItems.productName,
      productSlug: schema.products.slug,
      shadeName: schema.orderItems.shadeName,
      brandName: schema.orderItems.brandName,
      brandColor: schema.brands.color,
      packaging: schema.products.packaging,
      hex: schema.variants.hex,
      reviewId: schema.reviews.id,
    })
    .from(schema.orderItems)
    .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .leftJoin(schema.reviews, eq(schema.reviews.orderItemId, schema.orderItems.id))
    .where(eq(schema.orderItems.orderId, order.id))
    .orderBy(asc(schema.orderItems.id));
  const byVariant = new Map<number, ReviewableItem>();
  for (const r of rows) {
    const prev = byVariant.get(r.variantId);
    if (prev) {
      prev.reviewId ??= r.reviewId;
      continue;
    }
    byVariant.set(r.variantId, { ...r, orderNumber: order.number, showShade: !/^\d+\s?(ml|g)$/i.test(r.shadeName) });
  }
  return [...byVariant.values()];
}

export type CreateReviewInput = { customerId: number; orderItemId: number; rating: number; body: string; skinType?: string | null; photos?: string[]; now: Date };
export type CreateReviewResult =
  | { ok: true; reviewId: number; productId: number; productSlug: string; bonus: number }
  | { ok: false; code: "tidak_ditemukan" | "belum_selesai" | "sudah_diulas" | "tidak_valid"; message: string };

export function validateReview(input: { rating: number; body: string; skinType?: string | null; photos?: string[] }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return "Pilih 1 sampai 5 bintang.";
  const body = (input.body ?? "").trim();
  if (body.length < REVIEW_MIN_LENGTH) return `Ceritakan sedikit lagi, minimal ${REVIEW_MIN_LENGTH} karakter.`;
  if (body.length > REVIEW_MAX_LENGTH) return `Ulasan maksimal ${REVIEW_MAX_LENGTH} karakter.`;
  if (input.skinType && !(REVIEW_SKIN_TYPES as readonly string[]).includes(input.skinType)) return "Jenis kulit tidak valid.";
  if ((input.photos?.length ?? 0) > REVIEW_MAX_PHOTOS) return `Maksimal ${REVIEW_MAX_PHOTOS} foto.`;
  return null;
}

// Rata-rata dan jumlah ulasan tayang dihitung ulang dari tabel reviews (dibulatkan 1 desimal, sama dengan seed).
export async function recomputeProductRating(tx: AnyDb, productId: number) {
  const [agg] = await tx
    .select({ avg: sql<number>`coalesce(avg(${schema.reviews.rating}), 0)::float`, n: sql<number>`count(*)::int` })
    .from(schema.reviews)
    .where(and(eq(schema.reviews.productId, productId), eq(schema.reviews.status, "tampil")));
  const ratingAvg = Math.round(Number(agg.avg) * 10) / 10;
  const reviewCount = Number(agg.n);
  await tx.update(schema.products).set({ ratingAvg, reviewCount }).where(eq(schema.products.id, productId));
  return { ratingAvg, reviewCount };
}

export async function createReview(db: AnyDb, input: CreateReviewInput): Promise<CreateReviewResult> {
  const invalid = validateReview(input);
  if (invalid) return { ok: false, code: "tidak_valid", message: invalid };
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({ orderId: schema.orderItems.orderId, variantId: schema.orderItems.variantId, customerId: schema.orders.customerId, status: schema.orders.status, productId: schema.variants.productId, productSlug: schema.products.slug })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .where(eq(schema.orderItems.id, input.orderItemId))
      .limit(1);
    // Item milik orang lain dijawab sama dengan item yang tidak ada.
    if (!item || item.customerId !== input.customerId) return { ok: false as const, code: "tidak_ditemukan" as const, message: "Item pesanan tidak ditemukan." };
    if (item.status !== "selesai") return { ok: false as const, code: "belum_selesai" as const, message: "Ulasan bisa ditulis setelah pesanan selesai." };
    // Kunci ulasan: baris pertama varian ini di pesanan (flash sale bisa memecah satu varian jadi dua baris).
    const siblings = await tx
      .select({ id: schema.orderItems.id })
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.orderId, item.orderId), eq(schema.orderItems.variantId, item.variantId)))
      .orderBy(asc(schema.orderItems.id));
    const canonicalId = siblings[0].id;
    const [existing] = await tx.select({ id: schema.reviews.id }).from(schema.reviews).where(inArray(schema.reviews.orderItemId, siblings.map((s) => s.id))).limit(1);
    if (existing) return { ok: false as const, code: "sudah_diulas" as const, message: "Item ini sudah kamu ulas. Terima kasih!" };
    const [customer] = await tx.select({ name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.id, input.customerId));
    const inserted = await tx
      .insert(schema.reviews)
      .values({
        orderItemId: canonicalId,
        productId: item.productId,
        variantId: item.variantId,
        customerId: input.customerId,
        authorName: reviewerDisplayName(customer?.name ?? ""),
        rating: input.rating,
        body: input.body.trim(),
        photos: input.photos ?? [],
        skinType: input.skinType || null,
        isVerified: true,
        status: "tampil",
        createdAt: input.now,
      })
      .onConflictDoNothing({ target: schema.reviews.orderItemId })
      .returning({ id: schema.reviews.id });
    if (!inserted[0]) return { ok: false as const, code: "sudah_diulas" as const, message: "Item ini sudah kamu ulas. Terima kasih!" };
    const bonus = await movePoints(tx, {
      customerId: input.customerId,
      amount: FIRST_REVIEW_BONUS,
      reason: "Bonus ulasan pertama",
      reference: `ulasan:${inserted[0].id}`,
      key: pointKeys.firstReview(input.customerId),
      at: input.now,
    });
    await recomputeProductRating(tx, item.productId);
    return { ok: true as const, reviewId: inserted[0].id, productId: item.productId, productSlug: item.productSlug, bonus: bonus.applied };
  });
}

export async function listCustomerReviews(db: AnyDb, customerId: number) {
  return db
    .select({ id: schema.reviews.id, rating: schema.reviews.rating, body: schema.reviews.body, createdAt: schema.reviews.createdAt, productName: schema.products.name, productSlug: schema.products.slug })
    .from(schema.reviews)
    .innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
    .where(eq(schema.reviews.customerId, customerId))
    .orderBy(sql`${schema.reviews.createdAt} desc`)
    .limit(50);
}
