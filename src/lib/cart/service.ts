// Keranjang di server. Semua fungsi menerima db supaya bisa diuji. Harga dan stok selalu dihitung ulang di sini.
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Packaging } from "@/db/schema/enums";
import type { AnyDb } from "@/lib/db-types";
import { formatRupiah } from "@/lib/format";
import { availabilityByVariant } from "@/lib/inventory";
import { buildPricingLines, loadVoucher, type Buyer } from "@/lib/orders/pricing-loader";
import { MAX_QTY_PER_ITEM, mergeCartItems } from "@/lib/orders/rules";
import { priceCart, type PricedCart, type PriceSegment } from "@/lib/pricing/cart";

export type CartLine = {
  itemId: number;
  variantId: number;
  productId: number;
  productSlug: string;
  productName: string;
  brandName: string;
  brandColor: string;
  packaging: Packaging;
  shadeName: string;
  shadeSlug: string;
  hex: string;
  showShade: boolean;
  quantity: number;
  maxQty: number;
  unitPrice: number;
  normalPrice: number;
  segments: PriceSegment[];
  lineTotal: number;
  hasFlash: boolean;
  flashLimited: boolean;
  notices: string[];
};

export type SavedLine = Omit<CartLine, "segments" | "lineTotal" | "hasFlash" | "flashLimited" | "maxQty"> & { inStock: boolean };

export type CartView = {
  cartId: number;
  lines: CartLine[];
  saved: SavedLine[];
  pricing: PricedCart;
  voucherCode: string | null;
  notices: string[];
  count: number;
};

export async function findCartByToken(db: AnyDb, token: string | null | undefined) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [cart] = await db.select({ id: schema.carts.id, voucherCode: schema.carts.voucherCode }).from(schema.carts).where(eq(schema.carts.guestToken, token)).limit(1);
  return cart ?? null;
}

export async function createCart(db: AnyDb) {
  const token = randomUUID();
  const [cart] = await db.insert(schema.carts).values({ guestToken: token }).returning({ id: schema.carts.id });
  return { id: cart.id, token };
}

// Keranjang akun: satu per pembeli, tanpa token tamu.
export async function findCartByCustomer(db: AnyDb, customerId: number) {
  const [cart] = await db.select({ id: schema.carts.id, voucherCode: schema.carts.voucherCode }).from(schema.carts).where(eq(schema.carts.customerId, customerId)).orderBy(asc(schema.carts.id)).limit(1);
  return cart ?? null;
}

export async function ensureCustomerCart(db: AnyDb, customerId: number) {
  const found = await findCartByCustomer(db, customerId);
  if (found) return found;
  const [cart] = await db.insert(schema.carts).values({ customerId }).returning({ id: schema.carts.id, voucherCode: schema.carts.voucherCode });
  return cart;
}

