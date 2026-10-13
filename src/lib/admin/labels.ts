// Data label kirim A6 dan daftar ambil A4. Dipakai PDF (pdf-lib) dan halaman pratinjau HTML yang sama isinya.
import { and, asc, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { courierLabel } from "@/lib/orders/service";
import { can, type StaffPrincipal } from "./permissions";

export type LabelData = {
  number: string;
  method: "kirim" | "ambil";
  sender: { name: string; place: string; address: string; phone: string };
  recipient: { name: string; phone: string; lines: string[] };
  courier: string;
  service: string;
  weightGram: number;
  itemCount: number;
  note: string;
  items: { name: string; shade: string; qty: number }[];
  qrText: string;
};

export async function labelData(db: AnyDb, staff: StaffPrincipal, numbers: string[]): Promise<{ labels: LabelData[]; denied: string[] }> {
  const list = [...new Set(numbers.map((n) => n.trim().toUpperCase()).filter((n) => /^RONA-\d{4}-\d{6,}$/.test(n)))].slice(0, 100);
  if (!list.length) return { labels: [], denied: [] };
  const orders = await db
    .select({ order: schema.orders, location: schema.locations })
    .from(schema.orders)
    .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
    .where(inArray(schema.orders.number, list));
  const allowed = orders.filter((o) => can(staff, "pesanan.cetak", { lokasiId: o.order.locationId }));
  const denied = list.filter((n) => !allowed.some((o) => o.order.number === n));
  const ids = allowed.map((o) => o.order.id);
  const items = ids.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, ids)).orderBy(asc(schema.orderItems.id)) : [];
  const labels = list
    .map((n) => allowed.find((o) => o.order.number === n))
    .filter((o) => o != null)
    .map(({ order, location }) => {
      const mine = items.filter((i) => i.orderId === order.id);
      const merged = new Map<string, { name: string; shade: string; qty: number }>();
      for (const i of mine) {
        const k = `${i.productName}|${i.shadeName}`;
        const prev = merged.get(k);
        if (prev) prev.qty += i.quantity;
        else merged.set(k, { name: i.productName, shade: i.shadeName, qty: i.quantity });
      }
      const a = order.shippingAddress;
      return {
        number: order.number,
        method: order.method,
        sender: { name: "Rona Beauty", place: location.name, address: [location.address, location.district, location.city].filter(Boolean).join(", "), phone: location.phone || "0812 0000 0000" },
        recipient: a
          ? { name: a.recipient, phone: a.phone, lines: [a.street, `${a.district}, ${a.city}`, `${a.province} ${a.postalCode}`] }
          : { name: order.guestName ?? "Pembeli", phone: order.guestPhone ?? "", lines: [`Ambil di ${location.name}`, location.address] },
        courier: order.method === "ambil" ? "Ambil di Toko" : courierLabel(order.courier),
        service: order.service ?? "",
        weightGram: order.pricing?.weightGram || mine.reduce((s, i) => s + i.weightGram * i.quantity, 0),
        itemCount: mine.reduce((s, i) => s + i.quantity, 0),
        note: order.note,
        items: [...merged.values()],
        qrText: order.number,
      } satisfies LabelData;
    });
  return { labels, denied };
}

export type PickRow = { sku: string; productName: string; shadeName: string; quantity: number; locationName: string; orders: string[] };

// Daftar ambil: item dari pesanan terpilih dijumlahkan per varian dan lokasi.
export async function pickList(db: AnyDb, staff: StaffPrincipal, numbers: string[]) {
  const list = [...new Set(numbers.map((n) => n.trim().toUpperCase()))].slice(0, 200);
  if (!list.length) return { rows: [] as PickRow[], orders: [] as string[], denied: [] as string[] };
  const rows = await db
    .select({ number: schema.orders.number, locationId: schema.orders.locationId, locationName: schema.locations.name, sku: schema.variants.sku, productName: schema.orderItems.productName, shadeName: schema.orderItems.shadeName, quantity: schema.orderItems.quantity })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
    .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
    .where(and(inArray(schema.orders.number, list)))
    .orderBy(asc(schema.locations.sortOrder), asc(schema.orderItems.productName));
  const allowedRows = rows.filter((r) => can(staff, "pesanan.cetak", { lokasiId: r.locationId }));
  const map = new Map<string, PickRow>();
  for (const r of allowedRows) {
    const k = `${r.locationName}|${r.sku}`;
    const prev = map.get(k);
    if (prev) {
      prev.quantity += r.quantity;
      if (!prev.orders.includes(r.number)) prev.orders.push(r.number);
    } else map.set(k, { sku: r.sku, productName: r.productName, shadeName: r.shadeName, quantity: r.quantity, locationName: r.locationName, orders: [r.number] });
  }
  const orders = [...new Set(allowedRows.map((r) => r.number))];
  return { rows: [...map.values()], orders, denied: list.filter((n) => !orders.includes(n)) };
}
