// Layanan pesanan: buat pesanan dalam satu transaksi, transisi status, konfirmasi pembayaran, kedaluwarsa.
// Semua fungsi menerima db sebagai parameter supaya bisa diuji dengan koneksi sendiri.
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { OrderAddressSnapshot, OrderPricingSnapshot } from "@/db/schema";
import { now as clockNow } from "@/lib/clock";
import type { AnyDb } from "@/lib/db-types";
import { available, commitReserved, lockInventory, release, reserve, restock, type LockedRow } from "@/lib/inventory";
import { priceCart, type PricedCart } from "@/lib/pricing/cart";
import type { CourierCode, Zone } from "@/lib/shipping";
import { orderMessage, type OrderEvent } from "./messages";
import { buildPricingLines, loadVoucher, type Buyer } from "./pricing-loader";
import { formatOrderNumber, isExpired, normalizePhone, orderPeriod, paymentDeadline } from "./rules";
import { assertTransition, statusLabels, type OrderStatus } from "./status";

export type PaymentMethod = "qris" | "va_bca" | "va_bni" | "va_bri" | "va_mandiri" | "bayar_di_toko";
export const ONLINE_METHODS: PaymentMethod[] = ["qris", "va_bca", "va_bni", "va_bri", "va_mandiri"];
export const WAREHOUSE_SLUG = "gudang-online";

export type PlaceOrderInput = {
  cartId: number;
  buyer: { name: string; phone: string; email?: string | null; customerId?: number | null };
  method: "kirim" | "ambil";
  address?: OrderAddressSnapshot | null;
  zone?: Zone | null;
  courierCode?: CourierCode | null;
  pickupLocationSlug?: string | null;
  paymentMethod: PaymentMethod;
  voucherCode?: string | null;
  note?: string | null;
  expectedTotal: number;
  siteUrl?: string;
  now?: Date;
};

export type FailureCode = "data_tidak_valid" | "keranjang_kosong" | "lokasi" | "stok_kurang" | "harga_berubah" | "voucher";

export type PlaceOrderResult =
  | { ok: true; orderId: number; number: string; accessToken: string; total: number; paymentMethod: PaymentMethod }
  | { ok: false; code: FailureCode; message: string; pricing?: PricedCart; shortages?: { variantId: number; name: string; available: number; requested: number }[] };

class Failure extends Error {
  constructor(public result: Extract<PlaceOrderResult, { ok: false }>) {
    super(result.message);
  }
}

const fail = (code: FailureCode, message: string, extra: Partial<Extract<PlaceOrderResult, { ok: false }>> = {}) => new Failure({ ok: false, code, message, ...extra });

const COURIER_LABEL: Record<string, string> = {
  jne_reg: "JNE REG",
  jne_yes: "JNE YES",
  jnt_ez: "J&T EZ",
  sicepat_reg: "SiCepat REG",
  instan: "Kurir Instan",
  ambil_di_toko: "Ambil di Toko",
};
export const courierLabel = (code: string | null | undefined) => (code ? (COURIER_LABEL[code] ?? code) : "");

function vaNumber(method: PaymentMethod, seq: number, phone: string) {
  const prefix: Record<string, string> = { va_bca: "39358", va_bni: "8810", va_bri: "26215", va_mandiri: "89608" };
  const p = prefix[method];
  if (!p) return null;
  const tail = `${String(seq).padStart(5, "0")}${phone.slice(-6)}`;
  return (p + tail).slice(0, 16).padEnd(16, "0");
}

function qrPayload(number: string, amount: number) {
  // Payload dummy bergaya EMV QRIS, hanya untuk demo.
  return `00020101021226570014ID.RONA.DEMO01${String(number.length).padStart(2, "0")}${number}5204597753033605${String(String(amount).length).padStart(2, "0")}${amount}5802ID5911RONA BEAUTY6006MALANG6304DEMO`;
}

async function nextOrderNumber(tx: AnyDb, at: Date) {
  const period = orderPeriod(at);
  const rows = await tx.execute<{ last_value: number }>(
    sql`insert into order_number_counters (period, last_value) values (${period}, 1)
        on conflict (period) do update set last_value = order_number_counters.last_value + 1
        returning last_value`,
  );
  const seq = Number((rows as unknown as { last_value: number }[])[0]?.last_value);
  return { number: formatOrderNumber(period, seq), seq };
}

