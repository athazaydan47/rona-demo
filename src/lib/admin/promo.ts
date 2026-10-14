// Promo di panel admin: slot flash sale (slot admin selalu menang atas slot otomatis), voucher, banner, PromoBar.
import { and, asc, count, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import { effectivePrice } from "@/lib/pricing";
import { SETTING_KEYS } from "@/lib/settings";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";
import { autoSlotsToDisable, checkFlashItem, validateBanner, validateVoucher, type BannerForm, type VoucherForm } from "./promo-rules";

export { FLASH_PRESETS, checkFlashItem, autoSlotsToDisable, validateVoucher, validateBanner, type FlashItemCheck, type VoucherForm, type BannerForm } from "./promo-rules";

const DAY = 86_400_000;
const DENIED = { ok: false as const, message: "Kamu tidak punya izin mengelola promo." };

// ---------- Flash sale ----------

export async function flashCalendar(db: AnyDb, weekStart: Date) {
  const end = new Date(weekStart.getTime() + 7 * DAY);
  const slots = await db.select().from(schema.flashSales).where(and(lt(schema.flashSales.startsAt, end), gt(schema.flashSales.endsAt, weekStart))).orderBy(asc(schema.flashSales.startsAt), desc(schema.flashSales.source));
  const ids = slots.map((s) => s.id);
  const items = ids.length
    ? await db
        .select({ id: schema.flashSaleItems.id, flashSaleId: schema.flashSaleItems.flashSaleId, variantId: schema.flashSaleItems.variantId, flashPrice: schema.flashSaleItems.flashPrice, quota: schema.flashSaleItems.quota, sold: schema.flashSaleItems.sold, maxPerCustomer: schema.flashSaleItems.maxPerCustomer, productName: schema.products.name, shadeName: schema.variants.shadeName, sku: schema.variants.sku, hex: schema.variants.hex, normalPrice: schema.variants.normalPrice, salePrice: schema.variants.salePrice })
        .from(schema.flashSaleItems)
        .innerJoin(schema.variants, eq(schema.flashSaleItems.variantId, schema.variants.id))
        .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
        .where(inArray(schema.flashSaleItems.flashSaleId, ids))
        .orderBy(asc(schema.flashSaleItems.id))
    : [];
  return slots.map((s) => ({ ...s, items: items.filter((i) => i.flashSaleId === s.id) }));
}

export type PromoResult = { ok: true; id?: number; tags: string[]; warnings?: string[] } | { ok: false; message: string; needsConfirm?: boolean; warnings?: string[] };

export async function createFlashSlot(db: AnyDb, staff: StaffPrincipal, input: { name: string; startsAt: Date; endsAt: Date }, opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const name = (input.name ?? "").trim().slice(0, 60) || "Flash Sale";
  if (!(input.startsAt instanceof Date) || !(input.endsAt instanceof Date) || Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) return { ok: false, message: "Isi tanggal dan jam slot." };
  if (input.endsAt.getTime() <= input.startsAt.getTime()) return { ok: false, message: "Jam selesai harus setelah jam mulai." };
  if (input.endsAt.getTime() - input.startsAt.getTime() > 12 * 3_600_000) return { ok: false, message: "Satu slot maksimal 12 jam." };
  const at = opts.now ?? new Date();
  if (input.endsAt.getTime() <= at.getTime()) return { ok: false, message: "Slot sudah lewat. Pilih waktu yang akan datang." };
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: schema.flashSales.id, source: schema.flashSales.source, isActive: schema.flashSales.isActive, startsAt: schema.flashSales.startsAt, endsAt: schema.flashSales.endsAt, name: schema.flashSales.name }).from(schema.flashSales).where(and(lt(schema.flashSales.startsAt, input.endsAt), gt(schema.flashSales.endsAt, input.startsAt)));
    const clash = existing.find((e) => e.source === "admin" && e.isActive);
    if (clash) return { ok: false as const, message: `Bertabrakan dengan slot admin "${clash.name}". Ubah jamnya atau nonaktifkan slot itu dulu.` };
    const [row] = await tx.insert(schema.flashSales).values({ name, startsAt: input.startsAt, endsAt: input.endsAt, isActive: true, source: "admin", createdAt: at }).returning({ id: schema.flashSales.id });
    // Slot admin selalu menang: slot otomatis yang bertabrakan dinonaktifkan dan tidak akan dibuat ulang.
    const disable = autoSlotsToDisable(input, existing);
    if (disable.length) await tx.update(schema.flashSales).set({ isActive: false }).where(inArray(schema.flashSales.id, disable));
    await writeAudit(tx, { staff, action: "promo.flash_slot", objectType: "promo", objectId: String(row.id), summary: `Buat slot ${name}${disable.length ? `, ${disable.length} slot otomatis dinonaktifkan` : ""}`, after: { nama: name, mulai: input.startsAt.toISOString(), selesai: input.endsAt.toISOString() }, at });
    return { ok: true as const, id: row.id, tags: ["products"] };
  });
}

