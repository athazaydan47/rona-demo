// Uji integrasi layanan pesanan terhadap database lokal yang sudah di-seed (npm run db:reset).
// Setiap uji memakai varian sendiri, memulihkan stok, dan menghapus pesanan yang dibuatnya.
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { addItems, createCart, findCartByToken, mergeGuestCartIntoCustomer } from "@/lib/cart/service";
import { confirmPayment, expireDueOrders, expireIfDue, markPaidAndPickedUp, placeOrder, transitionOrder, type PlaceOrderInput } from "./service";

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("layanan pesanan (integrasi)", () => {
  const client = postgres(url ?? "", { max: 8, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  const createdOrders: string[] = [];
  const createdCarts: number[] = [];
  const restore: { variantId: number; locationId: number; onHand: number; reserved: number }[] = [];

  async function variantBySlug(productSlug: string, shadeSlug?: string) {
    const rows = await db
      .select({ id: schema.variants.id, shadeSlug: schema.variants.shadeSlug })
      .from(schema.variants)
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .where(eq(schema.products.slug, productSlug));
    const v = shadeSlug ? rows.find((r) => r.shadeSlug === shadeSlug) : rows[0];
    if (!v) throw new Error(`varian ${productSlug} tidak ada`);
    return v.id;
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
    createdCarts.push(cart.id);
    const r = await addItems(db, cart.id, items);
    expect(r.ok).toBe(true);
    return cart;
  }
  const base = (cartId: number, over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
    cartId,
    buyer: { name: "Uji Integrasi", phone: `08139${String(cartId).padStart(7, "0")}` },
    method: "kirim",
    address: { recipient: "Uji", phone: "081300000000", province: "Jawa Timur", city: "Kota Malang", district: "Lowokwaru", postalCode: "65145", street: "Jl. Uji No. 1" },
    zone: "dalam_kota",
    courierCode: "jne_reg",
    paymentMethod: "qris",
    expectedTotal: -1,
    ...over,
  });
  // Ambil total yang benar lewat percobaan pertama (server menolak dan mengembalikan rincian harga terbaru).
  async function place(input: PlaceOrderInput) {
    const probe = await placeOrder(db, { ...input, expectedTotal: -1 });
    if (probe.ok) throw new Error("total -1 seharusnya ditolak");
    if (probe.code !== "harga_berubah") return probe;
    const r = await placeOrder(db, { ...input, expectedTotal: probe.pricing!.total });
    if (r.ok) createdOrders.push(r.number);
    return r;
  }

  afterAll(async () => {
    if (createdOrders.length) {
      await db.delete(schema.stockMovements).where(inArray(schema.stockMovements.reference, createdOrders));
      const ids = (await db.select({ id: schema.orders.id }).from(schema.orders).where(inArray(schema.orders.number, createdOrders))).map((o) => o.id);
      if (ids.length) {
        await db.delete(schema.notifications).where(inArray(schema.notifications.orderId, ids));
        await db.delete(schema.voucherRedemptions).where(inArray(schema.voucherRedemptions.orderId, ids));
        await db.delete(schema.orders).where(inArray(schema.orders.id, ids));
      }
    }
    for (const r of restore) await db.update(schema.inventory).set({ onHand: r.onHand, reserved: r.reserved }).where(and(eq(schema.inventory.variantId, r.variantId), eq(schema.inventory.locationId, r.locationId)));
    if (createdCarts.length) await db.delete(schema.carts).where(inArray(schema.carts.id, createdCarts));
    await client.end();
  });

  it("dua pembeli berebut stok terakhir bersamaan: hanya satu berhasil, yang lain dapat pesan jelas", async () => {
    const variantId = await variantBySlug("teduh-acne-spot-gel");
    const gudang = await location("gudang-online");
    await setStock(variantId, gudang, 1);
    const [a, b] = await Promise.all([cartWith([{ variantId, quantity: 1 }]), cartWith([{ variantId, quantity: 1 }])]);
    const probe = await placeOrder(db, { ...base(a.id), expectedTotal: -1 });
    const total = !probe.ok && probe.pricing ? probe.pricing.total : 0;
    const results = await Promise.all([placeOrder(db, { ...base(a.id), expectedTotal: total }), placeOrder(db, { ...base(b.id), expectedTotal: total })]);
    for (const r of results) if (r.ok) createdOrders.push(r.number);
    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ ok: false, code: "stok_kurang" });
    expect(!failed[0].ok && failed[0].message).toContain("habis");
    expect(await stock(variantId, gudang)).toEqual({ onHand: 1, reserved: 1 });
    const moves = await db.select().from(schema.stockMovements).where(and(eq(schema.stockMovements.variantId, variantId), eq(schema.stockMovements.type, "pesan"), inArray(schema.stockMovements.reference, createdOrders)));
    expect(moves).toHaveLength(1);
  });

  it("nomor pesanan berurutan tanpa tabrakan saat pesanan dibuat bersamaan", async () => {
    const variantId = await variantBySlug("mekar-roll-on-deodorant", "fresh-floral");
    const gudang = await location("gudang-online");
    await setStock(variantId, gudang, 20);
    const carts = await Promise.all([1, 2, 3, 4].map(() => cartWith([{ variantId, quantity: 1 }])));
    const probe = await placeOrder(db, { ...base(carts[0].id), expectedTotal: -1 });
    const total = !probe.ok && probe.pricing ? probe.pricing.total : 0;
    const results = await Promise.all(carts.map((c) => placeOrder(db, { ...base(c.id), expectedTotal: total })));
    const numbers = results.map((r) => (r.ok ? r.number : "")).filter(Boolean);
    createdOrders.push(...numbers);
    expect(numbers).toHaveLength(4);
    expect(new Set(numbers).size).toBe(4);
    const seqs = numbers.map((n) => Number(n.split("-")[2])).sort((x, y) => x - y);
    expect(seqs[3] - seqs[0]).toBe(3);
  });

  it("harga yang berbeda dari yang dilihat pembeli ditolak dengan rincian terbaru", async () => {
    const variantId = await variantBySlug("kalis-scalp-tonic");
    const cart = await cartWith([{ variantId, quantity: 1 }]);
    const r = await placeOrder(db, { ...base(cart.id), expectedTotal: 1 });
    expect(r).toMatchObject({ ok: false, code: "harga_berubah" });
    expect(!r.ok && r.pricing?.total).toBeGreaterThan(1);
  });

  it("konfirmasi pembayaran idempoten: dipanggil dua kali bersamaan, stok dipotong sekali", async () => {
    const variantId = await variantBySlug("nara-men-water-based-pomade", "shine");
    const gudang = await location("gudang-online");
    await setStock(variantId, gudang, 10);
    const cart = await cartWith([{ variantId, quantity: 2 }]);
    const r = await place(base(cart.id));
    if (!r.ok) throw new Error(r.message);
    const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, r.orderId));
    expect(await stock(variantId, gudang)).toEqual({ onHand: 10, reserved: 2 });
    const [c1, c2] = await Promise.all([confirmPayment(db, { idempotencyKey: pay.idempotencyKey, amount: pay.amount }), confirmPayment(db, { idempotencyKey: pay.idempotencyKey, amount: pay.amount })]);
    expect([c1, c2].filter((c) => c.ok && !c.alreadyProcessed)).toHaveLength(1);
    expect([c1, c2].filter((c) => c.ok && c.alreadyProcessed)).toHaveLength(1);
    expect(await stock(variantId, gudang)).toEqual({ onHand: 8, reserved: 0 });
    const [order] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, r.orderId));
    expect(order.status).toBe("dibayar");
    const keluar = await db.select().from(schema.stockMovements).where(and(eq(schema.stockMovements.reference, r.number), eq(schema.stockMovements.type, "keluar")));
    expect(keluar).toHaveLength(1);
    expect(keluar[0].quantity).toBe(-2);
    const third = await confirmPayment(db, { idempotencyKey: pay.idempotencyKey, amount: pay.amount });
    expect(third).toMatchObject({ ok: true, alreadyProcessed: true });
    expect(await confirmPayment(db, { idempotencyKey: "pay_tidak_ada" })).toMatchObject({ ok: false, code: "tidak_ditemukan" });
    // Transisi tidak sah ditolak; transisi sah mencatat riwayat.
    await expect(transitionOrder(db, r.number, "siap_diambil", { actor: "uji" })).rejects.toThrow("tidak bisa berubah");
    await transitionOrder(db, r.number, "diproses", { actor: "uji" });
    await transitionOrder(db, r.number, "dikirim", { actor: "uji" });
    const [ship] = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, r.orderId));
    expect(ship.trackingNumber).toBeTruthy();
    const history = await db.select({ to: schema.orderStatusHistory.toStatus }).from(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, r.orderId)).orderBy(schema.orderStatusHistory.id);
    expect(history.map((h) => h.to)).toEqual(["menunggu_pembayaran", "dibayar", "diproses", "dikirim"]);
    const notif = await db.select({ kind: schema.notifications.kind }).from(schema.notifications).where(eq(schema.notifications.orderId, r.orderId));
    expect(notif.map((n) => n.kind)).toEqual(expect.arrayContaining(["dibuat", "dibayar", "dikirim"]));
  });

  it("kedaluwarsa melepas stok dipesan, mengembalikan kuota flash sale dan pemakaian voucher", async () => {
    // Slot flash sale khusus uji yang sedang berjalan sekarang.
    const variantId = await variantBySlug("lumi-honey-lip-balm", "rona-pink");
    const gudang = await location("gudang-online");
    await setStock(variantId, gudang, 30);
    const [sale] = await db
      .insert(schema.flashSales)
      .values({ name: "Flash Uji", startsAt: new Date(Date.now() - 10 * 60_000), endsAt: new Date(Date.now() + 60 * 60_000), isActive: true })
      .returning({ id: schema.flashSales.id });
    const [item] = await db.insert(schema.flashSaleItems).values({ flashSaleId: sale.id, variantId, flashPrice: 19_000, quota: 30, sold: 5, maxPerCustomer: 2 }).returning({ id: schema.flashSaleItems.id });
    const flash = { itemId: item.id, sold: 5 };
    const [voucherBefore] = await db.select({ used: schema.vouchers.used }).from(schema.vouchers).where(eq(schema.vouchers.code, "ONGKIRRONA"));
    const cart = await cartWith([{ variantId, quantity: 2 }, { variantId: await variantBySlug("mekar-roll-on-deodorant", "clean-cotton"), quantity: 5 }]);
    await setStock(await variantBySlug("mekar-roll-on-deodorant", "clean-cotton"), gudang, 30);
    const r = await place({ ...base(cart.id, { zone: "jatim", voucherCode: "ONGKIRRONA" }) });
    if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
    expect((await stock(variantId, gudang)).reserved).toBe(2);
    const [voucherAfter] = await db.select({ used: schema.vouchers.used }).from(schema.vouchers).where(eq(schema.vouchers.code, "ONGKIRRONA"));
    expect(voucherAfter.used).toBe(voucherBefore.used + 1);
    const [f1] = await db.select({ sold: schema.flashSaleItems.sold }).from(schema.flashSaleItems).where(eq(schema.flashSaleItems.id, flash.itemId));
    expect(f1.sold).toBe(flash.sold + 2);
    const [line] = await db.select({ price: schema.orderItems.unitPrice, source: schema.orderItems.priceSource }).from(schema.orderItems).where(and(eq(schema.orderItems.orderId, r.orderId), eq(schema.orderItems.variantId, variantId)));
    expect(line).toEqual({ price: 19_000, source: "flash" });
    // Belum lewat batas waktu: tidak dibatalkan.
    expect(await expireIfDue(db, r.number, new Date(Date.now() + 5 * 60_000))).toBe(false);
    // Jam dimajukan 16 menit: dibatalkan oleh cron.
    const res = await expireDueOrders(db, new Date(Date.now() + 16 * 60_000));
    expect(res.cancelled).toBeGreaterThanOrEqual(1);
    const [order] = await db.select({ status: schema.orders.status, reason: schema.orders.cancelReason }).from(schema.orders).where(eq(schema.orders.id, r.orderId));
    expect(order).toEqual({ status: "dibatalkan", reason: "Tidak dibayar dalam 15 menit" });
    expect((await stock(variantId, gudang)).reserved).toBe(0);
    const [voucherBack] = await db.select({ used: schema.vouchers.used }).from(schema.vouchers).where(eq(schema.vouchers.code, "ONGKIRRONA"));
    expect(voucherBack.used).toBe(voucherBefore.used);
    const [f2] = await db.select({ sold: schema.flashSaleItems.sold }).from(schema.flashSaleItems).where(eq(schema.flashSaleItems.id, flash.itemId));
    expect(f2.sold).toBe(flash.sold);
    const lepas = await db.select().from(schema.stockMovements).where(and(eq(schema.stockMovements.reference, r.number), eq(schema.stockMovements.type, "lepas")));
    expect(lepas).toHaveLength(2);
    const [pay] = await db.select({ status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.orderId, r.orderId));
    expect(pay.status).toBe("kedaluwarsa");
    // Pembayaran yang datang setelah batal ditolak.
    const [p2] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, r.orderId));
    expect(await confirmPayment(db, { idempotencyKey: p2.idempotencyKey })).toMatchObject({ ok: false });
    await db.delete(schema.flashSales).where(eq(schema.flashSales.id, sale.id));
  });

  it("Bayar di Toko: staf menandai lunas dan diambil, status Dibayar lalu Selesai tercatat berurutan", async () => {
    const variantId = await variantBySlug("lumi-honey-lip-balm", "bening");
    const dinoyo = await location("dinoyo");
    await setStock(variantId, dinoyo, 5);
    const cart = await cartWith([{ variantId, quantity: 1 }]);
    const r = await place(base(cart.id, { method: "ambil", address: null, zone: null, courierCode: null, pickupLocationSlug: "dinoyo", paymentMethod: "bayar_di_toko" }));
    if (!r.ok) throw new Error(r.message);
    const [o] = await db.select({ expiresAt: schema.orders.expiresAt }).from(schema.orders).where(eq(schema.orders.id, r.orderId));
    expect(o.expiresAt!.getTime() - Date.now()).toBeGreaterThan(60 * 60_000); // jauh lebih dari 15 menit
    const done = await markPaidAndPickedUp(db, r.number, { actor: "staf demo" });
    expect(done.ok).toBe(true);
    const history = await db.select({ to: schema.orderStatusHistory.toStatus }).from(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, r.orderId)).orderBy(schema.orderStatusHistory.id);
    expect(history.map((h) => h.to)).toEqual(["menunggu_pembayaran", "dibayar", "selesai"]);
    expect(await stock(variantId, dinoyo)).toEqual({ onHand: 4, reserved: 0 });
    expect((await markPaidAndPickedUp(db, r.number, { actor: "staf demo" })).ok).toBe(false);
  });

  it("gabung keranjang tamu ke keranjang akun menjumlahkan varian yang sama", async () => {
    const v1 = await variantBySlug("lumi-honey-lip-balm", "rona-peach");
    const v2 = await variantBySlug("kalis-scalp-tonic");
    const [customer] = await db.insert(schema.customers).values({ name: "Uji Gabung", phone: `0813${Date.now().toString().slice(-8)}` }).returning({ id: schema.customers.id });
    const [account] = await db.insert(schema.carts).values({ customerId: customer.id }).returning({ id: schema.carts.id });
    createdCarts.push(account.id);
    await addItems(db, account.id, [{ variantId: v1, quantity: 1 }]);
    const guest = await cartWith([
      { variantId: v1, quantity: 2 },
      { variantId: v2, quantity: 1 },
    ]);
    const [g] = await db.select({ token: schema.carts.guestToken }).from(schema.carts).where(eq(schema.carts.id, guest.id));
    const merged = await mergeGuestCartIntoCustomer(db, g.token!, customer.id);
    expect(merged).toBe(account.id);
    const items = await db.select({ variantId: schema.cartItems.variantId, quantity: schema.cartItems.quantity }).from(schema.cartItems).where(eq(schema.cartItems.cartId, account.id));
    expect(items.sort((a, b) => a.variantId - b.variantId)).toEqual([
      { variantId: Math.min(v1, v2), quantity: v1 < v2 ? 3 : 1 },
      { variantId: Math.max(v1, v2), quantity: v1 < v2 ? 1 : 3 },
    ]);
    expect(await findCartByToken(db, g.token)).toBeNull();
    await db.delete(schema.carts).where(eq(schema.carts.id, account.id));
    await db.delete(schema.customers).where(eq(schema.customers.id, customer.id));
  });
});
