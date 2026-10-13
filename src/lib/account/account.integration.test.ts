// Akun terhadap database lokal: klaim pesanan tamu, gabung wishlist dan keranjang, buku alamat, dan uji IDOR
// (pembeli A tidak bisa membaca atau mengubah data milik pembeli B).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { readSession } from "@/lib/auth/session";
import { addItems, cartCount, createCart, findCartByCustomer } from "@/lib/cart/service";
import { canAccessOrder } from "@/lib/orders/queries";
import { confirmReceived, transitionOrder } from "@/lib/orders/service";
import { checkPointsConsistency, ledgerFor, movePoints } from "@/lib/points";
import { createReview } from "@/lib/reviews/service";
import { createAddress, deleteAddress, getAddress, listAddresses, MAX_ADDRESSES, setPrimaryAddress, updateAddress } from "./addresses";
import { completeLogin } from "./login";
import { listInbox, markAllRead, markRead, unreadCount } from "./notifications";
import { listCustomerOrders } from "./orders";
import { cancelRestock, listRestock, requestRestockFor } from "./restock";
import { setWishlisted, wishlistIds } from "./wishlist";

const addr = (label: string, isPrimary = false) => ({ label, recipient: "Uji Alamat", phone: "081300000001", provinceCode: "35", regencyCode: "35.73", districtCode: "35.73.05", postalCode: "65145", street: `Jl. Uji ${label} No. 1`, isPrimary });