async function onlineAvailable(db: AnyDb, variantId: number) {
  const [r] = await db
    .select({ a: sql<number>`(${schema.inventory.onHand} - ${schema.inventory.reserved})::int` })
    .from(schema.inventory)
    .innerJoin(schema.locations, eq(schema.inventory.locationId, schema.locations.id))
    .where(and(eq(schema.inventory.variantId, variantId), eq(schema.locations.slug, ONLINE_WAREHOUSE_SLUG)))
    .limit(1);
  return Math.max(0, Number(r?.a ?? 0));
}

export async function saveFlashItem(db: AnyDb, staff: StaffPrincipal, input: { slotId: number; variantId: number; flashPrice: number; quota: number; maxPerCustomer: number; confirmRunning?: boolean }, opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const at = opts.now ?? new Date();
  const [slot] = await db.select().from(schema.flashSales).where(eq(schema.flashSales.id, input.slotId)).limit(1);
  if (!slot) return { ok: false, message: "Slot tidak ditemukan." };
  if (slot.endsAt.getTime() <= at.getTime()) return { ok: false, message: "Slot sudah berakhir." };
  const running = slot.startsAt.getTime() <= at.getTime();
  if (running && !input.confirmRunning) return { ok: false, needsConfirm: true, message: "Slot ini sedang berjalan. Perubahan langsung berlaku untuk pembeli. Konfirmasi dulu." };
  const [v] = await db.select().from(schema.variants).where(eq(schema.variants.id, input.variantId)).limit(1);
  if (!v) return { ok: false, message: "Varian tidak ditemukan." };
  const [existing] = await db.select().from(schema.flashSaleItems).where(and(eq(schema.flashSaleItems.flashSaleId, slot.id), eq(schema.flashSaleItems.variantId, v.id))).limit(1);
  const effective = effectivePrice({ normalPrice: v.normalPrice, salePrice: v.salePrice, promoPrice: v.promoPrice, promoStartsAt: v.promoStartsAt, promoEndsAt: v.promoEndsAt }, slot.startsAt).price;
  const check = checkFlashItem({ flashPrice: input.flashPrice, quota: input.quota, maxPerCustomer: input.maxPerCustomer, effective, normalPrice: v.normalPrice, onlineAvailable: await onlineAvailable(db, v.id), sold: existing?.sold });
  if (check.errors.length) return { ok: false, message: check.errors[0], warnings: check.warnings };
  const values = { flashPrice: input.flashPrice, quota: input.quota, maxPerCustomer: input.maxPerCustomer };
  let id = existing?.id;
  if (existing) await db.update(schema.flashSaleItems).set(values).where(eq(schema.flashSaleItems.id, existing.id));
  else id = (await db.insert(schema.flashSaleItems).values({ ...values, flashSaleId: slot.id, variantId: v.id, sold: 0 }).returning({ id: schema.flashSaleItems.id }))[0].id;
  await writeAudit(db, {
    staff,
    action: "promo.flash_item",
    objectType: "promo",
    objectId: String(slot.id),
    summary: `${existing ? "Ubah" : "Tambah"} ${v.sku} di slot ${slot.name}${running ? " (slot sedang berjalan)" : ""}`,
    before: existing ? { harga: existing.flashPrice, kuota: existing.quota, maks: existing.maxPerCustomer } : undefined,
    after: { harga: values.flashPrice, kuota: values.quota, maks: values.maxPerCustomer },
    at,
  });
  const [p] = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.id, v.productId));
  return { ok: true, id, tags: ["products", `product:${p?.slug}`], warnings: check.warnings };
}

