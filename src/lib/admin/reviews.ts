// Moderasi ulasan di panel admin: sembunyikan (wajib alasan) dan tampilkan, balas sebagai toko, hapus balasan.
// Rating produk dihitung ulang setiap kali status berubah; setiap aksi tercatat di log aktivitas.
import { and, count, desc, eq, gte, ilike, inArray, isNull, lt, lte, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { recomputeProductRating } from "@/lib/reviews/service";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";

const DENIED = { ok: false as const, message: "Kamu tidak punya izin memoderasi ulasan." };
export const HIDE_REASON_MIN = 5;
export const REPLY_MIN = 5;
export const REPLY_MAX = 1000;
export const REVIEW_PAGE_SIZE = 20;

export type ReviewFilters = { rating?: number | null; status?: "tampil" | "sembunyi" | null; unreplied?: boolean; photo?: boolean; product?: string | null; from?: Date | null; to?: Date | null; page?: number };

// Validasi murni.
export function validateHideReason(reason: string) {
  return (reason ?? "").trim().length >= HIDE_REASON_MIN ? null : `Tulis alasan menyembunyikan, minimal ${HIDE_REASON_MIN} karakter.`;
}
export function validateReply(text: string) {
  const t = (text ?? "").trim();
  if (t.length < REPLY_MIN) return `Balasan minimal ${REPLY_MIN} karakter.`;
  if (t.length > REPLY_MAX) return `Balasan maksimal ${REPLY_MAX} karakter.`;
  return null;
}

export async function listAdminReviews(db: AnyDb, f: ReviewFilters) {
  const conds: (SQL | undefined)[] = [
    f.rating ? eq(schema.reviews.rating, f.rating) : undefined,
    f.status ? eq(schema.reviews.status, f.status) : undefined,
    f.unreplied ? isNull(schema.reviews.storeReply) : undefined,
    f.photo ? sql`cardinality(${schema.reviews.photos}) > 0` : undefined,
    f.product?.trim() ? ilike(schema.products.name, `%${f.product.trim().replace(/[%_]/g, "")}%`) : undefined,
    f.from ? gte(schema.reviews.createdAt, f.from) : undefined,
    f.to ? lt(schema.reviews.createdAt, f.to) : undefined,
  ];
  const where = and(...conds);
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: schema.reviews.id,
        productId: schema.reviews.productId,
        productName: schema.products.name,
        productSlug: schema.products.slug,
        shadeName: schema.variants.shadeName,
        hex: schema.variants.hex,
        customerId: schema.reviews.customerId,
        authorName: schema.reviews.authorName,
        rating: schema.reviews.rating,
        body: schema.reviews.body,
        photos: schema.reviews.photos,
        skinType: schema.reviews.skinType,
        status: schema.reviews.status,
        storeReply: schema.reviews.storeReply,
        repliedAt: schema.reviews.repliedAt,
        hiddenReason: schema.reviews.hiddenReason,
        hiddenAt: schema.reviews.hiddenAt,
        createdAt: schema.reviews.createdAt,
        verified: sql<boolean>`${schema.reviews.orderItemId} is not null`,
      })
      .from(schema.reviews)
      .innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
      .leftJoin(schema.variants, eq(schema.reviews.variantId, schema.variants.id))
      .where(where)
      .orderBy(desc(schema.reviews.createdAt), desc(schema.reviews.id))
      .limit(REVIEW_PAGE_SIZE)
      .offset((page - 1) * REVIEW_PAGE_SIZE),
    db.select({ n: count() }).from(schema.reviews).innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id)).where(where),
  ]);
  return { rows, total: Number(n), page, pageCount: Math.max(1, Math.ceil(Number(n) / REVIEW_PAGE_SIZE)) };
}

export type ModerationResult = { ok: true; slugs: string[]; changed: number } | { ok: false; message: string };

async function slugsOf(db: AnyDb, productIds: number[]) {
  if (!productIds.length) return [];
  return (await db.select({ slug: schema.products.slug }).from(schema.products).where(inArray(schema.products.id, productIds))).map((p) => p.slug);
}

// Sembunyikan satu atau beberapa ulasan sekaligus. Rating produk terdampak dihitung ulang.
export async function hideReviews(db: AnyDb, staff: StaffPrincipal, ids: number[], reason: string, opts: { now?: Date } = {}): Promise<ModerationResult> {
  if (!can(staff, "ulasan.kelola")) return DENIED;
  const err = validateHideReason(reason);
  if (err) return { ok: false, message: err };
  const unique = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, 100);
  if (!unique.length) return { ok: false, message: "Pilih ulasan dulu." };
  const at = opts.now ?? new Date();
  const text = reason.trim().slice(0, 300);
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: schema.reviews.id, productId: schema.reviews.productId, status: schema.reviews.status, rating: schema.reviews.rating, authorName: schema.reviews.authorName }).from(schema.reviews).where(and(inArray(schema.reviews.id, unique), eq(schema.reviews.status, "tampil")));
    if (!rows.length) return { ok: true as const, slugs: [], changed: 0 };
    await tx.update(schema.reviews).set({ status: "sembunyi", hiddenReason: text, hiddenAt: at }).where(inArray(schema.reviews.id, rows.map((r) => r.id)));
    const productIds = [...new Set(rows.map((r) => r.productId))];
    for (const pid of productIds) await recomputeProductRating(tx, pid);
    for (const r of rows) await writeAudit(tx, { staff, action: "ulasan.sembunyi", objectType: "ulasan", objectId: r.id, summary: `Sembunyikan ulasan ${r.rating} bintang dari ${r.authorName}: ${text}`, before: { status: "tampil" }, after: { status: "sembunyi", alasan: text }, at });
    return { ok: true as const, slugs: await slugsOf(tx, productIds), changed: rows.length };
  });
}