export async function placeOrder(db: AnyDb, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const at = input.now ?? clockNow();
  const phone = normalizePhone(input.buyer.phone);
  const name = input.buyer.name.trim();
  if (!name || name.length < 2) return { ok: false, code: "data_tidak_valid", message: "Isi nama penerima." };
  if (!phone) return { ok: false, code: "data_tidak_valid", message: "Nomor WhatsApp tidak valid." };
  if (input.paymentMethod === "bayar_di_toko" && input.method !== "ambil") return { ok: false, code: "data_tidak_valid", message: "Bayar di Toko hanya untuk Ambil di Toko." };
  if (input.method === "kirim" && (!input.address || !input.zone || !input.courierCode || input.courierCode === "ambil_di_toko")) {
    return { ok: false, code: "data_tidak_valid", message: "Lengkapi alamat dan pilih kurir." };
  }
  if (input.method === "ambil" && !input.pickupLocationSlug) return { ok: false, code: "data_tidak_valid", message: "Pilih cabang untuk mengambil pesanan." };
  const buyer: Buyer = { customerId: input.buyer.customerId ?? null, phone };

  try {
    return await db.transaction(async (tx) => {
      // Kunci keranjang supaya klik ganda tidak membuat dua pesanan.
      const [cart] = await tx.select({ id: schema.carts.id }).from(schema.carts).where(eq(schema.carts.id, input.cartId)).for("update");
      if (!cart) throw fail("keranjang_kosong", "Keranjangmu kosong.");
      const items = await tx
        .select({ variantId: schema.cartItems.variantId, quantity: schema.cartItems.quantity })
        .from(schema.cartItems)
        .where(and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.savedForLater, false)))
        .orderBy(asc(schema.cartItems.id));
      if (items.length === 0) throw fail("keranjang_kosong", "Keranjangmu kosong.");

      const sourceSlug = input.method === "kirim" ? WAREHOUSE_SLUG : input.pickupLocationSlug!;
      const [location] = await tx.select().from(schema.locations).where(eq(schema.locations.slug, sourceSlug)).limit(1);
      if (!location || !location.isActive || (input.method === "ambil" && !location.canPickup)) throw fail("lokasi", "Cabang yang dipilih tidak tersedia.");

      const locked = await lockInventory(
        tx,
        items.map((i) => ({ variantId: i.variantId, locationId: location.id })),
      );
      const { lines, meta } = await buildPricingLines(tx, items, buyer, at, { lockFlash: true });
      if (lines.length !== items.length || items.some((i) => !meta.get(i.variantId)?.active)) {
        throw fail("harga_berubah", "Ada produk di keranjang yang sudah tidak dijual. Buka keranjang untuk memperbarui.");
      }
      const voucher = await loadVoucher(tx, input.voucherCode, buyer, { lock: true });
      const pricing = priceCart({
        lines,
        now: at,
        voucherCode: input.voucherCode,
        voucher,
        shipping: input.method === "ambil" ? { method: "ambil" } : { method: "kirim", courierCode: input.courierCode!, zone: input.zone! },
      });
      if (input.voucherCode && !pricing.voucher?.applied) throw fail("voucher", pricing.voucher?.message ?? "Voucher tidak bisa dipakai.", { pricing });
      if (input.method === "kirim" && pricing.shipping && pricing.shipping.cost === 0) throw fail("data_tidak_valid", "Kurir ini tidak melayani alamat tujuan.", { pricing });
      if (pricing.total !== input.expectedTotal) {
        throw fail("harga_berubah", "Total belanja berubah sejak terakhir kamu lihat (misalnya flash sale berakhir atau stok berubah). Cek ringkasan terbaru lalu buat pesanan lagi.", { pricing });
      }

      const shortages = items
        .map((i) => {
          const row = locked.get(`${i.variantId}:${location.id}`) as LockedRow;
          const m = meta.get(i.variantId)!;
          return { variantId: i.variantId, name: m.variantCount > 1 ? `${m.productName}, ${m.shadeName}` : m.productName, available: available(row), requested: i.quantity };
        })
        .filter((s) => s.available < s.requested);
      if (shortages.length) {
        const s = shortages[0];
        const where = input.method === "kirim" ? "di gudang" : `di ${location.name}`;
        throw fail("stok_kurang", s.available === 0 ? `Maaf, ${s.name} baru saja habis ${where}.` : `Maaf, stok ${s.name} ${where} tinggal ${s.available}.`, { shortages });
      }

      const { number, seq } = await nextOrderNumber(tx, at);
      const accessToken = randomBytes(16).toString("hex");
      const expiresAt = paymentDeadline({ paymentMethod: input.paymentMethod, now: at, openingHours: location.openingHours });
      const snapshot: OrderPricingSnapshot = {
        normalSubtotal: pricing.normalSubtotal,
        subtotal: pricing.subtotal,
        productDiscount: pricing.productDiscount,
        voucherCode: pricing.voucher?.applied ? pricing.voucher.code : null,
        voucherDiscount: pricing.voucherDiscount,
        shippingCost: pricing.shipping?.cost ?? 0,
        shippingDiscount: pricing.shipping?.discount ?? 0,
        pointsUsed: pricing.points.used,
        total: pricing.total,
        weightGram: pricing.weightGram,
        billableKg: pricing.shipping?.billableKg ?? 0,
      };
      const [order] = await tx
        .insert(schema.orders)
        .values({
          number,
          customerId: buyer.customerId,
          guestName: name,
          guestPhone: phone,
          guestEmail: input.buyer.email?.trim() || null,
          method: input.method,
          locationId: location.id,
          shippingAddress: input.method === "kirim" ? input.address! : null,
          courier: input.method === "kirim" ? input.courierCode! : "ambil_di_toko",
          service: input.method === "kirim" ? courierLabel(input.courierCode) : location.name,
          shippingCost: snapshot.shippingCost,
          shippingDiscount: snapshot.shippingDiscount,
          subtotal: pricing.subtotal,
          productDiscount: pricing.productDiscount,
          voucherDiscount: pricing.voucherDiscount,
          discount: pricing.voucherDiscount + snapshot.shippingDiscount,
          pricing: snapshot,
          voucherCode: snapshot.voucherCode,
          pointsUsed: pricing.points.used,
          total: pricing.total,
          status: "menunggu_pembayaran",
          expiresAt,
          note: (input.note ?? "").trim().slice(0, 300),
          accessToken,
          createdAt: at,
          updatedAt: at,
        })
        .returning({ id: schema.orders.id });

      const orderItemRows = pricing.lines.flatMap((pl, idx) => {
        const m = meta.get(pl.variantId)!;
        return pl.segments.map((s) => ({
          orderId: order.id,
          variantId: pl.variantId,
          productName: m.productName,
          shadeName: m.shadeName,
          brandName: m.brandName,
          unitPrice: s.unitPrice,
          normalPrice: lines[idx].normalPrice,
          quantity: s.quantity,
          priceSource: s.source,
          flashSaleItemId: s.flashSaleItemId,
          weightGram: m.weightGram,
        }));
      });
      await tx.insert(schema.orderItems).values(orderItemRows);

      await tx.insert(schema.payments).values({
        orderId: order.id,
        method: input.paymentMethod,
        vaNumber: vaNumber(input.paymentMethod, seq, phone),
        qrPayload: input.paymentMethod === "qris" ? qrPayload(number, pricing.total) : null,
        amount: pricing.total,
        status: "menunggu",
        idempotencyKey: `pay_${number}_${randomBytes(6).toString("hex")}`,
        expiresAt,
        createdAt: at,
      });

      await tx.insert(schema.orderStatusHistory).values({ orderId: order.id, fromStatus: null, toStatus: "menunggu_pembayaran", actor: "pembeli", reason: null, createdAt: at });

      // Kuota flash sale dan voucher dipakai saat pesanan dibuat; dikembalikan bila batal atau kedaluwarsa.
      const flashUse = new Map<number, number>();
      for (const r of orderItemRows) if (r.flashSaleItemId) flashUse.set(r.flashSaleItemId, (flashUse.get(r.flashSaleItemId) ?? 0) + r.quantity);
      for (const [id, qty] of flashUse) {
        await tx.update(schema.flashSaleItems).set({ sold: sql`${schema.flashSaleItems.sold} + ${qty}` }).where(eq(schema.flashSaleItems.id, id));
      }
      if (voucher && pricing.voucher?.applied) {
        await tx.update(schema.vouchers).set({ used: sql`${schema.vouchers.used} + 1` }).where(eq(schema.vouchers.id, voucher.id));
        await tx.insert(schema.voucherRedemptions).values({ voucherId: voucher.id, customerId: buyer.customerId, guestPhone: phone, orderId: order.id, discount: pricing.voucherDiscount + (pricing.voucher.shippingDiscount ?? 0), redeemedAt: at });
      }

      for (const pl of pricing.lines) {
        await reserve(tx, locked, { variantId: pl.variantId, locationId: location.id, quantity: pl.quantity, reference: number, actor: "sistem", note: "Dipesan pembeli" }, at);
      }

      await tx.delete(schema.cartItems).where(and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.savedForLater, false)));
      await tx.update(schema.carts).set({ voucherCode: null, updatedAt: at }).where(eq(schema.carts.id, cart.id));

      await queueNotifications(tx, order.id, "dibuat", input.siteUrl);
      return { ok: true as const, orderId: order.id, number, accessToken, total: pricing.total, paymentMethod: input.paymentMethod };
    });
  } catch (err) {
    if (err instanceof Failure) return err.result;
    throw err;
  }
}