export async function removeFlashItem(db: AnyDb, staff: StaffPrincipal, itemId: number, opts: { now?: Date; confirmRunning?: boolean } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const [it] = await db.select({ item: schema.flashSaleItems, slot: schema.flashSales, sku: schema.variants.sku }).from(schema.flashSaleItems).innerJoin(schema.flashSales, eq(schema.flashSaleItems.flashSaleId, schema.flashSales.id)).innerJoin(schema.variants, eq(schema.flashSaleItems.variantId, schema.variants.id)).where(eq(schema.flashSaleItems.id, itemId)).limit(1);
  if (!it) return { ok: false, message: "Item tidak ditemukan." };
  if (it.item.sold > 0) return { ok: false, message: "Item ini sudah terjual di slot, jadi tidak bisa dihapus. Turunkan kuotanya saja." };
  const at = opts.now ?? new Date();
  if (it.slot.startsAt.getTime() <= at.getTime() && it.slot.endsAt.getTime() > at.getTime() && !opts.confirmRunning) return { ok: false, needsConfirm: true, message: "Slot ini sedang berjalan. Konfirmasi dulu." };
  await db.delete(schema.flashSaleItems).where(eq(schema.flashSaleItems.id, itemId));
  await writeAudit(db, { staff, action: "promo.flash_item", objectType: "promo", objectId: String(it.slot.id), summary: `Hapus ${it.sku} dari slot ${it.slot.name}`, before: { harga: it.item.flashPrice, kuota: it.item.quota }, at });
  return { ok: true, tags: ["products"] };
}

export async function setFlashSlotActive(db: AnyDb, staff: StaffPrincipal, slotId: number, active: boolean, opts: { now?: Date; confirmRunning?: boolean } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const [slot] = await db.select().from(schema.flashSales).where(eq(schema.flashSales.id, slotId)).limit(1);
  if (!slot) return { ok: false, message: "Slot tidak ditemukan." };
  const at = opts.now ?? new Date();
  const running = slot.startsAt.getTime() <= at.getTime() && slot.endsAt.getTime() > at.getTime();
  if (running && !opts.confirmRunning) return { ok: false, needsConfirm: true, message: "Slot ini sedang berjalan. Konfirmasi dulu." };
  await db.update(schema.flashSales).set({ isActive: active }).where(eq(schema.flashSales.id, slotId));
  await writeAudit(db, { staff, action: "promo.flash_slot", objectType: "promo", objectId: String(slotId), summary: `${active ? "Aktifkan" : "Nonaktifkan"} slot ${slot.name}${running ? " (sedang berjalan)" : ""}`, before: { aktif: slot.isActive }, after: { aktif: active }, at });
  return { ok: true, tags: ["products"] };
}

// ---------- Voucher ----------

