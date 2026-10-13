// Alat bantu uji integrasi terhadap database lokal hasil npm run db:reset.
// Setiap berkas uji membuat pembeli, pesanan, dan stoknya sendiri lalu membersihkannya di akhir.
import { randomInt } from "node:crypto";
import { config } from "dotenv";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { addItems, createCart } from "@/lib/cart/service";
import { confirmPayment, placeOrder, type PlaceOrderInput } from "@/lib/orders/service";

config({ path: ".env.local" });
export const dbUrl = process.env.DATABASE_URL;

export function integration() {
  const client = postgres(dbUrl ?? "", { max: 6, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  const customers: number[] = [];
  const orders: string[] = [];
  const carts: number[] = [];
  const phones: string[] = [];
  const restore: { variantId: number; locationId: number; onHand: number; reserved: number }[] = [];

  // Nomor uji 0899 + 8 digit acak, tidak bentrok dengan seed (0800 dan 0812).
  const phone = () => {
    const p = `0899${String(randomInt(0, 99_999_999)).padStart(8, "0")}`;
    phones.push(p);
    return p;
  };

  async function customer(over: Partial<typeof schema.customers.$inferInsert> = {}) {
    const [c] = await db.insert(schema.customers).values({ name: "Pembeli Uji", phone: phone(), ...over }).returning();
    customers.push(c.id);
    return c;
  }

  async function variant(productSlug: string, shadeSlug?: string) {
    const rows = await db
      .select({ id: schema.variants.id, shadeSlug: schema.variants.shadeSlug, productId: schema.variants.productId })
      .from(schema.variants)
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .where(eq(schema.products.slug, productSlug))
      .orderBy(schema.variants.id);
    const v = shadeSlug ? rows.find((r) => r.shadeSlug === shadeSlug) : rows[0];
    if (!v) throw new Error(`varian ${productSlug} tidak ada`);
    return v;
  }

  async function location(slug: string) {
    const [l] = await db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.slug, slug));
    return l.id;
  }

  async function setStock(variantId: number, locationId: number, onHand: number) {
    const [cur] = await db.select().from(schema.inventory).where(and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.locationId, locationId)));
    if (!restore.some((r) => r.variantId === variantId && r.locationId === locationId)) restore.push({ variantId, locationId, onHand: cur.onHand, reserved: cur.reserved });
    await db.update(schema.inventory).set({ onHand, reserved: 0 }).where(eq(schema.inventory.id, cur.id));
  }

  async function stock(variantId: number, locationId: number) {
    const [cur] = await db.select({ onHand: schema.inventory.onHand, reserved: schema.inventory.reserved }).from(schema.inventory).where(and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.locationId, locationId)));
    return cur;
  }

  async function cartWith(items: { variantId: number; quantity: number }[]) {
    const cart = await createCart(db);
    carts.push(cart.id);
    const r = await addItems(db, cart.id, items);
    if (!r.ok) throw new Error(r.message);
    return cart;
  }

  const address = { recipient: "Uji", phone: "081300000000", province: "Jawa Timur", city: "Kota Malang", district: "Lowokwaru", postalCode: "65145", street: "Jl. Uji No. 1" };

  // Buat pesanan kirim (QRIS) dengan total yang benar: percobaan pertama ditolak dan mengembalikan harga terbaru.
  async function order(input: { items: { variantId: number; quantity: number }[]; buyer: PlaceOrderInput["buyer"]; now?: Date; pointsRequested?: number; over?: Partial<PlaceOrderInput> }) {
    const cart = await cartWith(input.items);
    const base: PlaceOrderInput = { cartId: cart.id, buyer: input.buyer, method: "kirim", address, zone: "dalam_kota", courierCode: "jne_reg", paymentMethod: "qris", expectedTotal: -1, now: input.now, pointsRequested: input.pointsRequested, ...input.over };
    const probe = await placeOrder(db, base);
    if (probe.ok) throw new Error("total -1 seharusnya ditolak");
    if (probe.code !== "harga_berubah") throw new Error(`${probe.code}: ${probe.message}`);
    const r = await placeOrder(db, { ...base, expectedTotal: probe.pricing!.total });
    if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
    orders.push(r.number);
    return r;
  }

  async function pay(orderId: number, now?: Date) {
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
    const c = await confirmPayment(db, { idempotencyKey: p.idempotencyKey, amount: p.amount, now });
    if (!c.ok) throw new Error(c.message);
  }

  async function points(customerId: number) {
    const [c] = await db.select({ points: schema.customers.points }).from(schema.customers).where(eq(schema.customers.id, customerId));
    return c.points;
  }

  async function cleanup() {
    const ids = orders.length ? (await db.select({ id: schema.orders.id }).from(schema.orders).where(inArray(schema.orders.number, orders))).map((o) => o.id) : [];
    const custOrders = customers.length ? (await db.select({ id: schema.orders.id, number: schema.orders.number }).from(schema.orders).where(inArray(schema.orders.customerId, customers))) : [];
    const allIds = [...new Set([...ids, ...custOrders.map((o) => o.id)])];
    const allNumbers = [...new Set([...orders, ...custOrders.map((o) => o.number)])];
    if (allNumbers.length) await db.delete(schema.stockMovements).where(inArray(schema.stockMovements.reference, allNumbers));
    if (allIds.length) {
      const productIds = (await db.selectDistinct({ id: schema.reviews.productId }).from(schema.reviews).innerJoin(schema.orderItems, eq(schema.reviews.orderItemId, schema.orderItems.id)).where(inArray(schema.orderItems.orderId, allIds))).map((r) => r.id);
      await db.delete(schema.reviews).where(inArray(schema.reviews.orderItemId, db.select({ id: schema.orderItems.id }).from(schema.orderItems).where(inArray(schema.orderItems.orderId, allIds))));
      // Rating produk dihitung ulang setelah ulasan uji dihapus.
      for (const pid of productIds) {
        await db.execute(sql`update products set rating_avg = coalesce((select round(avg(rating)::numeric, 1) from reviews where product_id = ${pid} and status = 'tampil'), 0), review_count = (select count(*) from reviews where product_id = ${pid} and status = 'tampil') where id = ${pid}`);
      }
      await db.delete(schema.notifications).where(inArray(schema.notifications.orderId, allIds));
      await db.delete(schema.voucherRedemptions).where(inArray(schema.voucherRedemptions.orderId, allIds));
      await db.delete(schema.orders).where(inArray(schema.orders.id, allIds));
    }
    if (customers.length) {
      await db.delete(schema.restockRequests).where(inArray(schema.restockRequests.customerId, customers));
      await db.delete(schema.reviews).where(inArray(schema.reviews.customerId, customers));
      await db.delete(schema.carts).where(inArray(schema.carts.customerId, customers));
      await db.delete(schema.customers).where(inArray(schema.customers.id, customers));
    }
    if (phones.length) {
      await db.delete(schema.otpCodes).where(inArray(schema.otpCodes.phone, phones));
      await db.delete(schema.notifications).where(and(inArray(schema.notifications.recipient, phones)));
      await db.delete(schema.restockRequests).where(inArray(schema.restockRequests.contact, phones));
    }
    for (const r of restore) await db.update(schema.inventory).set({ onHand: r.onHand, reserved: r.reserved }).where(and(eq(schema.inventory.variantId, r.variantId), eq(schema.inventory.locationId, r.locationId)));
    if (carts.length) await db.delete(schema.carts).where(inArray(schema.carts.id, carts));
    await client.end();
  }

  return { db, client, customer, phone, variant, location, setStock, stock, cartWith, order, pay, points, cleanup, orders, customers, carts, address, schema, sql, eq, and, or, isNotNull, inArray };
}