type LockedOrder = typeof schema.orders.$inferSelect & { paymentMethod: string | null; paymentId: number | null; paymentStatus: string | null };

async function lockOrder(tx: AnyDb, where: { id?: number; number?: string }): Promise<LockedOrder | null> {
  const cond = where.id != null ? eq(schema.orders.id, where.id) : eq(schema.orders.number, where.number ?? "");
  const [order] = await tx.select().from(schema.orders).where(cond).for("update");
  if (!order) return null;
  const [payment] = await tx.select({ id: schema.payments.id, method: schema.payments.method, status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.orderId, order.id)).orderBy(desc(schema.payments.id)).limit(1);
  return { ...order, paymentMethod: payment?.method ?? null, paymentId: payment?.id ?? null, paymentStatus: payment?.status ?? null };
}

export type TransitionOptions = { actor: string; reason?: string | null; now?: Date; payAtStoreHandover?: boolean; trackingNumber?: string | null; siteUrl?: string };

// Satu-satunya jalan mengubah status pesanan. Memvalidasi tabel transisi, menjalankan efek samping, mencatat riwayat.
export async function applyTransition(tx: AnyDb, order: LockedOrder, to: OrderStatus, opts: TransitionOptions) {
  const at = opts.now ?? clockNow();
  const from = order.status as OrderStatus;
  assertTransition(from, to, { method: order.method, paymentMethod: order.paymentMethod, payAtStoreHandover: opts.payAtStoreHandover });
  const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  const perVariant = new Map<number, number>();
  for (const it of items) perVariant.set(it.variantId, (perVariant.get(it.variantId) ?? 0) + it.quantity);
  const keys = [...perVariant.keys()].map((variantId) => ({ variantId, locationId: order.locationId }));
  const patch: Partial<typeof schema.orders.$inferInsert> = { status: to, updatedAt: at };
  let event: OrderEvent | null = null;

  if (to === "dibayar") {
    const locked = await lockInventory(tx, keys);
    for (const [variantId, qty] of perVariant) await commitReserved(tx, locked, { variantId, locationId: order.locationId, quantity: qty, reference: order.number, actor: opts.actor, note: "Pesanan dibayar" }, at);
    if (order.paymentId) await tx.update(schema.payments).set({ status: "lunas", paidAt: at }).where(eq(schema.payments.id, order.paymentId));
    const products = await tx.select({ productId: schema.variants.productId, variantId: schema.variants.id }).from(schema.variants).where(inArray(schema.variants.id, [...perVariant.keys()]));
    const perProduct = new Map<number, number>();
    for (const p of products) perProduct.set(p.productId, (perProduct.get(p.productId) ?? 0) + (perVariant.get(p.variantId) ?? 0));
    for (const [productId, qty] of perProduct) await tx.update(schema.products).set({ soldCount: sql`${schema.products.soldCount} + ${qty}` }).where(eq(schema.products.id, productId));
    patch.paidAt = at;
    event = "dibayar";
  }

  if (to === "dibatalkan") {
    const locked = await lockInventory(tx, keys);
    for (const [variantId, qty] of perVariant) {
      const m = { variantId, locationId: order.locationId, quantity: qty, reference: order.number, actor: opts.actor, note: opts.reason ?? "Pesanan dibatalkan" };
      if (from === "menunggu_pembayaran") await release(tx, locked, m, at);
      else await restock(tx, locked, { ...m, note: `Dikembalikan karena pesanan dibatalkan${opts.reason ? `: ${opts.reason}` : ""}` }, at);
    }
    const flashUse = new Map<number, number>();
    for (const it of items) if (it.flashSaleItemId) flashUse.set(it.flashSaleItemId, (flashUse.get(it.flashSaleItemId) ?? 0) + it.quantity);
    for (const [id, qty] of flashUse) {
      await tx.update(schema.flashSaleItems).set({ sold: sql`greatest(0, ${schema.flashSaleItems.sold} - ${qty})` }).where(eq(schema.flashSaleItems.id, id));
    }
    const redemptions = await tx.delete(schema.voucherRedemptions).where(eq(schema.voucherRedemptions.orderId, order.id)).returning({ voucherId: schema.voucherRedemptions.voucherId });
    for (const r of redemptions) await tx.update(schema.vouchers).set({ used: sql`greatest(0, ${schema.vouchers.used} - 1)` }).where(eq(schema.vouchers.id, r.voucherId));
    if (order.paymentId && order.paymentStatus === "menunggu") {
      await tx.update(schema.payments).set({ status: isExpired(order.expiresAt, at) ? "kedaluwarsa" : "batal" }).where(eq(schema.payments.id, order.paymentId));
    } else if (order.paymentId && order.paymentStatus === "lunas") {
      await tx.update(schema.payments).set({ status: "batal" }).where(eq(schema.payments.id, order.paymentId));
    }
    patch.cancelReason = opts.reason ?? "Dibatalkan";
    event = "dibatalkan";
  }

  if (to === "dikirim") {
    const resi = opts.trackingNumber ?? `${(order.courier ?? "JNE").slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}${order.number.replace(/\D/g, "").slice(-8)}${String(order.id).padStart(4, "0")}`;
    await tx.insert(schema.shipments).values({ orderId: order.id, courier: courierLabel(order.courier), service: order.service ?? "", trackingNumber: resi, status: "dalam_perjalanan", history: [{ at: at.toISOString(), status: "Paket diserahkan ke kurir" }], createdAt: at, updatedAt: at });
    event = "dikirim";
  }
  if (to === "siap_diambil") event = "siap_diambil";
  if (to === "selesai") {
    patch.completedAt = at;
    event = "selesai";
  }

  await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, order.id));
  await tx.insert(schema.orderStatusHistory).values({ orderId: order.id, fromStatus: from, toStatus: to, actor: opts.actor, reason: opts.reason ?? null, createdAt: at });
  Object.assign(order, patch);
  if (event) await queueNotifications(tx, order.id, event, opts.siteUrl);
}

