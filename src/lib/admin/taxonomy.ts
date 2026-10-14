// Kategori (pohon 2 tingkat, maksimal 8 sub per induk) dan merek di panel admin.
import { asc, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { slugify } from "@/lib/utils";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";
import { similarNames, type SimilarHit } from "./similar";
import { validateTree } from "./tree";

export { MAX_CHILDREN, validateTree, type TreeShape } from "./tree";

export type TreeNode = { id: number; name: string; slug: string; description: string; sortOrder: number; productCount: number; children: TreeNode[] };

export async function categoryTree(db: AnyDb): Promise<TreeNode[]> {
  const cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id));
  const counts = await db.select({ categoryId: schema.products.categoryId, n: count() }).from(schema.products).groupBy(schema.products.categoryId);
  const countOf = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
  const node = (c: (typeof cats)[number]): TreeNode => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, productCount: countOf.get(c.id) ?? 0, children: [] });
  const roots = cats.filter((c) => c.parentId == null).map(node);
  for (const c of cats.filter((x) => x.parentId != null)) {
    const parent = roots.find((r) => r.id === c.parentId);
    if (parent) parent.children.push(node(c));
  }
  for (const r of roots) r.productCount += r.children.reduce((s, c) => s + c.productCount, 0);
  return roots;
}

export type TaxonomyResult = { ok: true; id?: number; tags: string[] } | { ok: false; message: string; similar?: SimilarHit[] };

async function allCategoryNames(db: AnyDb, exceptId?: number) {
  const rows = await db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories);
  return rows.filter((r) => r.id !== exceptId).map((r) => r.name);
}