export async function cartCount(db: AnyDb, cartId: number) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${schema.cartItems.quantity}), 0)::int` })
    .from(schema.cartItems)
    .where(and(eq(schema.cartItems.cartId, cartId), eq(schema.cartItems.savedForLater, false)));
  return Number(row?.n ?? 0);
}

const maxAvailable = (byLoc: Map<number, number> | undefined) => Math.max(0, ...(byLoc ? [...byLoc.values()] : [0]));

export type AddResult = { ok: true; added: number; message?: string } | { ok: false; message: string };

// Tambah item. Jumlah dibatasi stok terbanyak di satu lokasi dan maksimal 10 per item.
export async function addItems(db: AnyDb, cartId: number, items: { variantId: number; quantity: number }[]): Promise<AddResult> {
  const clean = items.filter((i) => Number.isInteger(i.variantId) && i.quantity > 0).map((i) => ({ variantId: i.variantId, quantity: Math.min(MAX_QTY_PER_ITEM, Math.trunc(i.quantity)) }));
  if (clean.length === 0) return { ok: false, message: "Tidak ada produk yang ditambahkan." };
  const { meta } = await buildPricingLines(db, clean, { customerId: null, phone: null }, new Date(0));
  const avail = await availabilityByVariant(db, clean.map((i) => i.variantId));
  const existing = await db.select().from(schema.cartItems).where(and(eq(schema.cartItems.cartId, cartId), inArray(schema.cartItems.variantId, clean.map((i) => i.variantId))));
  let added = 0;
  let message: string | undefined;
  for (const it of clean) {
    const m = meta.get(it.variantId);
    if (!m || !m.active) {
      message = "Produk ini sudah tidak dijual.";
      continue;
    }
    const max = Math.min(MAX_QTY_PER_ITEM, maxAvailable(avail.get(it.variantId)));
    if (max <= 0) {
      message = `${m.variantCount > 1 ? `Shade ${m.shadeName}` : m.productName} sedang habis.`;
      continue;
    }
    const cur = existing.find((e) => e.variantId === it.variantId);
    const base = cur && !cur.savedForLater ? cur.quantity : 0;
    const qty = Math.min(max, base + it.quantity);
    if (qty < base + it.quantity) message = `Stok tersedia tinggal ${max}, jumlah kami sesuaikan.`;
    if (cur) await db.update(schema.cartItems).set({ quantity: qty, savedForLater: false, updatedAt: sql`now()` }).where(eq(schema.cartItems.id, cur.id));
    else await db.insert(schema.cartItems).values({ cartId, variantId: it.variantId, quantity: qty });
    added += qty - base;
  }
  await db.update(schema.carts).set({ updatedAt: sql`now()` }).where(eq(schema.carts.id, cartId));
  if (added === 0) return { ok: false, message: message ?? "Produk tidak bisa ditambahkan." };
  return { ok: true, added, message };
}

export async function setItemQuantity(db: AnyDb, cartId: number, itemId: number, quantity: number) {
  const q = Math.max(1, Math.min(MAX_QTY_PER_ITEM, Math.trunc(quantity)));
  await db.update(schema.cartItems).set({ quantity: q, updatedAt: sql`now()` }).where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cartId)));
}

export async function removeItem(db: AnyDb, cartId: number, itemId: number) {
  await db.delete(schema.cartItems).where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cartId)));
}

export async function setItemSaved(db: AnyDb, cartId: number, itemId: number, saved: boolean) {
  await db.update(schema.cartItems).set({ savedForLater: saved, updatedAt: sql`now()` }).where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cartId)));
}

export async function setCartVoucher(db: AnyDb, cartId: number, code: string | null) {
  const clean = code?.trim().toUpperCase().slice(0, 40) || null;
  await db.update(schema.carts).set({ voucherCode: clean, updatedAt: sql`now()` }).where(eq(schema.carts.id, cartId));
}

function describe(m: { productName: string; shadeName: string; variantCount: number }) {
  return m.variantCount > 1 ? `${m.productName} (${m.shadeName})` : m.productName;
}

// Tampilan keranjang dengan validasi ulang: varian nonaktif dihapus, stok habis dipindah ke Simpan untuk nanti,
// jumlah disesuaikan stok, dan perubahan harga (misal flash sale berakhir) diberitahukan sekali.
export async function viewCart(db: AnyDb, cartId: number, opts: { now: Date; buyer?: Buyer; voucherOverride?: string | null }): Promise<CartView> {
  const buyer = opts.buyer ?? { customerId: null, phone: null };
  const [cart] = await db.select({ id: schema.carts.id, voucherCode: schema.carts.voucherCode }).from(schema.carts).where(eq(schema.carts.id, cartId));
  const rows = await db.select().from(schema.cartItems).where(eq(schema.cartItems.cartId, cartId)).orderBy(asc(schema.cartItems.createdAt), asc(schema.cartItems.id));
  const variantIds = rows.map((r) => r.variantId);
  const [{ meta }, avail] = await Promise.all([buildPricingLines(db, rows.map((r) => ({ variantId: r.variantId, quantity: 1 })), buyer, opts.now), availabilityByVariant(db, variantIds)]);
  const notices: string[] = [];
  const itemNotices = new Map<number, string[]>();
  const pushNotice = (id: number, text: string) => itemNotices.set(id, [...(itemNotices.get(id) ?? []), text]);

  const active: typeof rows = [];
  const saved: typeof rows = [];
  for (const r of rows) {
    const m = meta.get(r.variantId);
    if (!m || !m.active) {
      await db.delete(schema.cartItems).where(eq(schema.cartItems.id, r.id));
      notices.push(`${m ? describe(m) : "Satu produk"} sudah tidak dijual, kami hapus dari keranjang.`);
      continue;
    }
    if (r.savedForLater) {
      saved.push(r);
      continue;
    }
    const max = Math.min(MAX_QTY_PER_ITEM, maxAvailable(avail.get(r.variantId)));
    if (max <= 0) {
      await db.update(schema.cartItems).set({ savedForLater: true, updatedAt: sql`now()` }).where(eq(schema.cartItems.id, r.id));
      r.savedForLater = true;
      saved.push(r);
      notices.push(`${describe(m)} sedang habis, kami pindahkan ke Simpan untuk nanti.`);
      continue;
    }
    if (r.quantity > max) {
      await db.update(schema.cartItems).set({ quantity: max, updatedAt: sql`now()` }).where(eq(schema.cartItems.id, r.id));
      pushNotice(r.id, `Stok tinggal ${max}, jumlah kami sesuaikan dari ${r.quantity}.`);
      r.quantity = max;
    }
    active.push(r);
  }

  const voucherCode = opts.voucherOverride !== undefined ? opts.voucherOverride : (cart?.voucherCode ?? null);
  const { lines } = await buildPricingLines(db, active.map((r) => ({ variantId: r.variantId, quantity: r.quantity })), buyer, opts.now);
  const voucher = voucherCode ? await loadVoucher(db, voucherCode, buyer) : null;
  const pricing = priceCart({ lines, now: opts.now, voucherCode, voucher });

  const cartLines: CartLine[] = [];
  for (let i = 0; i < active.length; i++) {
    const r = active[i];
    const m = meta.get(r.variantId)!;
    const pl = pricing.lines[i];
    const unitPrice = pl.segments[0]?.unitPrice ?? m.line.salePrice;
    const source = pl.segments[0]?.source ?? "normal";
    if (r.seenPrice != null && r.seenPrice !== unitPrice) {
      if (r.seenSource === "flash" && source !== "flash") pushNotice(r.id, `Flash sale sudah berakhir, harga kembali ke ${formatRupiah(unitPrice)}.`);
      else if (unitPrice > r.seenPrice) pushNotice(r.id, `Harga naik dari ${formatRupiah(r.seenPrice)} ke ${formatRupiah(unitPrice)}.`);
      else pushNotice(r.id, `Kabar baik, harga turun dari ${formatRupiah(r.seenPrice)} ke ${formatRupiah(unitPrice)}.`);
    }
    if (r.seenPrice !== unitPrice || r.seenSource !== source) {
      await db.update(schema.cartItems).set({ seenPrice: unitPrice, seenSource: source }).where(eq(schema.cartItems.id, r.id));
    }
    if (pl.flashLimited) {
      const flashQty = pl.segments.find((s) => s.source === "flash")?.quantity ?? 0;
      pushNotice(r.id, flashQty > 0 ? `Harga flash berlaku untuk ${flashQty} unit; sisanya harga biasa.` : "Batas beli flash sale untuk produk ini sudah tercapai, harga biasa berlaku.");
    }
    cartLines.push({
      itemId: r.id,
      variantId: r.variantId,
      productId: m.productId,
      productSlug: m.productSlug,
      productName: m.productName,
      brandName: m.brandName,
      brandColor: m.brandColor,
      packaging: m.packaging,
      shadeName: m.shadeName,
      shadeSlug: m.shadeSlug,
      hex: m.hex,
      showShade: m.variantCount > 1,
      quantity: r.quantity,
      maxQty: Math.min(MAX_QTY_PER_ITEM, maxAvailable(avail.get(r.variantId))),
      unitPrice,
      normalPrice: m.line.normalPrice,
      segments: pl.segments,
      lineTotal: pl.lineTotal,
      hasFlash: pl.hasFlash,
      flashLimited: pl.flashLimited,
      notices: itemNotices.get(r.id) ?? [],
    });
  }

  const savedLines: SavedLine[] = saved.map((r) => {
    const m = meta.get(r.variantId)!;
    return {
      itemId: r.id,
      variantId: r.variantId,
      productId: m.productId,
      productSlug: m.productSlug,
      productName: m.productName,
      brandName: m.brandName,
      brandColor: m.brandColor,
      packaging: m.packaging,
      shadeName: m.shadeName,
      shadeSlug: m.shadeSlug,
      hex: m.hex,
      showShade: m.variantCount > 1,
      quantity: r.quantity,
      unitPrice: m.line.salePrice,
      normalPrice: m.line.normalPrice,
      notices: [],
      inStock: maxAvailable(avail.get(r.variantId)) > 0,
    };
  });

  return { cartId, lines: cartLines, saved: savedLines, pricing, voucherCode, notices, count: cartLines.reduce((n, l) => n + l.quantity, 0) };
}

// Pindahkan isi keranjang lokal (Fase 2) ke server, satu kali.
export async function importItems(db: AnyDb, cartId: number, items: { variantId: number; quantity: number }[]) {
  const map = new Map<number, number>();
  for (const it of items) if (Number.isInteger(it.variantId) && it.quantity > 0) map.set(it.variantId, (map.get(it.variantId) ?? 0) + Math.trunc(it.quantity));
  if (map.size === 0) return;
  await addItems(db, cartId, [...map.entries()].map(([variantId, quantity]) => ({ variantId, quantity })));
}

// Gabung keranjang tamu ke keranjang akun saat login (dipakai Fase 5).
export async function mergeGuestCartIntoCustomer(db: AnyDb, guestToken: string, customerId: number) {
  return db.transaction(async (tx) => {
    const guest = await findCartByToken(tx, guestToken);
    if (!guest) return null;
    let [account] = await tx.select({ id: schema.carts.id }).from(schema.carts).where(eq(schema.carts.customerId, customerId)).limit(1).for("update");
    if (!account) {
      await tx.update(schema.carts).set({ customerId, guestToken: null }).where(eq(schema.carts.id, guest.id));
      return guest.id;
    }
    if (account.id === guest.id) return account.id;
    const [accItems, guestItems] = await Promise.all([
      tx.select().from(schema.cartItems).where(eq(schema.cartItems.cartId, account.id)),
      tx.select().from(schema.cartItems).where(eq(schema.cartItems.cartId, guest.id)),
    ]);
    const merged = mergeCartItems(accItems, guestItems);
    await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, account.id));
    if (merged.length) await tx.insert(schema.cartItems).values(merged.map((m) => ({ cartId: account.id, variantId: m.variantId, quantity: m.quantity, savedForLater: m.savedForLater })));
    await tx.delete(schema.carts).where(eq(schema.carts.id, guest.id));
    account = { id: account.id };
    return account.id;
  });
}
