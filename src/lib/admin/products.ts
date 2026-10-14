// Produk di panel admin: daftar, validasi, simpan (dengan varian), arsip atau hapus, dan duplikat.
// Varian baru otomatis mendapat baris inventory 0 di semua lokasi lewat modul inventory.
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import { packagingValues, type Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";
import { lockInventory } from "@/lib/inventory";
import { discountPercent, roundToPromo } from "@/lib/pricing";
import { slugify } from "@/lib/utils";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";

export const PRODUCT_STATUSES = ["aktif", "draf", "arsip"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const SKIN_TYPES = ["normal", "kering", "berminyak", "kombinasi", "sensitif"] as const;
export const CONCERNS = ["jerawat", "kusam", "pori", "penuaan", "dehidrasi"] as const;
export const SEO_TITLE_MAX = 60;
export const SEO_DESC_MAX = 160;

export type VariantInput = {
  id?: number | null;
  shadeName: string;
  hex: string;
  undertone?: "warm" | "neutral" | "cool" | null;
  depth?: number | null;
  sku: string;
  barcode?: string;
  weightGram: number;
  normalPrice: number;
  salePrice: number;
  isActive: boolean;
};

export type ProductInput = {
  name: string;
  slug?: string;
  brandId: number;
  categoryId: number;
  packaging: Packaging;
  shortDescription?: string;
  benefits?: string;
  ingredients?: string;
  howToUse?: string;
  activeIngredients?: string[];
  skinTypes?: string[];
  skinConcerns?: string[];
  finish?: "matte" | "satin" | "glowy" | null;
  spf?: number | null;
  bpom?: string;
  netto?: string;
  imageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status: ProductStatus;
  variants: VariantInput[];
};

export type ProductIssue = { field: string; message: string };

// SKU otomatis: kode merek (4 huruf), nomor produk, nomor varian. Bisa diubah admin.
export function suggestSku(brandName: string, productId: number | null, index: number) {
  const code = brandName.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "RONA";
  return `${code}-${String(productId ?? 0).padStart(3, "0")}-${String(index + 1).padStart(2, "0")}`;
}

// Validasi murni bentuk dan aturan produk serta varian (tanpa database).
export function validateProduct(input: ProductInput): ProductIssue[] {
  const issues: ProductIssue[] = [];
  const name = (input.name ?? "").trim();
  if (name.length < 3 || name.length > 120) issues.push({ field: "name", message: "Nama produk 3 sampai 120 karakter." });
  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) issues.push({ field: "slug", message: "Slug hanya huruf kecil, angka, dan tanda hubung." });
  if (!Number.isInteger(input.brandId) || input.brandId <= 0) issues.push({ field: "brandId", message: "Pilih merek." });
  if (!Number.isInteger(input.categoryId) || input.categoryId <= 0) issues.push({ field: "categoryId", message: "Pilih kategori." });
  if (!packagingValues.includes(input.packaging)) issues.push({ field: "packaging", message: "Pilih bentuk kemasan." });
  if (!PRODUCT_STATUSES.includes(input.status)) issues.push({ field: "status", message: "Status tidak valid." });
  if (input.spf != null && (!Number.isInteger(input.spf) || input.spf < 0 || input.spf > 100)) issues.push({ field: "spf", message: "SPF 0 sampai 100." });
  if ((input.seoTitle ?? "").length > SEO_TITLE_MAX) issues.push({ field: "seoTitle", message: `Judul meta maksimal ${SEO_TITLE_MAX} karakter.` });
  if ((input.seoDescription ?? "").length > SEO_DESC_MAX) issues.push({ field: "seoDescription", message: `Deskripsi meta maksimal ${SEO_DESC_MAX} karakter.` });
  if (!Array.isArray(input.variants) || input.variants.length === 0) issues.push({ field: "variants", message: "Tambahkan minimal satu varian." });
  if ((input.variants?.length ?? 0) > 30) issues.push({ field: "variants", message: "Maksimal 30 varian per produk." });
  const skus = new Set<string>();
  const shades = new Set<string>();
  (input.variants ?? []).forEach((v, i) => {
    const f = (k: string) => `variants.${i}.${k}`;
    const shade = (v.shadeName ?? "").trim();
    if (shade.length < 1 || shade.length > 60) issues.push({ field: f("shadeName"), message: "Nama shade wajib diisi." });
    const shadeSlug = slugify(shade);
    if (shade && shades.has(shadeSlug)) issues.push({ field: f("shadeName"), message: "Nama shade kembar di produk ini." });
    shades.add(shadeSlug);
    if (!/^#[0-9a-fA-F]{6}$/.test(v.hex ?? "")) issues.push({ field: f("hex"), message: "Warna harus kode hex, misal #D9A98B." });
    if (v.depth != null && (!Number.isInteger(v.depth) || v.depth < 1 || v.depth > 6)) issues.push({ field: f("depth"), message: "Kedalaman 1 sampai 6." });
    const sku = (v.sku ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(sku)) issues.push({ field: f("sku"), message: "SKU 3 sampai 40 huruf besar, angka, atau tanda hubung." });
    else if (skus.has(sku)) issues.push({ field: f("sku"), message: "SKU kembar di produk ini." });
    skus.add(sku);
    if (!Number.isInteger(v.weightGram) || v.weightGram < 1 || v.weightGram > 5000) issues.push({ field: f("weightGram"), message: "Berat 1 sampai 5.000 gram." });
    if (!Number.isInteger(v.normalPrice) || v.normalPrice < 1000 || v.normalPrice > 50_000_000) issues.push({ field: f("normalPrice"), message: "Harga normal minimal Rp 1.000." });
    if (!Number.isInteger(v.salePrice) || v.salePrice < 1000) issues.push({ field: f("salePrice"), message: "Harga jual minimal Rp 1.000." });
    else if (v.salePrice > v.normalPrice) issues.push({ field: f("salePrice"), message: "Harga jual tidak boleh melebihi harga normal." });
  });
  return issues;
}

export const variantDiscount = (v: Pick<VariantInput, "normalPrice" | "salePrice">) => discountPercent(v.normalPrice, v.salePrice);

export type ProductListFilters = { q?: string | null; brand?: number | null; category?: number | null; status?: ProductStatus | null; page?: number };

export async function listProducts(db: AnyDb, f: ProductListFilters) {
  const conds: SQL[] = [];
  const q = (f.q ?? "").trim().replace(/[%_]/g, "");
  if (q) conds.push(or(ilike(schema.products.name, `%${q}%`), ilike(schema.products.slug, `%${q}%`), sql`exists (select 1 from variants v where v.product_id = ${schema.products.id} and v.sku ilike ${`%${q}%`})`)!);
  if (f.brand) conds.push(eq(schema.products.brandId, f.brand));
  if (f.category) conds.push(or(eq(schema.products.categoryId, f.category), sql`${schema.products.categoryId} in (select id from categories where parent_id = ${f.category})`)!);
  if (f.status) conds.push(eq(schema.products.status, f.status));
  const where = conds.length ? and(...conds) : undefined;
  const pageSize = 20;
  const page = Math.max(1, f.page ?? 1);
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(schema.products).where(where),
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        slug: schema.products.slug,
        status: schema.products.status,
        packaging: schema.products.packaging,
        soldCount: schema.products.soldCount,
        brandName: schema.brands.name,
        brandColor: schema.brands.color,
        categoryName: schema.categories.name,
        updatedAt: schema.products.updatedAt,
      })
      .from(schema.products)
      .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
      .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(where)
      .orderBy(desc(schema.products.updatedAt), desc(schema.products.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const ids = rows.map((r) => r.id);
  const agg = ids.length
    ? ((await db.execute(sql`
        select v.product_id as id, count(distinct v.id)::int as variants, min(v.sale_price)::int as min_price, max(v.sale_price)::int as max_price,
               min(v.hex) as hex, coalesce(sum(i.on_hand - i.reserved), 0)::int as stock
        from variants v left join inventory i on i.variant_id = v.id
        where v.product_id in ${sql.raw(`(${ids.map(Number).join(",")})`)}
        group by v.product_id`)) as unknown as { id: number; variants: number; min_price: number; max_price: number; hex: string; stock: number }[])
    : [];
  const byId = new Map(agg.map((a) => [Number(a.id), a]));
  return {
    rows: rows.map((r) => {
      const a = byId.get(r.id);
      return { ...r, variants: Number(a?.variants ?? 0), minPrice: Number(a?.min_price ?? 0), maxPrice: Number(a?.max_price ?? 0), hex: a?.hex ?? "#D9A98B", stock: Number(a?.stock ?? 0) };
    }),
    total: Number(n),
    page,
    pageCount: Math.max(1, Math.ceil(Number(n) / pageSize)),
  };
}

export async function getProductForEdit(db: AnyDb, id: number) {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!p) return null;
  const variants = await db.select().from(schema.variants).where(eq(schema.variants.productId, id)).orderBy(asc(schema.variants.sortOrder), asc(schema.variants.id));
  const [{ orders }] = (await db.execute(sql`select count(*)::int as orders from order_items oi join variants v on v.id = oi.variant_id where v.product_id = ${id}`)) as unknown as { orders: number }[];
  return { product: p, variants, hasOrders: Number(orders) > 0 };
}

export type SaveProductResult = { ok: true; id: number; slug: string; tags: { slugs: string[]; brandSlugs: string[]; categorySlugs: string[] } } | { ok: false; message: string; issues?: ProductIssue[] };

type Snapshot = { status: string; harga: Record<string, { normal: number; jual: number }> };
const snapshotOf = (status: string, variants: { sku: string; normalPrice: number; salePrice: number }[]): Snapshot => ({ status, harga: Object.fromEntries(variants.map((v) => [v.sku, { normal: v.normalPrice, jual: v.salePrice }])) });

export async function saveProduct(db: AnyDb, staff: StaffPrincipal, input: ProductInput, id: number | null, opts: { now?: Date } = {}): Promise<SaveProductResult> {
  if (!can(staff, "produk.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola produk." };
  const issues = validateProduct(input);
  if (issues.length) return { ok: false, message: issues[0].message, issues };
  const at = opts.now ?? new Date();
  const slug = (input.slug?.trim() || slugify(input.name)).toLowerCase();
  const variants = input.variants.map((v, i) => ({ ...v, sku: v.sku.trim().toUpperCase(), shadeName: v.shadeName.trim(), shadeSlug: slugify(v.shadeName), hex: v.hex.toUpperCase(), sortOrder: i }));
  return db.transaction(async (tx) => {
    const [brand] = await tx.select().from(schema.brands).where(eq(schema.brands.id, input.brandId)).limit(1);
    const [cat] = await tx.select().from(schema.categories).where(eq(schema.categories.id, input.categoryId)).limit(1);
    if (!brand) return { ok: false as const, message: "Merek tidak ditemukan.", issues: [{ field: "brandId", message: "Merek tidak ditemukan." }] };
    if (!cat || cat.parentId == null) return { ok: false as const, message: "Pilih sub kategori (tingkat kedua).", issues: [{ field: "categoryId", message: "Pilih sub kategori (tingkat kedua)." }] };
    const [slugTaken] = await tx.select({ id: schema.products.id }).from(schema.products).where(id ? and(eq(schema.products.slug, slug), ne(schema.products.id, id)) : eq(schema.products.slug, slug)).limit(1);
    if (slugTaken) return { ok: false as const, message: "Slug sudah dipakai produk lain.", issues: [{ field: "slug", message: "Slug sudah dipakai produk lain." }] };
    // SKU unik di seluruh katalog.
    const keepIds = variants.map((v) => v.id).filter((x): x is number => Number.isInteger(x));
    const clash = await tx.select({ sku: schema.variants.sku, id: schema.variants.id }).from(schema.variants).where(inArray(schema.variants.sku, variants.map((v) => v.sku)));
    const foreign = clash.filter((c) => !keepIds.includes(c.id));
    if (foreign.length) {
      const bad = variants.findIndex((v) => v.sku === foreign[0].sku);
      return { ok: false as const, message: `SKU ${foreign[0].sku} sudah dipakai varian lain.`, issues: [{ field: `variants.${bad}.sku`, message: "SKU sudah dipakai varian lain." }] };
    }
    const parentSlug = cat.parentId ? (await tx.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.id, cat.parentId)).limit(1))[0]?.slug : null;
    const searchText = [input.name, brand.name, cat.name, ...variants.map((v) => v.shadeName), ...(input.activeIngredients ?? [])].join(" ");
    const values = {
      name: input.name.trim(),
      slug,
      brandId: brand.id,
      categoryId: cat.id,
      packaging: input.packaging,
      shortDescription: (input.shortDescription ?? "").trim().slice(0, 300),
      benefits: (input.benefits ?? "").trim().slice(0, 4000),
      ingredients: (input.ingredients ?? "").trim().slice(0, 4000),
      howToUse: (input.howToUse ?? "").trim().slice(0, 4000),
      activeIngredients: (input.activeIngredients ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 12),
      skinTypes: (input.skinTypes ?? []).filter((x) => (SKIN_TYPES as readonly string[]).includes(x)),
      skinConcerns: (input.skinConcerns ?? []).filter((x) => (CONCERNS as readonly string[]).includes(x)),
      finish: input.finish ?? null,
      spf: input.spf ?? null,
      bpom: (input.bpom ?? "").trim().slice(0, 40),
      netto: (input.netto ?? "").trim().slice(0, 40),
      imageUrl: input.imageUrl || null,
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
      status: input.status,
      searchText,
      updatedAt: at,
    };
    let productId = id;
    let before: Snapshot | null = null;
    let oldSlug: string | null = null;
    let oldBrandSlug: string | null = null;
    if (id) {
      const [old] = await tx.select().from(schema.products).where(eq(schema.products.id, id)).for("update");
      if (!old) return { ok: false as const, message: "Produk tidak ditemukan." };
      oldSlug = old.slug;
      oldBrandSlug = (await tx.select({ slug: schema.brands.slug }).from(schema.brands).where(eq(schema.brands.id, old.brandId)).limit(1))[0]?.slug ?? null;
      const oldVariants = await tx.select().from(schema.variants).where(eq(schema.variants.productId, id));
      before = snapshotOf(old.status, oldVariants);
      const ownIds = new Set(oldVariants.map((v) => v.id));
      if (variants.some((v) => v.id != null && !ownIds.has(v.id))) return { ok: false as const, message: "Varian tidak cocok dengan produk ini." };
      await tx.update(schema.products).set({ ...values, publishedAt: old.publishedAt ?? (input.status === "aktif" ? at : null) }).where(eq(schema.products.id, id));
      // Varian yang dihapus dari formulir: dinonaktifkan bila sudah punya pesanan, selain itu dihapus.
      const removed = oldVariants.filter((v) => !keepIds.includes(v.id));
      for (const r of removed) {
        const [used] = await tx.select({ n: count() }).from(schema.orderItems).where(eq(schema.orderItems.variantId, r.id));
        if (Number(used.n) > 0) await tx.update(schema.variants).set({ isActive: false, updatedAt: at }).where(eq(schema.variants.id, r.id));
        else await tx.delete(schema.variants).where(eq(schema.variants.id, r.id));
      }
    } else {
      const [row] = await tx.insert(schema.products).values({ ...values, publishedAt: input.status === "aktif" ? at : null, createdAt: at }).returning({ id: schema.products.id });
      productId = row.id;
    }
    // Simpan varian (sementara SKU diberi awalan supaya tukar SKU antar varian tidak menabrak indeks unik).
    const newIds: number[] = [];
    for (const v of variants) {
      const row = { shadeName: v.shadeName, shadeSlug: v.shadeSlug, hex: v.hex, undertone: v.undertone ?? null, depth: v.depth ?? null, sku: v.sku, barcode: (v.barcode ?? "").trim().slice(0, 40), weightGram: v.weightGram, normalPrice: v.normalPrice, salePrice: v.salePrice, isActive: v.isActive, sortOrder: v.sortOrder, updatedAt: at };
      if (v.id) await tx.update(schema.variants).set({ ...row, sku: `TMP-${v.id}-${v.sku}`.slice(0, 60), shadeSlug: `tmp-${v.id}-${v.shadeSlug}` }).where(and(eq(schema.variants.id, v.id), eq(schema.variants.productId, productId!)));
    }
    for (const v of variants) {
      const row = { shadeName: v.shadeName, shadeSlug: v.shadeSlug, hex: v.hex, undertone: v.undertone ?? null, depth: v.depth ?? null, sku: v.sku, barcode: (v.barcode ?? "").trim().slice(0, 40), weightGram: v.weightGram, normalPrice: v.normalPrice, salePrice: v.salePrice, isActive: v.isActive, sortOrder: v.sortOrder, updatedAt: at };
      if (v.id) await tx.update(schema.variants).set(row).where(and(eq(schema.variants.id, v.id), eq(schema.variants.productId, productId!)));
      else {
        const [created] = await tx.insert(schema.variants).values({ ...row, productId: productId!, createdAt: at }).returning({ id: schema.variants.id });
        newIds.push(created.id);
      }
    }
    // Varian baru: baris inventory 0 di semua lokasi lewat modul inventory (lockInventory membuat baris yang belum ada).
    if (newIds.length) {
      const locations = await tx.select({ id: schema.locations.id }).from(schema.locations);
      await lockInventory(tx, newIds.flatMap((variantId) => locations.map((l) => ({ variantId, locationId: l.id }))));
    }
    const after = snapshotOf(input.status, variants);
    const priceChanged = before && JSON.stringify(before.harga) !== JSON.stringify(after.harga);
    const statusChanged = before && before.status !== after.status;
    await writeAudit(tx, {
      staff,
      action: id ? "produk.ubah" : "produk.tambah",
      objectType: "produk",
      objectId: slug,
      summary: id ? `Ubah ${input.name}${statusChanged ? `, status ${before!.status} ke ${after.status}` : ""}${priceChanged ? ", harga berubah" : ""}` : `Tambah ${input.name} (${variants.length} varian, ${input.status})`,
      before: before ?? undefined,
      after,
      at,
    });
    return { ok: true as const, id: productId!, slug, tags: { slugs: [slug, ...(oldSlug && oldSlug !== slug ? [oldSlug] : [])], brandSlugs: [brand.slug, ...(oldBrandSlug && oldBrandSlug !== brand.slug ? [oldBrandSlug] : [])], categorySlugs: [cat.slug, ...(parentSlug ? [parentSlug] : [])] } };
  });
}