export async function saveCategory(db: AnyDb, staff: StaffPrincipal, input: { id?: number | null; name: string; parentId: number | null; description?: string; force?: boolean }, opts: { now?: Date } = {}): Promise<TaxonomyResult> {
  if (!can(staff, "kategori.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola kategori." };
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return { ok: false, message: "Nama kategori 2 sampai 60 karakter." };
  const names = await allCategoryNames(db, input.id ?? undefined);
  if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return { ok: false, message: `Kategori "${name}" sudah ada.` };
  const similar = similarNames(name, names);
  if (similar.length && !input.force) return { ok: false, message: "Ada kategori dengan nama mirip. Periksa dulu, atau pilih Tetap simpan.", similar };
  const all = await db.select({ id: schema.categories.id, parentId: schema.categories.parentId, slug: schema.categories.slug }).from(schema.categories);
  const draftId = input.id ?? -1;
  const shape = [...all.filter((c) => c.id !== draftId), { id: draftId, parentId: input.parentId }];
  // Kategori induk yang punya anak tidak bisa dipindah menjadi sub kategori.
  if (input.id && input.parentId != null && all.some((c) => c.parentId === input.id)) return { ok: false, message: "Kategori ini punya sub kategori, jadi tidak bisa dijadikan sub kategori." };
  const invalid = validateTree(shape);
  if (invalid) return { ok: false, message: invalid };
  let slug = slugify(name);
  if (all.some((c) => c.slug === slug && c.id !== input.id)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const at = opts.now ?? new Date();
  if (input.id) {
    const [old] = await db.select().from(schema.categories).where(eq(schema.categories.id, input.id)).limit(1);
    if (!old) return { ok: false, message: "Kategori tidak ditemukan." };
    await db.update(schema.categories).set({ name, slug: old.name === name ? old.slug : slug, parentId: input.parentId, description: (input.description ?? old.description).slice(0, 300), updatedAt: at }).where(eq(schema.categories.id, input.id));
    await writeAudit(db, { staff, action: "kategori.ubah", objectType: "kategori", objectId: old.slug, summary: `Ubah kategori ${old.name}`, before: { nama: old.name, induk: old.parentId }, after: { nama: name, induk: input.parentId }, at });
    return { ok: true, id: input.id, tags: ["categories", `category:${old.slug}`] };
  }
  const siblings = all.filter((c) => c.parentId === input.parentId).length;
  const [row] = await db.insert(schema.categories).values({ name, slug, parentId: input.parentId, description: (input.description ?? "").slice(0, 300), sortOrder: siblings, createdAt: at, updatedAt: at }).returning({ id: schema.categories.id });
  await writeAudit(db, { staff, action: "kategori.tambah", objectType: "kategori", objectId: slug, summary: `Tambah kategori ${name}${input.force && similar.length ? ` (tetap disimpan walau mirip ${similar[0].name})` : ""}`, after: { nama: name, induk: input.parentId }, at });
  return { ok: true, id: row.id, tags: ["categories"] };
}

// Simpan susunan pohon hasil seret-lepas: induk dan urutan setiap kategori.
export async function reorderCategories(db: AnyDb, staff: StaffPrincipal, layout: { id: number; parentId: number | null; sortOrder: number }[], opts: { now?: Date } = {}): Promise<TaxonomyResult> {
  if (!can(staff, "kategori.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola kategori." };
  const all = await db.select({ id: schema.categories.id, parentId: schema.categories.parentId }).from(schema.categories);
  const ids = new Set(all.map((c) => c.id));
  if (layout.length !== all.length || layout.some((l) => !ids.has(l.id))) return { ok: false, message: "Susunan kategori tidak lengkap. Muat ulang halaman." };
  const invalid = validateTree(layout);
  if (invalid) return { ok: false, message: invalid };
  // Kategori yang punya produk langsung harus tetap sub kategori (produk selalu di tingkat kedua).
  const withProducts = await db.selectDistinct({ id: schema.products.categoryId }).from(schema.products);
  const direct = new Set(withProducts.map((p) => p.id));
  if (layout.some((l) => l.parentId == null && direct.has(l.id))) return { ok: false, message: "Kategori yang berisi produk harus tetap menjadi sub kategori." };
  const at = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    for (const l of layout) await tx.update(schema.categories).set({ parentId: l.parentId, sortOrder: l.sortOrder, updatedAt: at }).where(eq(schema.categories.id, l.id));
    await writeAudit(tx, { staff, action: "kategori.urut", objectType: "kategori", objectId: "pohon", summary: "Ubah susunan pohon kategori", at });
  });
  return { ok: true, tags: ["categories", "products"] };
}

export async function moveCategoryProducts(db: AnyDb, staff: StaffPrincipal, fromId: number, toId: number, opts: { now?: Date } = {}): Promise<TaxonomyResult & { moved?: number }> {
  if (!can(staff, "kategori.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola kategori." };
  const [to] = await db.select().from(schema.categories).where(eq(schema.categories.id, toId)).limit(1);
  if (!to || to.parentId == null || toId === fromId) return { ok: false, message: "Pilih sub kategori tujuan yang lain." };
  const rows = await db.update(schema.products).set({ categoryId: toId, updatedAt: opts.now ?? new Date() }).where(eq(schema.products.categoryId, fromId)).returning({ slug: schema.products.slug });
  await writeAudit(db, { staff, action: "kategori.pindah", objectType: "kategori", objectId: String(fromId), summary: `Pindahkan ${rows.length} produk ke ${to.name}`, at: opts.now });
  return { ok: true, moved: rows.length, tags: ["categories", "products", ...rows.map((r) => `product:${r.slug}`)] };
}

export async function deleteCategory(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}): Promise<TaxonomyResult> {
  if (!can(staff, "kategori.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola kategori." };
  const [c] = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1);
  if (!c) return { ok: false, message: "Kategori tidak ditemukan." };
  const [{ kids }] = await db.select({ kids: count() }).from(schema.categories).where(eq(schema.categories.parentId, id));
  if (Number(kids) > 0) return { ok: false, message: "Hapus atau pindahkan sub kategorinya dulu." };
  const [{ n }] = await db.select({ n: count() }).from(schema.products).where(eq(schema.products.categoryId, id));
  if (Number(n) > 0) return { ok: false, message: `Kategori ini masih berisi ${n} produk. Pindahkan produknya dulu.` };
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  await writeAudit(db, { staff, action: "kategori.hapus", objectType: "kategori", objectId: c.slug, summary: `Hapus kategori ${c.name}`, before: { nama: c.name }, at: opts.now });
  return { ok: true, tags: ["categories", `category:${c.slug}`] };
}

export async function listBrands(db: AnyDb) {
  const rows = await db.select().from(schema.brands).orderBy(asc(schema.brands.sortOrder), asc(schema.brands.name));
  const counts = await db.select({ brandId: schema.products.brandId, n: count() }).from(schema.products).groupBy(schema.products.brandId);
  const by = new Map(counts.map((c) => [c.brandId, Number(c.n)]));
  return rows.map((b) => ({ ...b, productCount: by.get(b.id) ?? 0 }));
}

export async function saveBrand(db: AnyDb, staff: StaffPrincipal, input: { id?: number | null; name: string; slug?: string; color: string; tagline?: string; description?: string; force?: boolean }, opts: { now?: Date } = {}): Promise<TaxonomyResult> {
  if (!can(staff, "kategori.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola merek." };
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return { ok: false, message: "Nama merek 2 sampai 40 karakter." };
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color ?? "")) return { ok: false, message: "Warna merek harus kode hex, misal #C2416B." };
  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, message: "Slug hanya huruf kecil, angka, dan tanda hubung." };
  const others = await db.select({ id: schema.brands.id, name: schema.brands.name, slug: schema.brands.slug }).from(schema.brands).where(input.id ? ne(schema.brands.id, input.id) : sql`true`);
  if (others.some((b) => b.name.toLowerCase() === name.toLowerCase() || b.slug === slug)) return { ok: false, message: "Nama atau slug merek sudah dipakai." };
  const similar = similarNames(name, others.map((b) => b.name));
  if (similar.length && !input.force) return { ok: false, message: "Ada merek dengan nama mirip. Periksa dulu, atau pilih Tetap simpan.", similar };
  const at = opts.now ?? new Date();
  const values = { name, slug, color: input.color.toUpperCase(), tagline: (input.tagline ?? "").slice(0, 120), description: (input.description ?? "").slice(0, 600), updatedAt: at };
  if (input.id) {
    const [old] = await db.select().from(schema.brands).where(eq(schema.brands.id, input.id)).limit(1);
    if (!old) return { ok: false, message: "Merek tidak ditemukan." };
    await db.update(schema.brands).set(values).where(eq(schema.brands.id, input.id));
    const products = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.brandId, input.id));
    await writeAudit(db, { staff, action: "merek.ubah", objectType: "merek", objectId: slug, summary: `Ubah merek ${old.name}`, before: { nama: old.name, warna: old.color, slug: old.slug }, after: { nama: name, warna: values.color, slug }, at });
    // Warna merek dipakai ProductArt di semua produknya: revalidasi halaman merek dan produk terkait.
    return { ok: true, id: input.id, tags: ["brands", "products", `brand:${old.slug}`, `brand:${slug}`, ...products.map((p) => `product:${p.slug}`)] };
  }
  const [{ n }] = await db.select({ n: count() }).from(schema.brands);
  const [row] = await db.insert(schema.brands).values({ ...values, sortOrder: Number(n), createdAt: at }).returning({ id: schema.brands.id });
  await writeAudit(db, { staff, action: "merek.tambah", objectType: "merek", objectId: slug, summary: `Tambah merek ${name}`, after: { nama: name, warna: values.color }, at });
  return { ok: true, id: row.id, tags: ["brands"] };
}