export type ConfirmResult = { ok: true; alreadyProcessed: boolean; number: string; productIds: number[] } | { ok: false; code: "tidak_ditemukan" | "nominal_tidak_cocok" | "kedaluwarsa" | "status_tidak_sesuai"; message: string };

// Satu pintu konfirmasi pembayaran (dipakai webhook dan tombol simulasi). Idempoten: aman dipanggil berkali-kali.
export async function confirmPayment(db: AnyDb, input: { idempotencyKey: string; amount?: number | null; actor?: string; now?: Date; siteUrl?: string }): Promise<ConfirmResult> {
  const at = input.now ?? clockNow();
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(schema.payments).where(eq(schema.payments.idempotencyKey, input.idempotencyKey)).for("update");
    if (!payment) return { ok: false as const, code: "tidak_ditemukan" as const, message: "Pembayaran tidak ditemukan." };
    const order = await lockOrder(tx, { id: payment.orderId });
    if (!order) return { ok: false as const, code: "tidak_ditemukan" as const, message: "Pesanan tidak ditemukan." };
    if (payment.status === "lunas") return { ok: true as const, alreadyProcessed: true, number: order.number, productIds: [] };
    if (input.amount != null && input.amount !== payment.amount) return { ok: false as const, code: "nominal_tidak_cocok" as const, message: "Nominal pembayaran tidak sesuai tagihan." };
    if (order.status === "menunggu_pembayaran" && isExpired(order.expiresAt, at)) {
      await applyTransition(tx, order, "dibatalkan", { actor: "sistem", reason: expiryReason(order.paymentMethod), now: at, siteUrl: input.siteUrl });
      return { ok: false as const, code: "kedaluwarsa" as const, message: "Batas waktu pembayaran sudah lewat, pesanan dibatalkan." };
    }
    if (order.status !== "menunggu_pembayaran" || payment.status !== "menunggu") {
      return { ok: false as const, code: "status_tidak_sesuai" as const, message: `Pesanan berstatus ${statusLabels[order.status as OrderStatus]}.` };
    }
    await applyTransition(tx, order, "dibayar", { actor: input.actor ?? "sistem pembayaran", now: at, siteUrl: input.siteUrl });
    const products = await tx.selectDistinct({ productId: schema.variants.productId }).from(schema.orderItems).innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id)).where(eq(schema.orderItems.orderId, order.id));
    return { ok: true as const, alreadyProcessed: false, number: order.number, productIds: products.map((p) => p.productId) };
  });
}