export async function setProductStatus(db: AnyDb, staff: StaffPrincipal, id: number, status: ProductStatus, opts: { now?: Date } = {}) {
  if (!can(staff, "produk.kelola")) return { ok: false as const, message: "Kamu tidak punya izin mengelola produk." };
  const [p] = await db.select({ status: schema.products.status, slug: schema.products.slug, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!p) return { ok: false as const, message: "Produk tidak ditemukan." };
  const at = opts.now ?? new Date();
  await db.update(schema.products).set({ status, updatedAt: at, ...(status === "aktif" ? { publishedAt: sql`coalesce(${schema.products.publishedAt}, ${at.toISOString()}::timestamptz)` } : {}) }).where(eq(schema.products.id, id));
  await writeAudit(db, { staff, action: "produk.status", objectType: "produk", objectId: p.slug, summary: `${p.name}: ${p.status} ke ${status}`, before: { status: p.status }, after: { status }, at });
  return { ok: true as const, slug: p.slug };
}

// Produk yang sudah punya pesanan tidak bisa dihapus, hanya diarsipkan.
export async function deleteProduct(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}) {
  if (!can(staff, "produk.kelola")) return { ok: false as const, message: "Kamu tidak punya izin mengelola produk." };
  const found = await getProductForEdit(db, id);
  if (!found) return { ok: false as const, message: "Produk tidak ditemukan." };
  if (found.hasOrders) return { ok: false as const, message: "Produk ini sudah pernah dipesan, jadi tidak bisa dihapus. Arsipkan saja supaya hilang dari toko." };
  await db.delete(schema.products).where(eq(schema.products.id, id));
  await writeAudit(db, { staff, action: "produk.hapus", objectType: "produk", objectId: found.product.slug, summary: `Hapus ${found.product.name}`, before: snapshotOf(found.product.status, found.variants), at: opts.now ?? new Date() });
  return { ok: true as const, slug: found.product.slug };
}

