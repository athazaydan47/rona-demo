"use server";

// Aksi halaman akun. Setiap aksi mengambil pembeli dari sesi (currentCustomer), tidak pernah dari isian.
import { z } from "zod";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { productTags, updateCatalogNow } from "@/lib/cache-tags";
import { now } from "@/lib/clock";
import { revalidateProducts } from "@/lib/orders/revalidate";
import { confirmReceived } from "@/lib/orders/service";
import { photoKeyFromUrl } from "@/lib/reviews/storage";
import { createReview } from "@/lib/reviews/service";
import { siteUrl } from "@/lib/site";
import { createAddress, deleteAddress, setPrimaryAddress, updateAddress, type AddressInput } from "./addresses";
import { markAllRead, markRead } from "./notifications";
import { saveSkinProfile, sanitizeSkinProfile, updateProfile } from "./profile";
import { cancelRestock, requestRestockFor } from "./restock";
import { setWishlisted, wishlistIds } from "./wishlist";
import { scheduleEmailDispatch } from "@/lib/email/schedule";

const LOGIN_FIRST = { ok: false as const, message: "Sesi berakhir. Masuk lagi, ya.", needLogin: true };

const addressSchema = z.object({
  label: z.string().max(30),
  recipient: z.string().max(80),
  phone: z.string().max(20),
  provinceCode: z.string().max(4),
  regencyCode: z.string().max(10),
  districtCode: z.string().max(14).nullable().optional(),
  districtText: z.string().max(80).nullable().optional(),
  postalCode: z.string().max(5),
  street: z.string().max(300),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export type ActionResult = { ok: true; id?: number } | { ok: false; message: string; field?: string; needLogin?: boolean };

export async function saveAddressAction(id: number | null, raw: AddressInput): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data alamat belum lengkap." };
  return id == null ? createAddress(db, me.customerId, parsed.data) : Number.isInteger(id) ? updateAddress(db, me.customerId, id, parsed.data) : { ok: false, message: "Alamat tidak ditemukan." };
}

export async function deleteAddressAction(id: number): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  return Number.isInteger(id) && (await deleteAddress(db, me.customerId, id)) ? { ok: true } : { ok: false, message: "Alamat tidak ditemukan." };
}

export async function setPrimaryAddressAction(id: number): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  return Number.isInteger(id) && (await setPrimaryAddress(db, me.customerId, id)) ? { ok: true } : { ok: false, message: "Alamat tidak ditemukan." };
}

export async function updateProfileAction(input: { name: string; email: string }): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  return updateProfile(db, me.customerId, { name: String(input?.name ?? ""), email: String(input?.email ?? "") });
}

export async function saveSkinProfileAction(raw: Record<string, unknown>): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  if (!raw || typeof raw !== "object") return { ok: false, message: "Data tidak valid." };
  await saveSkinProfile(db, me.customerId, sanitizeSkinProfile(raw, "formulir", now()));
  return { ok: true };
}

export type WishlistState = { loggedIn: boolean; ids: number[] };

export async function wishlistStateAction(): Promise<WishlistState> {
  const me = await currentCustomer();
  if (!me) return { loggedIn: false, ids: [] };
  return { loggedIn: true, ids: await wishlistIds(db, me.customerId) };
}

export async function setWishlistAction(productId: number, on: boolean): Promise<{ ok: boolean; wished: boolean; message?: string; needLogin?: boolean }> {
  const me = await currentCustomer();
  if (!me) return { ok: false, wished: false, needLogin: true };
  if (!Number.isInteger(productId) || productId <= 0) return { ok: false, wished: false, message: "Produk tidak ditemukan." };
  return setWishlisted(db, me.customerId, productId, Boolean(on));
}

export async function markAllReadAction(): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  await markAllRead(db, me.customerId, now());
  return { ok: true };
}

export async function markReadAction(id: number): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  if (Number.isInteger(id)) await markRead(db, me.customerId, id, now());
  return { ok: true };
}

export async function requestRestockAction(variantId: number): Promise<{ ok: true; duplicate: boolean } | { ok: false; message: string; needLogin?: boolean }> {
  const me = await currentCustomer();
  if (!me) return { ok: false, message: "Masuk dulu supaya kami bisa mengabarimu.", needLogin: true };
  if (!Number.isInteger(variantId) || variantId <= 0) return { ok: false, message: "Varian tidak ditemukan." };
  return requestRestockFor(db, { customerId: me.customerId, phone: me.phone }, variantId);
}

export async function cancelRestockAction(id: number): Promise<ActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  return Number.isInteger(id) && (await cancelRestock(db, me.customerId, id)) ? { ok: true } : { ok: false, message: "Permintaan tidak ditemukan." };
}

export async function confirmReceivedAction(number: string): Promise<ActionResult> {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  if (typeof number !== "string" || number.length > 30) return { ok: false, message: "Pesanan tidak ditemukan." };
  const r = await confirmReceived(db, number.trim().toUpperCase(), me.customerId, { siteUrl: siteUrl() });
  if (!r.ok) return { ok: false, message: r.message };
  await revalidateProducts(r.productIds);
  return { ok: true };
}

const reviewSchema = z.object({
  orderItemId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1500),
  skinType: z.string().max(20).nullable().optional(),
  photos: z.array(z.string().max(300)).max(3).optional(),
});

export type ReviewActionResult = { ok: true; bonus: number; productSlug: string } | { ok: false; message: string; needLogin?: boolean };

export async function submitReviewAction(raw: z.input<typeof reviewSchema>): Promise<ReviewActionResult> {
  const me = await currentCustomer();
  if (!me) return LOGIN_FIRST;
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data ulasan belum lengkap." };
  // Foto hanya boleh hasil unggahan pembeli ini sendiri.
  const photos = parsed.data.photos ?? [];
  if (photos.some((u) => !photoKeyFromUrl(u, me.customerId))) return { ok: false, message: "Foto tidak valid. Unggah ulang, ya." };
  const r = await createReview(db, { customerId: me.customerId, orderItemId: parsed.data.orderItemId, rating: parsed.data.rating, body: parsed.data.body, skinType: parsed.data.skinType ?? null, photos, now: now() });
  if (!r.ok) return { ok: false, message: r.message };
  updateCatalogNow(productTags({ slug: r.productSlug }));
  return { ok: true, bonus: r.bonus, productSlug: r.productSlug };
}