export async function listVouchers(db: AnyDb) {
  const rows = await db.select().from(schema.vouchers).orderBy(desc(schema.vouchers.isActive), desc(schema.vouchers.createdAt));
  const stats = await db.select({ voucherId: schema.voucherRedemptions.voucherId, n: count(), total: sql<number>`coalesce(sum(${schema.voucherRedemptions.discount}), 0)::int` }).from(schema.voucherRedemptions).groupBy(schema.voucherRedemptions.voucherId);
  const by = new Map(stats.map((s) => [s.voucherId, s]));
  return rows.map((v) => ({ ...v, redeemed: Number(by.get(v.id)?.n ?? 0), totalDiscount: Number(by.get(v.id)?.total ?? 0), remaining: v.quota == null ? null : Math.max(0, v.quota - v.used) }));
}

export async function saveVoucher(db: AnyDb, staff: StaffPrincipal, input: VoucherForm, id: number | null, opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const err = validateVoucher(input);
  if (err) return { ok: false, message: err };
  const code = input.code.trim().toUpperCase();
  const [dup] = await db.select({ id: schema.vouchers.id }).from(schema.vouchers).where(id ? and(eq(schema.vouchers.code, code), ne(schema.vouchers.id, id)) : eq(schema.vouchers.code, code)).limit(1);
  if (dup) return { ok: false, message: `Kode ${code} sudah dipakai voucher lain.` };
  const at = opts.now ?? new Date();
  const values = {
    code,
    title: input.title.trim().slice(0, 80),
    description: (input.description ?? "").trim().slice(0, 300),
    type: input.type,
    value: input.value,
    maxDiscount: input.type === "nominal" ? null : (input.maxDiscount ?? null),
    minSpend: input.minSpend,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    quota: input.quota ?? null,
    quotaPerCustomer: input.quotaPerCustomer,
    scope: { ...(input.brandIds?.length ? { brandIds: input.brandIds } : {}), ...(input.categoryIds?.length ? { categoryIds: input.categoryIds } : {}) },
    stackWithFlash: input.stackWithFlash,
    isActive: input.isActive,
    isPublic: Boolean(input.isPublic),
  };
  if (id) {
    const [old] = await db.select().from(schema.vouchers).where(eq(schema.vouchers.id, id)).limit(1);
    if (!old) return { ok: false, message: "Voucher tidak ditemukan." };
    if (old.used > 0 && old.code !== code) return { ok: false, message: "Kode voucher yang sudah dipakai tidak bisa diganti. Buat voucher baru saja." };
    if (values.quota != null && values.quota < old.used) return { ok: false, message: `Kuota tidak boleh di bawah pemakaian (${old.used}).` };
    await db.update(schema.vouchers).set(values).where(eq(schema.vouchers.id, id));
    await writeAudit(db, { staff, action: "promo.voucher", objectType: "promo", objectId: code, summary: `Ubah voucher ${code}`, before: { nilai: old.value, minimal: old.minSpend, kuota: old.quota, aktif: old.isActive, publik: old.isPublic, selesai: old.endsAt.toISOString() }, after: { nilai: values.value, minimal: values.minSpend, kuota: values.quota, aktif: values.isActive, publik: values.isPublic, selesai: values.endsAt.toISOString() }, at });
    return { ok: true, id, tags: [] };
  }
  const [row] = await db.insert(schema.vouchers).values({ ...values, used: 0, createdAt: at }).returning({ id: schema.vouchers.id });
  await writeAudit(db, { staff, action: "promo.voucher", objectType: "promo", objectId: code, summary: `Buat voucher ${code}`, after: { tipe: values.type, nilai: values.value, minimal: values.minSpend, kuota: values.quota }, at });
  return { ok: true, id: row.id, tags: [] };
}

export async function setVoucherActive(db: AnyDb, staff: StaffPrincipal, id: number, active: boolean, opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const [v] = await db.select().from(schema.vouchers).where(eq(schema.vouchers.id, id)).limit(1);
  if (!v) return { ok: false, message: "Voucher tidak ditemukan." };
  // Menonaktifkan tidak menghapus riwayat pemakaian.
  await db.update(schema.vouchers).set({ isActive: active }).where(eq(schema.vouchers.id, id));
  await writeAudit(db, { staff, action: "promo.voucher", objectType: "promo", objectId: v.code, summary: `${active ? "Aktifkan" : "Nonaktifkan"} voucher ${v.code}`, before: { aktif: v.isActive }, after: { aktif: active }, at: opts.now });
  return { ok: true, tags: [] };
}

