// Akun "Pembeli Demo": data lengkap dan deterministik, dibuat lewat modul yang sama dengan aplikasi
// (pesanan, pembayaran, transisi status, poin), sehingga stok, riwayat, notifikasi, dan ledger poin konsisten.
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import * as schema from "../schema";
import { createAddress } from "../../lib/account/addresses";
import { DEMO_BUYER_NAME, DEMO_BUYER_PHONE } from "../../lib/account/demo";
import { addItems, createCart } from "../../lib/cart/service";
import type { AnyDb } from "../../lib/db-types";
import { toWibParts, wibDate } from "../../lib/format";
import { confirmPayment, expireIfDue, placeOrder, transitionOrder, type PlaceOrderInput } from "../../lib/orders/service";
import { siteUrl } from "../../lib/site";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function bestVariant(db: AnyDb, productSlug: string, locationSlug: string, shadeSlug?: string) {
  const rows = await db
    .select({ id: schema.variants.id, shadeSlug: schema.variants.shadeSlug, avail: sql<number>`(${schema.inventory.onHand} - ${schema.inventory.reserved})::int` })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.inventory, eq(schema.inventory.variantId, schema.variants.id))
    .innerJoin(schema.locations, eq(schema.inventory.locationId, schema.locations.id))
    .where(and(eq(schema.products.slug, productSlug), eq(schema.locations.slug, locationSlug)))
    .orderBy(desc(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`), schema.variants.id);
  const preferred = shadeSlug ? rows.find((r) => r.shadeSlug === shadeSlug && r.avail >= 3) : undefined;
  const v = preferred ?? rows.find((r) => r.avail >= 3);
  if (!v) throw new Error(`Seed pembeli demo: stok ${productSlug} di ${locationSlug} kurang.`);
  return v.id;
}

export async function seedDemoBuyer(db: AnyDb, now: Date) {
  const site = siteUrl();
  // Jam WIB pada hari ke-d sebelum hari ini, supaya riwayat terlihat wajar (siang hari).
  const dayAt = (d: number, hour: number, minute = 0) => {
    const p = toWibParts(new Date(now.getTime() - d * DAY));
    return wibDate(p.year, p.month, p.day, hour, minute);
  };
  const [customer] = await db
    .insert(schema.customers)
    .values({
      name: DEMO_BUYER_NAME,
      phone: DEMO_BUYER_PHONE,
      email: "pembeli@rona.demo",
      points: 0,
      skinProfile: { skinType: "kombinasi", concerns: ["kusam", "pori"], sensitivity: "rendah", undertone: "warm", depth: 4, finish: "satin", budget: 150_000, source: "formulir", updatedAt: new Date(now.getTime() - 30 * DAY).toISOString() },
      registeredAt: new Date(now.getTime() - 60 * DAY),
      lastLoginAt: new Date(now.getTime() - 2 * DAY),
    })
    .returning({ id: schema.customers.id });
  const customerId = customer.id;

  // 2 alamat, satu utama.
  const kos = { label: "Kos", recipient: DEMO_BUYER_NAME, phone: DEMO_BUYER_PHONE, provinceCode: "35", regencyCode: "35.73", districtCode: "35.73.05", postalCode: "65145", street: "Jl. Sumbersari Gg. 4 No. 12, RT 03 RW 05 (fiktif)", lat: -7.956, lng: 112.613, isPrimary: true };
  const rumah = { label: "Rumah", recipient: "Ibu Pembeli Demo", phone: "080000000002", provinceCode: "35", regencyCode: "35.78", districtCode: "35.78.08", postalCode: "60282", street: "Jl. Kertajaya Indah No. 8 (fiktif)", lat: null, lng: null };
  for (const [i, a] of [kos, rumah].entries()) {
    const r = await createAddress(db, customerId, a, new Date(now.getTime() - (59 - i) * DAY));
    if (!r.ok) throw new Error(`Seed alamat demo gagal: ${r.message}`);
  }
  const shipTo = { recipient: kos.recipient, phone: kos.phone, province: "Jawa Timur", city: "Kota Malang", district: "Lowokwaru", postalCode: kos.postalCode, street: kos.street, lat: kos.lat, lng: kos.lng };

  async function order(items: { variantId: number; quantity: number }[], at: Date, extra: Partial<PlaceOrderInput>) {
    const cart = await createCart(db);
    const added = await addItems(db, cart.id, items);
    if (!added.ok) throw new Error(`Seed pesanan demo: ${added.message}`);
    const input: PlaceOrderInput = {
      cartId: cart.id,
      buyer: { name: DEMO_BUYER_NAME, phone: DEMO_BUYER_PHONE, email: "pembeli@rona.demo", customerId },
      method: "kirim",
      address: shipTo,
      zone: "dalam_kota",
      courierCode: "jne_reg",
      paymentMethod: "qris",
      expectedTotal: -1,
      siteUrl: site,
      now: at,
      ...extra,
    };
    const probe = await placeOrder(db, input);
    if (probe.ok || probe.code !== "harga_berubah" || !probe.pricing) throw new Error(`Seed pesanan demo gagal: ${probe.ok ? "total -1 diterima" : probe.message}`);
    const r = await placeOrder(db, { ...input, expectedTotal: probe.pricing.total });
    await db.delete(schema.carts).where(eq(schema.carts.id, cart.id));
    if (!r.ok) throw new Error(`Seed pesanan demo gagal: ${r.message}`);
    return r;
  }
  async function pay(orderId: number, at: Date) {
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
    const c = await confirmPayment(db, { idempotencyKey: p.idempotencyKey, amount: p.amount, actor: "simulasi demo", now: at, siteUrl: site });
    if (!c.ok) throw new Error(`Seed bayar demo gagal: ${c.message}`);
  }
  const step = (number: string, to: "diproses" | "dikirim" | "selesai", at: Date) => transitionOrder(db, number, to, { actor: to === "selesai" ? "pembeli" : "staf demo", now: at, siteUrl: site, reason: to === "selesai" ? "Pembeli mengonfirmasi pesanan diterima" : null });

  // 1. Selesai, 40 hari lalu (belum diulas).
  const t1 = dayAt(40, 10, 12);
  const o1 = await order(
    [
      { variantId: await bestVariant(db, "kirana-lab-niacinamide-10-serum", "gudang-online"), quantity: 1 },
      { variantId: await bestVariant(db, "lumi-water-tint", "gudang-online", "anggur"), quantity: 2 },
    ],
    t1,
    {},
  );
  await pay(o1.orderId, new Date(t1.getTime() + 6 * 60_000));
  await step(o1.number, "diproses", new Date(t1.getTime() + 2 * HOUR));
  await step(o1.number, "dikirim", new Date(t1.getTime() + 5 * HOUR));
  await step(o1.number, "selesai", new Date(t1.getTime() + 2 * DAY));

  // 2. Selesai, 21 hari lalu (belum diulas): foundation shade sesuai profil.
  const t2 = dayAt(21, 19, 41);
  const o2 = await order(
    [
      { variantId: await bestVariant(db, "pualam-second-skin-foundation", "gudang-online", "06n-pasir"), quantity: 1 },
      { variantId: await bestVariant(db, "lumi-cloud-lip-cream", "gudang-online", "01-kopi-susu"), quantity: 1 },
    ],
    t2,
    { paymentMethod: "va_bca" },
  );
  await pay(o2.orderId, new Date(t2.getTime() + 9 * 60_000));
  await step(o2.number, "diproses", new Date(t2.getTime() + 3 * HOUR));
  await step(o2.number, "dikirim", new Date(t2.getTime() + 15 * HOUR));
  await step(o2.number, "selesai", new Date(t2.getTime() + 3 * DAY));

  // 3. Dibatalkan karena tidak dibayar, 10 hari lalu, sempat memakai poin (poin kembali ke saldo).
  const t3 = dayAt(10, 13, 5);
  const o3 = await order([{ variantId: await bestVariant(db, "pualam-velvet-matte-cushion-spf-50", "gudang-online", "06n-pasir"), quantity: 1 }], t3, { pointsRequested: 200 });
  await expireIfDue(db, o3.number, new Date(t3.getTime() + 16 * 60_000), site);

  // 4. Dikirim kemarin, ke alamat kos.
  const t4 = dayAt(2, 9, 27);
  const o4 = await order(
    [
      { variantId: await bestVariant(db, "surya-shield-tinted-sunscreen-spf-40", "gudang-online"), quantity: 1 },
      { variantId: await bestVariant(db, "dayu-volume-up-mascara", "gudang-online"), quantity: 1 },
    ],
    t4,
    { courierCode: "sicepat_reg" },
  );
  await pay(o4.orderId, new Date(t4.getTime() + 4 * 60_000));
  await step(o4.number, "diproses", new Date(t4.getTime() + 2 * HOUR));
  await step(o4.number, "dikirim", dayAt(1, 14, 10));

  // 5. Menunggu Pembayaran: Ambil di Toko Dinoyo dengan Bayar di Toko (batasnya jam tutup hari kerja berikutnya).
  const t5 = new Date(now.getTime() - 50 * 60_000);
  await order([{ variantId: await bestVariant(db, "lumi-water-tint", "dinoyo"), quantity: 1 }], t5, {
    method: "ambil",
    address: null,
    zone: null,
    courierCode: null,
    pickupLocationSlug: "dinoyo",
    paymentMethod: "bayar_di_toko",
  });

  // Wishlist.
  const wishSlugs = ["surya-shield-body-lotion-spf-30", "arunika-hujan-edp", "kirana-lab-vitamin-c-brightening-essence", "dayu-brow-pencil-duo"];
  const wishProducts = await db.select({ id: schema.products.id, slug: schema.products.slug }).from(schema.products).where(inArray(schema.products.slug, wishSlugs));
  await db.insert(schema.wishlists).values(
    wishSlugs
      .map((slug, i) => ({ id: wishProducts.find((p) => p.slug === slug)?.id, i }))
      .filter((w): w is { id: number; i: number } => w.id != null)
      .map((w) => ({ customerId, productId: w.id, createdAt: new Date(now.getTime() - (20 - w.i * 3) * DAY) })),
  );

  // Kabari aku untuk shade yang habis di semua lokasi.
  const [soldOut] = await db
    .select({ id: schema.variants.id })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(and(eq(schema.products.slug, "pualam-velvet-matte-cushion-spf-50"), eq(schema.variants.shadeSlug, "10n-kayu-manis")));
  if (soldOut) await db.insert(schema.restockRequests).values({ variantId: soldOut.id, customerId, contact: DEMO_BUYER_PHONE, status: "menunggu", createdAt: new Date(now.getTime() - 5 * DAY) });

  // Notifikasi lama sudah dibaca; yang 3 hari terakhir belum, supaya penanda belum dibaca terlihat.
  await db
    .update(schema.notifications)
    .set({ readAt: sql`${schema.notifications.createdAt} + interval '2 hours'` })
    .where(and(eq(schema.notifications.customerId, customerId), lt(schema.notifications.createdAt, new Date(now.getTime() - 3 * DAY))));

  return { customerId, orders: [o1.number, o2.number, o3.number, o4.number] };
}
