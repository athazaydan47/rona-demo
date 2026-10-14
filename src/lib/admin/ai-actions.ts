"use server";

// Server action AI untuk admin (Fase 7B): penulis deskripsi dan SEO, usulan massal, dan draf balasan ulasan.
// Semuanya hanya menyiapkan usulan; staf yang memeriksa dan menyimpan lewat aksi yang sudah ada.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { aiConfig, aiModel } from "@/lib/ai";
import { draftReply, type ReplyDraft } from "@/lib/ai/balasan";
import { DESCRIPTION_FIELDS, writeDescription, type DescriptionExample, type DescriptionInput, type DescriptionResult } from "@/lib/ai/penulis";
import { cacheSet, globalCapReached, logAi } from "@/lib/ai/usage";
import { now } from "@/lib/clock";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { loadSettings } from "@/lib/settings/db";
import { currentStaff } from "./current";
import { can } from "./permissions";

const NO_SESSION = { ok: false as const, message: "Sesi staf berakhir. Masuk lagi, ya." };
const DENIED = { ok: false as const, message: "Kamu tidak punya izin untuk ini." };
const UNAVAILABLE = { ok: false as const, message: "Fitur AI sedang tidak tersedia. Kamu tetap bisa menulis sendiri." };
const DESCRIPTION_DRAFT_DAYS = 7;
const MAX_BULK = 8;

async function ready() {
  const cfg = aiConfig();
  const model = aiModel(cfg);
  if (!model) return null;
  if (await globalCapReached(db, cfg, now()).catch(() => true)) return null;
  return model;
}

async function examples(slugs: string[]): Promise<DescriptionExample[]> {
  if (!slugs.length) return [];
  const rows = await db.select({ slug: schema.products.slug, name: schema.products.name, ringkas: schema.products.shortDescription, manfaat: schema.products.benefits, caraPakai: schema.products.howToUse }).from(schema.products).where(inArray(schema.products.slug, slugs));
  return slugs.flatMap((s) => {
    const r = rows.find((x) => x.slug === s);
    return r ? [{ name: r.name, ringkas: r.ringkas, manfaat: r.manfaat, caraPakai: r.caraPakai }] : [];
  });
}

export type DescriptionRequest = Omit<DescriptionInput, "current"> & { current: Partial<Record<(typeof DESCRIPTION_FIELDS)[number], string>> };

export async function draftDescriptionAction(input: DescriptionRequest): Promise<DescriptionResult> {
  const me = await currentStaff();
  if (!me) return NO_SESSION;
  if (!can(me, "produk.kelola")) return DENIED;
  const model = await ready();
  if (!model) return UNAVAILABLE;
  const settings = await loadSettings(db);
  const t0 = Date.now();
  const clean: DescriptionInput = {
    name: String(input.name ?? "").slice(0, 120),
    brand: String(input.brand ?? "").slice(0, 60),
    category: String(input.category ?? "").slice(0, 60),
    activeIngredients: (Array.isArray(input.activeIngredients) ? input.activeIngredients : []).map(String).slice(0, 15),
    skinTypes: (Array.isArray(input.skinTypes) ? input.skinTypes : []).map(String).slice(0, 6),
    finish: input.finish ? String(input.finish) : null,
    spf: Number.isInteger(input.spf) ? Number(input.spf) : null,
    netto: String(input.netto ?? "").slice(0, 40),
    bpom: String(input.bpom ?? "").slice(0, 40),
    points: String(input.points ?? "").slice(0, 2000),
    supplierText: String(input.supplierText ?? "").slice(0, 4000),
    current: input.current ?? {},
    variation: input.variation === "lebih_singkat" || input.variation === "lebih_santai" ? input.variation : null,
  };
  const r = await writeDescription(model, clean, settings.gaya, await examples(settings.gaya.contohProduk));
  await logAi(db, { feature: "deskripsi", model: model.name, inputTokens: r.ok ? r.usage.input : 0, outputTokens: r.ok ? r.usage.output : 0, latencyMs: Date.now() - t0, ok: r.ok, error: r.ok ? null : r.message, staffId: me.id, door: "panel", visitorHash: `staf:${me.id}`, at: now() }).catch(() => {});
  return r;
}