export function expiryReason(paymentMethod: string | null) {
  return paymentMethod === "bayar_di_toko" ? "Tidak dibayar sampai batas waktu bayar di toko" : "Tidak dibayar dalam 15 menit";
}

// Pengecekan malas: dipanggil setiap kali pesanan atau halaman bayar dibuka.
export async function expireIfDue(db: AnyDb, number: string, nowInput?: Date, siteUrl?: string) {
  const at = nowInput ?? clockNow();
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, { number });
    if (!order || order.status !== "menunggu_pembayaran" || !isExpired(order.expiresAt, at)) return false;
    await applyTransition(tx, order, "dibatalkan", { actor: "sistem", reason: expiryReason(order.paymentMethod), now: at, siteUrl });
    return true;
  });
}

// Untuk route cron: batalkan semua pesanan tak dibayar yang lewat batas waktu.
export async function expireDueOrders(db: AnyDb, nowInput?: Date, siteUrl?: string) {
  const at = nowInput ?? clockNow();
  const due = await db
    .select({ number: schema.orders.number })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "menunggu_pembayaran"), lte(schema.orders.expiresAt, at)))
    .orderBy(asc(schema.orders.id))
    .limit(500);
  let cancelled = 0;
  for (const d of due) if (await expireIfDue(db, d.number, at, siteUrl)) cancelled += 1;
  return { checked: due.length, cancelled };
}