export async function deleteBrand(db: AnyDb, staff: StaffPrincipal, id: number, opts: { now?: Date } = {}): Promise<TaxonomyResult> {
  if (!can(staff, "kategori.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola merek." };
  const [b] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!b) return { ok: false, message: "Merek tidak ditemukan." };
  const [{ n }] = await db.select({ n: count() }).from(schema.products).where(eq(schema.products.brandId, id));
  if (Number(n) > 0) return { ok: false, message: `Merek ini masih punya ${n} produk.` };
  await db.delete(schema.brands).where(eq(schema.brands.id, id));
  await writeAudit(db, { staff, action: "merek.hapus", objectType: "merek", objectId: b.slug, summary: `Hapus merek ${b.name}`, at: opts.now });
  return { ok: true, tags: ["brands", `brand:${b.slug}`] };
}

export const rootCategories = (db: AnyDb) => db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).where(isNull(schema.categories.parentId)).orderBy(asc(schema.categories.sortOrder));
export const leafCategories = async (db: AnyDb) => {
  const parents = await rootCategories(db);
  const kids = await db.select({ id: schema.categories.id, name: schema.categories.name, parentId: schema.categories.parentId }).from(schema.categories).where(inArray(schema.categories.parentId, parents.map((p) => p.id).length ? parents.map((p) => p.id) : [-1])).orderBy(asc(schema.categories.sortOrder));
  return parents.map((p) => ({ ...p, children: kids.filter((k) => k.parentId === p.id) }));
};