// Duplikat untuk mempercepat input: status draf, slug dan SKU diberi akhiran, stok 0.
export async function duplicateProduct(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}) {
  if (!can(staff, "produk.kelola")) return { ok: false as const, message: "Kamu tidak punya izin mengelola produk." };
  const found = await getProductForEdit(db, id);
  if (!found) return { ok: false as const, message: "Produk tidak ditemukan." };
  const p = found.product;
  let n = 1;
  let slug = `${p.slug}-salinan`;
  while ((await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, slug)).limit(1)).length) slug = `${p.slug}-salinan-${++n}`;
  const suffix = `C${n}`;
  return saveProduct(
    db,
    staff,
    {
      name: `${p.name} (salinan${n > 1 ? ` ${n}` : ""})`,
      slug,
      brandId: p.brandId,
      categoryId: p.categoryId,
      packaging: p.packaging,
      shortDescription: p.shortDescription,
      benefits: p.benefits,
      ingredients: p.ingredients,
      howToUse: p.howToUse,
      activeIngredients: p.activeIngredients,
      skinTypes: p.skinTypes,
      skinConcerns: p.skinConcerns,
      finish: p.finish,
      spf: p.spf,
      bpom: "",
      netto: p.netto,
      imageUrl: null,
      seoTitle: null,
      seoDescription: null,
      status: "draf",
      variants: found.variants.map((v) => ({ shadeName: v.shadeName, hex: v.hex, undertone: v.undertone, depth: v.depth, sku: `${v.sku}-${suffix}`.slice(0, 40), barcode: "", weightGram: v.weightGram, normalPrice: v.normalPrice, salePrice: v.salePrice, isActive: v.isActive })),
    },
    null,
    opts,
  );
}