// ---------- Banner dan PromoBar ----------

export { liveBanners } from "@/lib/catalog/banners";

export async function saveBanner(db: AnyDb, staff: StaffPrincipal, input: BannerForm, id: number | null, opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const err = validateBanner(input);
  if (err) return { ok: false, message: err };
  const values = { title: input.title.trim(), subtitle: (input.subtitle ?? "").trim(), ctaLabel: (input.ctaLabel ?? "").trim(), href: input.href, imageUrl: input.imageUrl || null, art: input.imageUrl ? null : (input.art ?? null), startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, isActive: input.isActive, position: "hero" };
  const at = opts.now ?? new Date();
  if (id) {
    const [old] = await db.select().from(schema.banners).where(eq(schema.banners.id, id)).limit(1);
    if (!old) return { ok: false, message: "Banner tidak ditemukan." };
    await db.update(schema.banners).set({ ...values, sortOrder: input.sortOrder ?? old.sortOrder }).where(eq(schema.banners.id, id));
    await writeAudit(db, { staff, action: "promo.banner", objectType: "promo", objectId: String(id), summary: `Ubah banner "${values.title}"`, before: { judul: old.title, aktif: old.isActive, mulai: old.startsAt?.toISOString() ?? null, selesai: old.endsAt?.toISOString() ?? null }, after: { judul: values.title, aktif: values.isActive, mulai: values.startsAt?.toISOString() ?? null, selesai: values.endsAt?.toISOString() ?? null }, at });
    return { ok: true, id, tags: ["banners"] };
  }
  const [{ n }] = await db.select({ n: count() }).from(schema.banners);
  const [row] = await db.insert(schema.banners).values({ ...values, sortOrder: input.sortOrder ?? Number(n), createdAt: at }).returning({ id: schema.banners.id });
  await writeAudit(db, { staff, action: "promo.banner", objectType: "promo", objectId: String(row.id), summary: `Buat banner "${values.title}"`, at });
  return { ok: true, id: row.id, tags: ["banners"] };
}

export async function moveBanner(db: AnyDb, staff: StaffPrincipal, id: number, dir: -1 | 1): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const rows = await db.select({ id: schema.banners.id, sortOrder: schema.banners.sortOrder }).from(schema.banners).orderBy(asc(schema.banners.sortOrder), asc(schema.banners.id));
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true, tags: [] };
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  await db.transaction(async (tx) => {
    for (const [k, bid] of order.entries()) await tx.update(schema.banners).set({ sortOrder: k }).where(eq(schema.banners.id, bid));
  });
  return { ok: true, tags: ["banners"] };
}

export async function deleteBanner(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const [b] = await db.select().from(schema.banners).where(eq(schema.banners.id, id)).limit(1);
  if (!b) return { ok: false, message: "Banner tidak ditemukan." };
  await db.delete(schema.banners).where(eq(schema.banners.id, id));
  await writeAudit(db, { staff, action: "promo.banner", objectType: "promo", objectId: String(id), summary: `Hapus banner "${b.title}"`, at: opts.now });
  return { ok: true, tags: ["banners"] };
}