// Usulan deskripsi massal untuk produk berdeskripsi kosong atau pendek. Usulan disimpan sementara (7 hari) di cache AI
// per slug produk; formulir produk menampilkannya untuk ditinjau. Data produk tidak berubah.
export async function bulkDescriptionAction(productIds: number[]) {
  const me = await currentStaff();
  if (!me) return NO_SESSION;
  if (!can(me, "produk.kelola")) return DENIED;
  const model = await ready();
  if (!model) return UNAVAILABLE;
  const ids = [...new Set((Array.isArray(productIds) ? productIds : []).map(Number).filter(Number.isInteger))].slice(0, MAX_BULK);
  if (!ids.length) return { ok: false as const, message: "Pilih produknya dulu." };
  const settings = await loadSettings(db);
  const ex = await examples(settings.gaya.contohProduk);
  const rows = await db
    .select({ id: schema.products.id, slug: schema.products.slug, name: schema.products.name, brand: schema.brands.name, category: schema.categories.name, activeIngredients: schema.products.activeIngredients, skinTypes: schema.products.skinTypes, finish: schema.products.finish, spf: schema.products.spf, netto: schema.products.netto, bpom: schema.products.bpom, shortDescription: schema.products.shortDescription, benefits: schema.products.benefits, ingredients: schema.products.ingredients, howToUse: schema.products.howToUse })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(inArray(schema.products.id, ids));
  const done: { id: number; name: string; ok: boolean; message?: string }[] = [];
  for (const p of rows) {
    const t0 = Date.now();
    const r = await writeDescription(model, { name: p.name, brand: p.brand, category: p.category, activeIngredients: p.activeIngredients, skinTypes: p.skinTypes, finish: p.finish, spf: p.spf, netto: p.netto, bpom: p.bpom, points: "", supplierText: "", current: { ringkas: p.shortDescription, manfaat: p.benefits, kandungan: p.ingredients, caraPakai: p.howToUse } }, settings.gaya, ex);
    await logAi(db, { feature: "deskripsi", model: model.name, inputTokens: r.ok ? r.usage.input : 0, outputTokens: r.ok ? r.usage.output : 0, latencyMs: Date.now() - t0, ok: r.ok, staffId: me.id, door: "panel", visitorHash: `staf:${me.id}`, at: now() }).catch(() => {});
    if (r.ok) await cacheSet(db, `deskripsi:${p.slug}`, "deskripsi", { draft: r.draft, issues: r.issues, by: me.name }, DESCRIPTION_DRAFT_DAYS, now());
    done.push({ id: p.id, name: p.name, ok: r.ok, ...(r.ok ? {} : { message: r.message }) });
  }
  return { ok: true as const, done };
}

async function reviewInput(id: number) {
  const [r] = await db
    .select({ id: schema.reviews.id, rating: schema.reviews.rating, body: schema.reviews.body, authorName: schema.reviews.authorName, productName: schema.products.name, shadeName: schema.variants.shadeName, orderStatus: schema.orders.status })
    .from(schema.reviews)
    .innerJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
    .leftJoin(schema.variants, eq(schema.reviews.variantId, schema.variants.id))
    .leftJoin(schema.orderItems, eq(schema.reviews.orderItemId, schema.orderItems.id))
    .leftJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(eq(schema.reviews.id, id))
    .limit(1);
  return r ? { ...r, orderStatus: r.orderStatus ? statusLabels[r.orderStatus as OrderStatus] : null } : null;
}

export async function draftReplyAction(reviewId: number): Promise<ReplyDraft> {
  const me = await currentStaff();
  if (!me) return NO_SESSION;
  if (!can(me, "ulasan.kelola")) return DENIED;
  const model = await ready();
  if (!model) return UNAVAILABLE;
  const r = await reviewInput(Number(reviewId));
  if (!r) return { ok: false, message: "Ulasan tidak ditemukan." };
  const t0 = Date.now();
  const d = await draftReply(model, r, (await loadSettings(db)).gaya);
  await logAi(db, { feature: "balasan_ulasan", model: model.name, inputTokens: d.ok ? d.usage.input : 0, outputTokens: d.ok ? d.usage.output : 0, latencyMs: Date.now() - t0, ok: d.ok, staffId: me.id, door: "panel", visitorHash: `staf:${me.id}`, at: now() }).catch(() => {});
  return d;
}

// Draf untuk banyak ulasan yang belum dibalas (maksimal 8), ditinjau satu per satu di dialog moderasi.
export async function bulkReplyDraftAction(reviewIds: number[]) {
  const me = await currentStaff();
  if (!me) return NO_SESSION;
  if (!can(me, "ulasan.kelola")) return DENIED;
  const model = await ready();
  if (!model) return UNAVAILABLE;
  const ids = [...new Set((Array.isArray(reviewIds) ? reviewIds : []).map(Number).filter(Number.isInteger))].slice(0, MAX_BULK);
  const open = ids.length ? await db.select({ id: schema.reviews.id }).from(schema.reviews).where(and(inArray(schema.reviews.id, ids), isNull(schema.reviews.storeReply))) : [];
  const style = (await loadSettings(db)).gaya;
  const drafts: { id: number; text: string | null; message?: string }[] = [];
  for (const { id } of open) {
    const r = await reviewInput(id);
    if (!r) continue;
    const t0 = Date.now();
    const d = await draftReply(model, r, style);
    await logAi(db, { feature: "balasan_ulasan", model: model.name, inputTokens: d.ok ? d.usage.input : 0, outputTokens: d.ok ? d.usage.output : 0, latencyMs: Date.now() - t0, ok: d.ok, staffId: me.id, door: "panel", visitorHash: `staf:${me.id}`, at: now() }).catch(() => {});
    drafts.push(d.ok ? { id, text: d.text } : { id, text: null, message: d.message });
  }
  return { ok: true as const, drafts };
}