export async function showReview(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}): Promise<ModerationResult> {
  if (!can(staff, "ulasan.kelola")) return DENIED;
  const at = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
    if (!r) return { ok: false as const, message: "Ulasan tidak ditemukan." };
    if (r.status === "tampil") return { ok: true as const, slugs: [], changed: 0 };
    await tx.update(schema.reviews).set({ status: "tampil", hiddenReason: null, hiddenAt: null }).where(eq(schema.reviews.id, id));
    await recomputeProductRating(tx, r.productId);
    await writeAudit(tx, { staff, action: "ulasan.tampil", objectType: "ulasan", objectId: id, summary: `Tampilkan lagi ulasan dari ${r.authorName}`, before: { status: r.status, alasan: r.hiddenReason }, after: { status: "tampil" }, at });
    return { ok: true as const, slugs: await slugsOf(tx, [r.productId]), changed: 1 };
  });
}

// Balas sebagai toko (atau ubah balasan). Balasan pertama memberi tahu pembeli lewat outbox notifikasi.
// opts.aiAssisted: draf dibuat AI lalu disunting staf. Hanya dicatat di log aktivitas, tidak pernah tampil publik.
export async function replyReview(db: AnyDb, staff: StaffPrincipal, id: number, text: string, opts: { now?: Date; aiAssisted?: boolean } = {}): Promise<ModerationResult & { notified?: number }> {
  if (!can(staff, "ulasan.kelola")) return DENIED;
  const err = validateReply(text);
  if (err) return { ok: false, message: err };
  const reply = text.trim();
  const at = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [r] = await tx
      .select({ id: schema.reviews.id, productId: schema.reviews.productId, customerId: schema.reviews.customerId, storeReply: schema.reviews.storeReply, authorName: schema.reviews.authorName, productName: schema.products.name, productSlug: schema.products.slug })
      .from(schema.reviews)
      .innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
      .where(eq(schema.reviews.id, id))
      .limit(1);
    if (!r) return { ok: false as const, message: "Ulasan tidak ditemukan." };
    const first = r.storeReply == null;
    await tx.update(schema.reviews).set({ storeReply: reply, repliedAt: at }).where(eq(schema.reviews.id, id));
    await writeAudit(tx, { staff, action: "ulasan.balas", objectType: "ulasan", objectId: id, summary: `${first ? "Balas" : "Ubah balasan"} ulasan ${r.authorName} untuk ${r.productName}`, before: first ? undefined : { balasan: r.storeReply }, after: { balasan: reply, ...(opts.aiAssisted ? { dibantuAi: true } : {}) }, at });
    let notified = 0;
    if (first && r.customerId != null) {
      const [c] = await tx.select({ name: schema.customers.name, phone: schema.customers.phone, email: schema.customers.email }).from(schema.customers).where(eq(schema.customers.id, r.customerId)).limit(1);
      if (c) {
        const subject = `Ulasanmu untuk ${r.productName} dibalas`;
        const body = `Halo ${c.name.split(" ")[0]}, Rona Beauty membalas ulasanmu untuk ${r.productName}: "${reply.length > 160 ? `${reply.slice(0, 157)}...` : reply}" Lihat di /p/${r.productSlug}#ulasan`;
        const rows: (typeof schema.notifications.$inferInsert)[] = [{ customerId: r.customerId, kind: "ulasan_dibalas", channel: "wa", recipient: c.phone, subject, body, status: "antre", createdAt: at }];
        if (c.email) rows.push({ customerId: r.customerId, kind: "ulasan_dibalas", channel: "email", recipient: c.email, subject, body, status: "antre", createdAt: at });
        await tx.insert(schema.notifications).values(rows);
        notified = rows.length;
      }
    }
    return { ok: true as const, slugs: [r.productSlug], changed: 1, notified };
  });
}

export async function deleteReply(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}): Promise<ModerationResult> {
  if (!can(staff, "ulasan.kelola")) return DENIED;
  const at = opts.now ?? new Date();
  const [r] = await db.select({ storeReply: schema.reviews.storeReply, authorName: schema.reviews.authorName, productId: schema.reviews.productId }).from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
  if (!r) return { ok: false, message: "Ulasan tidak ditemukan." };
  if (r.storeReply == null) return { ok: true, slugs: [], changed: 0 };
  await db.update(schema.reviews).set({ storeReply: null, repliedAt: null }).where(eq(schema.reviews.id, id));
  await writeAudit(db, { staff, action: "ulasan.hapus_balasan", objectType: "ulasan", objectId: id, summary: `Hapus balasan untuk ulasan ${r.authorName}`, before: { balasan: r.storeReply }, at });
  return { ok: true, slugs: await slugsOf(db, [r.productId]), changed: 1 };
}

// Ulasan bintang 1 atau 2 yang tayang dan belum dibalas, untuk "Perlu tindakan" di dashboard.
export async function lowRatingUnreplied(db: AnyDb, limit = 10) {
  return db
    .select({ id: schema.reviews.id, rating: schema.reviews.rating, authorName: schema.reviews.authorName, productName: schema.products.name, createdAt: schema.reviews.createdAt })
    .from(schema.reviews)
    .innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
    .where(and(lte(schema.reviews.rating, 2), eq(schema.reviews.status, "tampil"), isNull(schema.reviews.storeReply)))
    .orderBy(desc(schema.reviews.createdAt))
    .limit(limit);
}
