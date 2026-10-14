"use server";

// Server action Fase 6B: produk, kategori dan merek, promo, pengaturan. Identitas staf hanya dari sesi; izin diperiksa
// dengan can() di modul layanan. Setelah menyimpan, tag cache terkait direvalidasi lewat helper cache-tags.
import { z } from "zod";
import { db } from "@/db/client";
import { packagingValues } from "@/db/schema/enums";
import { cacheTags, updateCatalogNow } from "@/lib/cache-tags";
import { now } from "@/lib/clock";
import { env } from "@/lib/env";
import type { StoreSettings } from "@/lib/settings";
import { currentStaff } from "./current";
import { can } from "./permissions";
import { deleteProduct, duplicateProduct, saveProduct, setProductStatus, setVariantPromo, type ProductInput } from "./products";
import { createFlashSlot, deleteBanner, searchPromoVariants, moveBanner, removeFlashItem, saveBanner, saveFlashItem, savePromoBar, saveVoucher, setFlashSlotActive, setVoucherActive, type BannerForm, type VoucherForm } from "./promo";
import { saveLocation, saveSettings, type LocationForm } from "./settings";
import { storedMediaKey } from "@/lib/reviews/storage";
import { deleteBrand, deleteCategory, moveCategoryProducts, reorderCategories, saveBrand, saveCategory } from "./taxonomy";

const DENIED = { ok: false as const, message: "Sesi staf berakhir. Masuk lagi, ya." };
const date = (v: unknown) => (typeof v === "string" && v ? new Date(v) : v instanceof Date ? v : null);
const productTagList = (slugs: string[], brandSlugs: string[], categorySlugs: string[] = []) => [cacheTags.products(), cacheTags.brands(), cacheTags.categories(), ...slugs.map(cacheTags.product), ...brandSlugs.map(cacheTags.brand), ...categorySlugs.map(cacheTags.category)];

const variantSchema = z.object({
  id: z.number().int().nullable().optional(),
  shadeName: z.string().max(80),
  hex: z.string().max(9),
  undertone: z.enum(["warm", "neutral", "cool"]).nullable().optional(),
  depth: z.number().int().nullable().optional(),
  sku: z.string().max(60),
  barcode: z.string().max(40).optional(),
  weightGram: z.number().int(),
  normalPrice: z.number().int(),
  salePrice: z.number().int(),
  isActive: z.boolean(),
});
const productSchema = z.object({
  name: z.string().max(140),
  slug: z.string().max(140).optional(),
  brandId: z.number().int(),
  categoryId: z.number().int(),
  packaging: z.enum(packagingValues),
  shortDescription: z.string().max(400).optional(),
  benefits: z.string().max(5000).optional(),
  ingredients: z.string().max(5000).optional(),
  howToUse: z.string().max(5000).optional(),
  activeIngredients: z.array(z.string().max(60)).max(20).optional(),
  skinTypes: z.array(z.string().max(20)).max(10).optional(),
  skinConcerns: z.array(z.string().max(20)).max(10).optional(),
  finish: z.enum(["matte", "satin", "glowy"]).nullable().optional(),
  spf: z.number().int().nullable().optional(),
  bpom: z.string().max(40).optional(),
  netto: z.string().max(40).optional(),
  imageUrl: z.string().max(400).nullable().optional(),
  seoTitle: z.string().max(120).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
  status: z.enum(["aktif", "draf", "arsip"]),
  variants: z.array(variantSchema).max(30),
});

export async function saveProductAction(id: number | null, raw: z.input<typeof productSchema>) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Data produk tidak valid." };
  if (parsed.data.imageUrl && !storedMediaKey(parsed.data.imageUrl, "produk")) return { ok: false as const, message: "Foto produk tidak valid. Unggah ulang, ya." };
  const r = await saveProduct(db, me, parsed.data as ProductInput, id, { now: now() });
  if (r.ok) updateCatalogNow(productTagList(r.tags.slugs, r.tags.brandSlugs, r.tags.categorySlugs));
  return r;
}

export async function setProductStatusAction(id: number, status: "aktif" | "draf" | "arsip") {
  const me = await currentStaff();
  if (!me) return DENIED;
  if (!["aktif", "draf", "arsip"].includes(status)) return { ok: false as const, message: "Status tidak valid." };
  const r = await setProductStatus(db, me, Number(id), status, { now: now() });
  if (r.ok) updateCatalogNow(productTagList([r.slug], []));
  return r;
}

export async function deleteProductAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await deleteProduct(db, me, Number(id), { now: now() });
  if (r.ok) updateCatalogNow(productTagList([r.slug], []));
  return r;
}

export async function duplicateProductAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await duplicateProduct(db, me, Number(id), { now: now() });
  if (r.ok) updateCatalogNow(productTagList(r.tags.slugs, r.tags.brandSlugs));
  return r;
}

export async function searchVariantsForPromoAction(q: string) {
  const me = await currentStaff();
  if (!me || !can(me, "promo.kelola")) return [];
  return searchPromoVariants(db, String(q ?? ""));
}

// ---------- Kategori dan merek ----------