// Harga promo per varian dengan periode (urutan harga: flash, promo, jual). Dibulatkan ke Rp 500.
export async function setVariantPromo(db: AnyDb, staff: StaffPrincipal, input: { variantId: number; promoPrice: number | null; startsAt: Date | null; endsAt: Date | null }, opts: { now?: Date } = {}) {
  if (!can(staff, "promo.kelola")) return { ok: false as const, message: "Kamu tidak punya izin mengelola promo." };
  const [v] = await db
    .select({ id: schema.variants.id, sku: schema.variants.sku, salePrice: schema.variants.salePrice, promoPrice: schema.variants.promoPrice, promoStartsAt: schema.variants.promoStartsAt, promoEndsAt: schema.variants.promoEndsAt, productSlug: schema.products.slug, productName: schema.products.name })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(eq(schema.variants.id, input.variantId))
    .limit(1);
  if (!v) return { ok: false as const, message: "Varian tidak ditemukan." };
  let promoPrice: number | null = null;
  if (input.promoPrice != null) {
    promoPrice = roundToPromo(input.promoPrice);
    if (promoPrice <= 0 || promoPrice >= v.salePrice) return { ok: false as const, message: "Harga promo harus di bawah harga jual (dibulatkan ke Rp 500)." };
    if (input.startsAt && input.endsAt && input.endsAt.getTime() <= input.startsAt.getTime()) return { ok: false as const, message: "Tanggal selesai harus setelah tanggal mulai." };
  }
  const at = opts.now ?? new Date();
  await db.update(schema.variants).set({ promoPrice, promoStartsAt: promoPrice ? input.startsAt : null, promoEndsAt: promoPrice ? input.endsAt : null, updatedAt: at }).where(eq(schema.variants.id, v.id));
  await writeAudit(db, {
    staff,
    action: "promo.harga",
    objectType: "produk",
    objectId: v.sku,
    summary: promoPrice ? `Harga promo ${v.productName} (${v.sku})` : `Hapus harga promo ${v.productName} (${v.sku})`,
    before: { promo: v.promoPrice, mulai: v.promoStartsAt?.toISOString() ?? null, selesai: v.promoEndsAt?.toISOString() ?? null },
    after: { promo: promoPrice, mulai: promoPrice ? (input.startsAt?.toISOString() ?? null) : null, selesai: promoPrice ? (input.endsAt?.toISOString() ?? null) : null },
    at,
  });
  return { ok: true as const, slug: v.productSlug, promoPrice };
}

export const PACKAGING_OPTIONS = packagingValues;