export async function savePromoBar(db: AnyDb, staff: StaffPrincipal, messages: string[], opts: { now?: Date } = {}): Promise<PromoResult> {
  if (!can(staff, "promo.kelola")) return DENIED;
  const clean = messages.map((m) => String(m ?? "").trim()).filter(Boolean);
  if (clean.length > 6) return { ok: false, message: "Maksimal 6 pesan PromoBar." };
  if (clean.some((m) => m.length > 80)) return { ok: false, message: "Setiap pesan maksimal 80 karakter." };
  const [old] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, SETTING_KEYS.promoBar)).limit(1);
  const at = opts.now ?? new Date();
  await db.insert(schema.settings).values({ key: SETTING_KEYS.promoBar, value: clean, updatedAt: at }).onConflictDoUpdate({ target: schema.settings.key, set: { value: clean, updatedAt: at } });
  await writeAudit(db, { staff, action: "promo.promobar", objectType: "promo", objectId: "promobar", summary: "Ubah pesan PromoBar", before: { pesan: old?.value ?? [] }, after: { pesan: clean }, at });
  return { ok: true, tags: ["settings"] };
}


// Pencarian varian untuk editor promo: harga normal, jual, promo, dan stok online tersedia.
// opts.ids: cari langsung per id varian (draf dari saran flash sale, Fase 7B).
export async function searchPromoVariants(db: AnyDb, q: string, limit = 12, opts: { ids?: number[] } = {}) {
  const term = q.trim().replace(/[%_]/g, "");
  if (!opts.ids && term.length < 2) return [];
  const like = `%${term}%`;
  const rows = await db
    .select({
      variantId: schema.variants.id,
      productName: schema.products.name,
      brandName: schema.brands.name,
      shadeName: schema.variants.shadeName,
      sku: schema.variants.sku,
      hex: schema.variants.hex,
      normalPrice: schema.variants.normalPrice,
      salePrice: schema.variants.salePrice,
      promoPrice: schema.variants.promoPrice,
      promoStartsAt: schema.variants.promoStartsAt,
      promoEndsAt: schema.variants.promoEndsAt,
    })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .where(and(eq(schema.variants.isActive, true), opts.ids ? inArray(schema.variants.id, opts.ids.length ? opts.ids : [-1]) : sql`(${schema.products.name} ilike ${like} or ${schema.variants.shadeName} ilike ${like} or ${schema.variants.sku} ilike ${like} or ${schema.brands.name} ilike ${like})`))
    .orderBy(asc(schema.products.name), asc(schema.variants.sortOrder))
    .limit(limit);
  if (!rows.length) return [];
  const stock = await db
    .select({ variantId: schema.inventory.variantId, a: sql<number>`(${schema.inventory.onHand} - ${schema.inventory.reserved})::int` })
    .from(schema.inventory)
    .innerJoin(schema.locations, eq(schema.inventory.locationId, schema.locations.id))
    .where(and(inArray(schema.inventory.variantId, rows.map((r) => r.variantId)), eq(schema.locations.slug, ONLINE_WAREHOUSE_SLUG)));
  const by = new Map(stock.map((s) => [s.variantId, Math.max(0, Number(s.a))]));
  return rows.map((r) => ({ ...r, onlineAvailable: by.get(r.variantId) ?? 0 }));
}
export type PromoVariant = Awaited<ReturnType<typeof searchPromoVariants>>[number];

// Varian dengan harga promo terjadwal (yang masih berlaku atau akan datang).
export async function listVariantPromos(db: AnyDb, now: Date) {
  return db
    .select({ variantId: schema.variants.id, productName: schema.products.name, shadeName: schema.variants.shadeName, sku: schema.variants.sku, hex: schema.variants.hex, normalPrice: schema.variants.normalPrice, salePrice: schema.variants.salePrice, promoPrice: schema.variants.promoPrice, promoStartsAt: schema.variants.promoStartsAt, promoEndsAt: schema.variants.promoEndsAt })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(and(sql`${schema.variants.promoPrice} is not null`, sql`(${schema.variants.promoEndsAt} is null or ${schema.variants.promoEndsAt} > ${now.toISOString()}::timestamptz)`))
    .orderBy(asc(schema.products.name), asc(schema.variants.sortOrder))
    .limit(200);
}

export async function listBanners(db: AnyDb) {
  return db.select().from(schema.banners).orderBy(asc(schema.banners.sortOrder), asc(schema.banners.id));
}