export async function saveCategoryAction(input: { id?: number | null; name: string; parentId: number | null; description?: string; force?: boolean }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await saveCategory(db, me, { ...input, parentId: input.parentId == null ? null : Number(input.parentId) }, { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function reorderCategoriesAction(layout: { id: number; parentId: number | null; sortOrder: number }[]) {
  const me = await currentStaff();
  if (!me) return DENIED;
  if (!Array.isArray(layout) || layout.length > 200) return { ok: false as const, message: "Susunan tidak valid." };
  const r = await reorderCategories(db, me, layout.map((l) => ({ id: Number(l.id), parentId: l.parentId == null ? null : Number(l.parentId), sortOrder: Number(l.sortOrder) })), { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function moveCategoryProductsAction(fromId: number, toId: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await moveCategoryProducts(db, me, Number(fromId), Number(toId), { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function deleteCategoryAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await deleteCategory(db, me, Number(id), { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function saveBrandAction(input: { id?: number | null; name: string; slug?: string; color: string; tagline?: string; description?: string; force?: boolean }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await saveBrand(db, me, input, { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function deleteBrandAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await deleteBrand(db, me, Number(id), { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

// ---------- Promo ----------

export async function createFlashSlotAction(input: { name: string; startsAt: string; endsAt: string }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await createFlashSlot(db, me, { name: input.name, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }, { now: now() });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function saveFlashItemAction(input: { slotId: number; variantId: number; flashPrice: number; quota: number; maxPerCustomer: number; confirmRunning?: boolean }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await saveFlashItem(db, me, { slotId: Number(input.slotId), variantId: Number(input.variantId), flashPrice: Number(input.flashPrice), quota: Number(input.quota), maxPerCustomer: Number(input.maxPerCustomer), confirmRunning: Boolean(input.confirmRunning) }, { now: now() });
  if (r.ok) updateCatalogNow(r.tags.filter(Boolean));
  return r;
}

export async function removeFlashItemAction(itemId: number, confirmRunning = false) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await removeFlashItem(db, me, Number(itemId), { now: now(), confirmRunning });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function setFlashSlotActiveAction(slotId: number, active: boolean, confirmRunning = false) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await setFlashSlotActive(db, me, Number(slotId), Boolean(active), { now: now(), confirmRunning });
  if (r.ok) updateCatalogNow(r.tags);
  return r;
}

export async function setVariantPromoAction(input: { variantId: number; promoPrice: number | null; startsAt: string | null; endsAt: string | null }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await setVariantPromo(db, me, { variantId: Number(input.variantId), promoPrice: input.promoPrice == null ? null : Number(input.promoPrice), startsAt: date(input.startsAt), endsAt: date(input.endsAt) }, { now: now() });
  if (r.ok) updateCatalogNow([cacheTags.products(), cacheTags.product(r.slug)]);
  return r;
}

export async function saveVoucherAction(id: number | null, input: Omit<VoucherForm, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  return saveVoucher(db, me, { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }, id, { now: now() });
}

export async function setVoucherActiveAction(id: number, active: boolean) {
  const me = await currentStaff();
  if (!me) return DENIED;
  return setVoucherActive(db, me, Number(id), Boolean(active), { now: now() });
}

export async function saveBannerAction(id: number | null, input: Omit<BannerForm, "startsAt" | "endsAt"> & { startsAt: string | null; endsAt: string | null }) {
  const me = await currentStaff();
  if (!me) return DENIED;
  if (input.imageUrl && !storedMediaKey(input.imageUrl, "banner")) return { ok: false as const, message: "Gambar banner tidak valid. Unggah ulang, ya." };
  const r = await saveBanner(db, me, { ...input, startsAt: date(input.startsAt), endsAt: date(input.endsAt) }, id, { now: now() });
  if (r.ok) updateCatalogNow([cacheTags.banners()]);
  return r;
}

export async function moveBannerAction(id: number, dir: -1 | 1) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await moveBanner(db, me, Number(id), dir === -1 ? -1 : 1);
  if (r.ok) updateCatalogNow([cacheTags.banners()]);
  return r;
}

export async function deleteBannerAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await deleteBanner(db, me, Number(id), { now: now() });
  if (r.ok) updateCatalogNow([cacheTags.banners()]);
  return r;
}

export async function savePromoBarAction(messages: string[]) {
  const me = await currentStaff();
  if (!me) return DENIED;
  if (!Array.isArray(messages)) return { ok: false as const, message: "Data tidak valid." };
  const r = await savePromoBar(db, me, messages, { now: now() });
  if (r.ok) updateCatalogNow([cacheTags.settings()]);
  return r;
}

// ---------- Pengaturan ----------

export async function saveSettingsAction(input: StoreSettings) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await saveSettings(db, me, input, { now: now() });
  if (r.ok) updateCatalogNow([cacheTags.settings()]);
  return { ...r, demoMode: env.demoMode };
}

export async function saveLocationAction(id: number, input: LocationForm) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await saveLocation(db, me, Number(id), input, { now: now() });
  if (r.ok) updateCatalogNow([cacheTags.locations()]);
  return r;
}