describe.skipIf(!dbUrl)("akun (integrasi)", () => {
  const t = integration();
  const { db, schema, eq } = t;
  let variantId = 0;
  let gudang = 0;
  let productIds: number[] = [];

  beforeAll(async () => {
    variantId = (await t.variant("mekar-kopi-body-scrub")).id;
    gudang = await t.location("gudang-online");
    await t.setStock(variantId, gudang, 50);
    productIds = (await db.select({ id: schema.products.id }).from(schema.products).limit(3)).map((p) => p.id);
  });
  afterAll(() => t.cleanup());

  it("masuk pertama membuat akun, mengklaim pesanan tamu bernomor sama beserta notifikasinya", async () => {
    const phone = t.phone();
    const guest = await t.order({ items: [{ variantId, quantity: 1 }], buyer: { name: "Tamu", phone } });
    // Pesanan tamu kedua sudah Selesai sebelum diklaim: poinnya masuk saat klaim.
    const done = await t.order({ items: [{ variantId, quantity: 1 }], buyer: { name: "Tamu", phone } });
    await t.pay(done.orderId);
    await transitionOrder(db, done.number, "diproses", { actor: "uji" });
    await transitionOrder(db, done.number, "dikirim", { actor: "uji" });
    await transitionOrder(db, done.number, "selesai", { actor: "uji" });
    const other = await t.order({ items: [{ variantId, quantity: 1 }], buyer: { name: "Orang lain", phone: t.phone() } });

    const login = await completeLogin(db, { phone, now: new Date() });
    expect(login).toMatchObject({ isNew: true, needsName: true });
    expect(login.claimedOrders.sort()).toEqual([guest.number, done.number].sort());
    t.customers.push(login.customerId);
    const [o] = await db.select({ customerId: schema.orders.customerId }).from(schema.orders).where(eq(schema.orders.id, guest.orderId));
    expect(o.customerId).toBe(login.customerId);
    const [x] = await db.select({ customerId: schema.orders.customerId }).from(schema.orders).where(eq(schema.orders.id, other.orderId));
    expect(x.customerId).toBeNull();
    const inbox = await listInbox(db, login.customerId);
    expect(inbox.some((n) => n.orderNumber === guest.number)).toBe(true);
    expect(inbox.some((n) => n.orderNumber === other.number)).toBe(false);
    expect(await t.points(login.customerId)).toBeGreaterThan(0);
    expect(await checkPointsConsistency(db, login.customerId)).toEqual([]);
    expect(await readSession(db, login.token, new Date())).toMatchObject({ customerId: login.customerId });

    // Masuk lagi: tidak ada yang diklaim dua kali, akun tidak dibuat ulang.
    const again = await completeLogin(db, { phone, now: new Date() });
    expect(again).toMatchObject({ customerId: login.customerId, isNew: false, claimedOrders: [] });
  });

  it("wishlist dan keranjang tamu digabung ke akun saat masuk", async () => {
    const c = await t.customer({ name: "Gabung" });
    await setWishlisted(db, c.id, productIds[0], true);
    const guestCart = await createCart(db);
    t.carts.push(guestCart.id);
    await addItems(db, guestCart.id, [{ variantId, quantity: 2 }]);
    const login = await completeLogin(db, { phone: c.phone, now: new Date(), guestCartToken: guestCart.token, guestWishlist: [productIds[0], productIds[1], productIds[1], 99_999_999, "x"] });
    expect(login.isNew).toBe(false);
    expect((await wishlistIds(db, c.id)).sort()).toEqual([productIds[0], productIds[1]].sort());
    const cart = await findCartByCustomer(db, c.id);
    expect(cart).not.toBeNull();
    expect(await cartCount(db, cart!.id)).toBe(2);
  });

  it("buku alamat: alamat pertama jadi utama, tepat satu utama, maksimal 10", async () => {
    const c = await t.customer();
    const first = await createAddress(db, c.id, addr("Satu"));
    expect(first.ok).toBe(true);
    const second = await createAddress(db, c.id, addr("Dua", true));
    let list = await listAddresses(db, c.id);
    expect(list.filter((a) => a.isPrimary).map((a) => a.label)).toEqual(["Dua"]);
    expect(await setPrimaryAddress(db, c.id, first.ok ? first.id : 0)).toBe(true);
    list = await listAddresses(db, c.id);
    expect(list.filter((a) => a.isPrimary).map((a) => a.label)).toEqual(["Satu"]);
    // Menghapus alamat utama memindahkan status utama ke alamat lain.
    await deleteAddress(db, c.id, first.ok ? first.id : 0);
    list = await listAddresses(db, c.id);
    expect(list.map((a) => [a.label, a.isPrimary])).toEqual([["Dua", true]]);
    for (let i = 0; i < MAX_ADDRESSES - 1; i++) expect((await createAddress(db, c.id, addr(`A${i}`))).ok).toBe(true);
    expect(await createAddress(db, c.id, addr("Kesebelas"))).toMatchObject({ ok: false });
    expect(await createAddress(db, c.id, { ...addr("Salah"), regencyCode: "99.99" })).toMatchObject({ ok: false, field: "regencyCode" });
    expect(second.ok).toBe(true);
  });

  describe("IDOR: pembeli A tidak bisa menyentuh data pembeli B", () => {
    it("alamat", async () => {
      const a = await t.customer();
      const b = await t.customer();
      const r = await createAddress(db, b.id, addr("Milik B"));
      const id = r.ok ? r.id : 0;
      expect(await getAddress(db, a.id, id)).toBeNull();
      expect(await updateAddress(db, a.id, id, addr("Dibajak"))).toMatchObject({ ok: false });
      expect(await setPrimaryAddress(db, a.id, id)).toBe(false);
      expect(await deleteAddress(db, a.id, id)).toBe(false);
      expect((await getAddress(db, b.id, id))?.label).toBe("Milik B");
      expect(await listAddresses(db, a.id)).toEqual([]);
    });

    it("pesanan, konfirmasi diterima, dan ulasan", async () => {
      const a = await t.customer();
      const b = await t.customer({ name: "Budi" });
      const ob = await t.order({ items: [{ variantId, quantity: 1 }], buyer: { name: b.name, phone: b.phone, customerId: b.id } });
      await t.pay(ob.orderId);
      await transitionOrder(db, ob.number, "diproses", { actor: "uji" });
      await transitionOrder(db, ob.number, "dikirim", { actor: "uji" });
      expect((await listCustomerOrders(db, a.id)).orders).toEqual([]);
      expect((await listCustomerOrders(db, b.id)).orders.map((o) => o.number)).toEqual([ob.number]);
      const [row] = await db.select({ accessToken: schema.orders.accessToken, customerId: schema.orders.customerId }).from(schema.orders).where(eq(schema.orders.id, ob.orderId));
      expect(canAccessOrder(row, null, [], a.id)).toBe(false);
      expect(canAccessOrder(row, null, [], b.id)).toBe(true);
      expect(await confirmReceived(db, ob.number, a.id)).toMatchObject({ ok: false });
      expect(await confirmReceived(db, ob.number, b.id)).toMatchObject({ ok: true });
      const [item] = await db.select({ id: schema.orderItems.id }).from(schema.orderItems).where(eq(schema.orderItems.orderId, ob.orderId));
      expect(await createReview(db, { customerId: a.id, orderItemId: item.id, rating: 1, body: "Ulasan palsu dari pembeli lain, tidak boleh.", now: new Date() })).toMatchObject({ ok: false, code: "tidak_ditemukan" });
    });

    it("wishlist, notifikasi, poin, dan Kabari aku", async () => {
      const a = await t.customer();
      const b = await t.customer();
      await setWishlisted(db, b.id, productIds[2], true);
      await setWishlisted(db, a.id, productIds[2], false);
      expect(await wishlistIds(db, b.id)).toEqual([productIds[2]]);
      expect(await wishlistIds(db, a.id)).toEqual([]);

      const [n] = await db.insert(schema.notifications).values({ customerId: b.id, kind: "uji", channel: "wa", recipient: b.phone, body: "Pesan untuk B" }).returning({ id: schema.notifications.id });
      expect(await markRead(db, a.id, n.id, new Date())).toBe(false);
      await markAllRead(db, a.id, new Date());
      expect(await unreadCount(db, b.id)).toBe(1);
      expect((await listInbox(db, a.id)).map((x) => x.id)).not.toContain(n.id);

      await movePoints(db, { customerId: b.id, amount: 70, reason: "Milik B", key: `uji:idor:${b.id}` });
      expect(await ledgerFor(db, a.id)).toEqual([]);
      expect(await t.points(a.id)).toBe(0);

      await requestRestockFor(db, { customerId: b.id, phone: b.phone }, variantId);
      const [req] = await listRestock(db, b.id);
      expect(await cancelRestock(db, a.id, req.id)).toBe(false);
      expect(await listRestock(db, a.id)).toEqual([]);
      expect(await cancelRestock(db, b.id, req.id)).toBe(true);
    });
  });
});
