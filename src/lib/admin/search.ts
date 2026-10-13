// Pencarian global admin (Cmd+K): pesanan, produk, pelanggan. Hasil dibatasi izin dan lokasi staf.
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { orderScope } from "./orders";
import { can, type StaffPrincipal } from "./permissions";

export type SearchHit = { kind: "pesanan" | "produk" | "pelanggan"; title: string; subtitle: string; href: string };

export async function adminSearch(db: AnyDb, staff: StaffPrincipal, raw: string): Promise<SearchHit[]> {
  const q = String(raw ?? "").trim().replace(/[%_]/g, "").slice(0, 60);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const hits: SearchHit[] = [];
  if (can(staff, "pesanan.lihat")) {
    const orders = await db
      .select({ number: schema.orders.number, status: schema.orders.status, name: schema.orders.guestName, locationName: schema.locations.name })
      .from(schema.orders)
      .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
      .where(and(orderScope(staff), or(ilike(schema.orders.number, like), ilike(schema.orders.guestName, like), ilike(schema.orders.guestPhone, `%${q.replace(/\D/g, "") || q}%`))))
      .orderBy(desc(schema.orders.createdAt))
      .limit(6);
    for (const o of orders) hits.push({ kind: "pesanan", title: o.number, subtitle: `${o.name ?? "Tamu"} · ${statusLabels[o.status as OrderStatus]} · ${o.locationName}`, href: `/admin/pesanan/${o.number}` });
  }
  if (can(staff, "stok.lihat") || can(staff, "produk.kelola")) {
    const products = await db
      .select({ variantId: schema.variants.id, name: schema.products.name, shade: schema.variants.shadeName, sku: schema.variants.sku, brand: schema.brands.name })
      .from(schema.variants)
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
      .where(or(ilike(schema.products.name, like), ilike(schema.variants.sku, like), ilike(schema.brands.name, like)))
      .orderBy(asc(schema.products.name), asc(schema.variants.sortOrder))
      .limit(6);
    for (const p of products) hits.push({ kind: "produk", title: `${p.name}`, subtitle: `${p.brand} · ${p.shade} · ${p.sku}`, href: `/admin/stok/${p.variantId}` });
  }
  if (can(staff, "pelanggan.lihat")) {
    const customers = await db
      .select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone })
      .from(schema.customers)
      .where(or(ilike(schema.customers.name, like), ilike(schema.customers.phone, `%${q.replace(/\D/g, "") || q}%`)))
      .orderBy(asc(schema.customers.name))
      .limit(5);
    for (const c of customers) hits.push({ kind: "pelanggan", title: c.name || "Tanpa nama", subtitle: `${c.phone.slice(0, 4)}••••${c.phone.slice(-3)}`, href: `/admin/pesanan?q=${encodeURIComponent(c.phone)}` });
  }
  return hits;
}