export type StaffResult = { ok: true; number: string; productIds: number[] } | { ok: false; message: string };

// Bayar di Toko: staf menandai lunas dan sudah diambil dalam satu aksi (Menunggu Pembayaran, Dibayar, Selesai tercatat berurutan).
export async function markPaidAndPickedUp(db: AnyDb, number: string, opts: { actor: string; now?: Date; siteUrl?: string }): Promise<StaffResult> {
  const at = opts.now ?? clockNow();
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, { number });
    if (!order) return { ok: false as const, message: "Pesanan tidak ditemukan." };
    if (order.method !== "ambil" || order.paymentMethod !== "bayar_di_toko") return { ok: false as const, message: "Aksi ini hanya untuk pesanan Bayar di Toko." };
    if (order.status === "menunggu_pembayaran" && isExpired(order.expiresAt, at)) {
      await applyTransition(tx, order, "dibatalkan", { actor: "sistem", reason: expiryReason(order.paymentMethod), now: at, siteUrl: opts.siteUrl });
      return { ok: false as const, message: "Batas waktu bayar di toko sudah lewat, pesanan dibatalkan." };
    }
    if (order.status !== "menunggu_pembayaran") return { ok: false as const, message: `Pesanan berstatus ${statusLabels[order.status as OrderStatus]}.` };
    await applyTransition(tx, order, "dibayar", { actor: opts.actor, reason: "Dibayar di kasir", now: at, siteUrl: opts.siteUrl });
    order.paymentStatus = "lunas";
    await applyTransition(tx, order, "selesai", { actor: opts.actor, reason: "Sudah diambil pembeli", now: new Date(at.getTime() + 1000), payAtStoreHandover: true, siteUrl: opts.siteUrl });
    const products = await tx.selectDistinct({ productId: schema.variants.productId }).from(schema.orderItems).innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id)).where(eq(schema.orderItems.orderId, order.id));
    return { ok: true as const, number: order.number, productIds: products.map((p) => p.productId) };
  });
}

