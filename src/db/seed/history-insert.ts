// Menyisipkan hasil generateHistory secara massal (beberapa kueri besar), lalu stok akhir, terjual, dan kuota.
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import type { AnyDb } from "../../lib/db-types";
import type { HistoryOutput } from "./history";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function insertReturningIds<T extends Record<string, unknown>>(db: AnyDb, table: Parameters<AnyDb["insert"]>[0], rows: T[], size: number): Promise<number[]> {
  const ids: number[] = [];
  for (const part of chunk(rows, size)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (await db.insert(table).values(part as any).returning({ id: (table as any).id })) as { id: number }[];
    ids.push(...r.map((x) => x.id).sort((a, b) => a - b));
  }
  return ids;
}

export async function insertHistory(db: AnyDb, out: HistoryOutput, inventory: { variantId: number; locationId: number; onHand: number }[]) {
  const customerIds = await insertReturningIds(db, schema.customers, out.customers.map((c) => ({ name: c.name, phone: c.phone, email: c.email, points: c.points, registeredAt: c.registeredAt, lastLoginAt: c.lastLoginAt, skinProfile: c.skinProfile })), 1000);
  // Alamat tersimpan = alamat kirim pesanan pelanggan itu (satu alamat utama per pelanggan yang pernah mengirim).
  const addressRows = out.customers.flatMap((c, i) => (c.address ? [{ customerId: customerIds[i], label: "Rumah", recipient: c.address.recipient, phone: c.address.phone, province: c.address.province, city: c.address.city, district: c.address.district, postalCode: c.address.postalCode, street: c.address.street, isPrimary: true, createdAt: c.registeredAt }] : []));
  if (addressRows.length) await db.insert(schema.addresses).values(addressRows);
  const saleIds = out.flashSales.length ? await insertReturningIds(db, schema.flashSales, out.flashSales.map((s) => ({ ...s, isActive: true, source: "otomatis" })), 1000) : [];
  const itemIds = out.flashItems.length ? await insertReturningIds(db, schema.flashSaleItems, out.flashItems.map((f) => ({ flashSaleId: saleIds[f.sale], variantId: f.variantId, flashPrice: f.flashPrice, quota: f.quota, sold: f.sold, maxPerCustomer: f.maxPerCustomer })), 1500) : [];
  const orderIds = await insertReturningIds(
    db,
    schema.orders,
    out.orders.map(({ customer, ...o }) => ({ ...o, customerId: customer != null ? customerIds[customer] : null })),
    400,
  );
  for (const part of chunk(out.items, 1000)) {
    await db.insert(schema.orderItems).values(part.map((i) => ({ orderId: orderIds[i.order], variantId: i.variantId, productName: i.productName, shadeName: i.shadeName, brandName: i.brandName, unitPrice: i.unitPrice, normalPrice: i.normalPrice, quantity: i.quantity, priceSource: i.priceSource, flashSaleItemId: i.flashItem != null ? itemIds[i.flashItem] : null, weightGram: i.weightGram, source: i.source ?? null })));
  }
  for (const part of chunk(out.payments, 1000)) await db.insert(schema.payments).values(part.map(({ order, ...p }) => ({ ...p, orderId: orderIds[order] })));
  for (const part of chunk(out.history, 1500)) await db.insert(schema.orderStatusHistory).values(part.map(({ order, ...h }) => ({ ...h, orderId: orderIds[order] })));
  for (const part of chunk(out.shipments, 1000)) await db.insert(schema.shipments).values(part.map(({ order, ...s }) => ({ ...s, orderId: orderIds[order] })));
  for (const part of chunk(out.movements, 1500)) await db.insert(schema.stockMovements).values(part);
  for (const part of chunk(out.ledger, 1500)) await db.insert(schema.pointsLedger).values(part.map(({ customer, key, ...l }) => ({ ...l, customerId: customerIds[customer], idempotencyKey: key })));
  for (const part of chunk(out.redemptions, 1000)) await db.insert(schema.voucherRedemptions).values(part.map(({ customer, order, ...r }) => ({ ...r, customerId: customer != null ? customerIds[customer] : null, orderId: orderIds[order] })));

  if (out.voucherUsed.size) {
    const rows = [...out.voucherUsed.entries()].map(([id, used]) => sql`(${id}::int, ${used}::int)`);
    await db.execute(sql`update vouchers set used = v.used from (values ${sql.join(rows, sql`, `)}) as v(id, used) where vouchers.id = v.id`);
  }
  if (out.counters.size) await db.insert(schema.orderNumberCounters).values([...out.counters.entries()].map(([period, lastValue]) => ({ period, lastValue })));
  if (out.soldByProduct.size) {
    const rows = [...out.soldByProduct.entries()].map(([id, n]) => sql`(${id}::int, ${n}::int)`);
    await db.execute(sql`update products set sold_count = v.n from (values ${sql.join(rows, sql`, `)}) as v(id, n) where products.id = v.id`);
  }
  // Stok akhir: stok fisik dari seed, dipesan dari pesanan yang masih menunggu pembayaran.
  for (const part of chunk(inventory, 1000)) {
    await db.insert(schema.inventory).values(part.map((i) => ({ ...i, reserved: out.reserved.get(`${i.variantId}:${i.locationId}`) ?? 0 })));
  }
  for (const part of chunk(out.advisorEvents ?? [], 1000)) await db.insert(schema.advisorEvents).values(part.map((e) => ({ kind: e.kind, visitorHash: "seed", createdAt: e.createdAt })));
  return { customers: customerIds.length, orders: orderIds.length, items: out.items.length, movements: out.movements.length };
}