// Transisi umum (dipakai panel admin Fase 6 dan uji).
export async function transitionOrder(db: AnyDb, number: string, to: OrderStatus, opts: TransitionOptions) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, { number });
    if (!order) throw new Error("Pesanan tidak ditemukan.");
    await applyTransition(tx, order, to, opts);
    return order.status as OrderStatus;
  });
}

async function queueNotifications(tx: AnyDb, orderId: number, event: OrderEvent, siteUrl = "") {
  const [o] = await tx
    .select({
      number: schema.orders.number,
      name: schema.orders.guestName,
      phone: schema.orders.guestPhone,
      email: schema.orders.guestEmail,
      customerId: schema.orders.customerId,
      total: schema.orders.total,
      method: schema.orders.method,
      expiresAt: schema.orders.expiresAt,
      cancelReason: schema.orders.cancelReason,
      courier: schema.orders.courier,
      accessToken: schema.orders.accessToken,
      locationName: schema.locations.name,
    })
    .from(schema.orders)
    .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
    .where(eq(schema.orders.id, orderId));
  if (!o) return;
  const [payment] = await tx.select({ method: schema.payments.method }).from(schema.payments).where(eq(schema.payments.orderId, orderId)).limit(1);
  const [shipment] = await tx.select({ trackingNumber: schema.shipments.trackingNumber }).from(schema.shipments).where(eq(schema.shipments.orderId, orderId)).limit(1);
  const msg = orderMessage(event, {
    number: o.number,
    name: o.name ?? "",
    total: o.total,
    method: o.method,
    paymentMethod: payment?.method ?? "",
    expiresAt: o.expiresAt,
    locationName: o.locationName,
    trackingNumber: shipment?.trackingNumber ?? null,
    courier: courierLabel(o.courier),
    cancelReason: o.cancelReason,
    link: `${siteUrl}/pesanan/${o.number}?t=${o.accessToken}`,
  });
  const rows: (typeof schema.notifications.$inferInsert)[] = [];
  if (o.phone) rows.push({ customerId: o.customerId, orderId, kind: event, channel: "wa", recipient: o.phone, subject: msg.subject, body: msg.wa, status: "antre" });
  if (o.email) rows.push({ customerId: o.customerId, orderId, kind: event, channel: "email", recipient: o.email, subject: msg.subject, body: msg.email, status: "antre" });
  if (rows.length) await tx.insert(schema.notifications).values(rows);
}

// Pembaca outbox untuk Kotak Notifikasi (Fase 5).
export async function listNotifications(db: AnyDb, filter: { customerId?: number; recipient?: string; orderId?: number }, limit = 50) {
  const conds = [];
  if (filter.customerId != null) conds.push(eq(schema.notifications.customerId, filter.customerId));
  if (filter.recipient) conds.push(eq(schema.notifications.recipient, filter.recipient));
  if (filter.orderId != null) conds.push(eq(schema.notifications.orderId, filter.orderId));
  if (conds.length === 0) return [];
  return db
    .select()
    .from(schema.notifications)
    .where(and(...conds))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(limit);
}
