// Pesanan di panel admin. Semua aksi memeriksa izin dengan can() (termasuk lokasi pesanan), status asal yang
// dilihat staf (cegah tabrakan antar staf), lalu menjalankan state machine yang sama dengan sisi pembeli.
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { statusLabels, type OrderMethod, type OrderStatus } from "@/lib/orders/status";
import { applyTransition, OrderConflictError } from "@/lib/orders/service";
import { writeAudit } from "./audit";
import { allLocations, can, type StaffPrincipal } from "./permissions";

export { KANBAN_COLUMNS, planMove, availableActions, type MoveContext, type MovePlan } from "./kanban";
import { KANBAN_COLUMNS, planMove } from "./kanban";

export type ChangeStatusInput = { number: string; from: OrderStatus; to: OrderStatus; reason?: string | null; trackingNumber?: string | null; courierName?: string | null; now?: Date; siteUrl?: string };
export type ChangeStatusResult = { ok: true; number: string; status: OrderStatus; productIds: number[] } | { ok: false; code: "tidak_ditemukan" | "izin" | "tabrakan" | "tidak_sah" | "isian"; message: string };

export async function changeOrderStatus(db: AnyDb, staff: StaffPrincipal, input: ChangeStatusInput): Promise<ChangeStatusResult> {
  const at = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.select().from(schema.orders).where(eq(schema.orders.number, input.number)).for("update");
      // Pesanan lokasi lain dijawab sama dengan yang tidak ada (tidak membocorkan keberadaannya).
      if (!row || !can(staff, "pesanan.lihat", { lokasiId: row.locationId })) return { ok: false as const, code: "tidak_ditemukan" as const, message: "Pesanan tidak ditemukan." };
      if (row.status !== input.from) throw new OrderConflictError();
      const [payment] = await tx.select({ id: schema.payments.id, method: schema.payments.method, status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.orderId, row.id)).orderBy(desc(schema.payments.id)).limit(1);
      const plan = planMove({ status: row.status as OrderStatus, method: row.method, paymentMethod: payment?.method ?? null }, input.to);
      if (!plan.ok) return { ok: false as const, code: "tidak_sah" as const, message: plan.reason };
      if (!can(staff, plan.permission, { lokasiId: row.locationId })) return { ok: false as const, code: "izin" as const, message: "Kamu tidak punya izin untuk aksi ini." };
      const reason = (input.reason ?? "").trim();
      const resi = (input.trackingNumber ?? "").trim().toUpperCase();
      if (plan.needs === "alasan" && reason.length < 3) return { ok: false as const, code: "isian" as const, message: "Tulis alasannya dulu." };
      if (plan.needs === "resi" && (!/^[A-Z0-9-]{6,30}$/.test(resi) || !(input.courierName ?? "").trim())) return { ok: false as const, code: "isian" as const, message: "Isi kurir dan nomor resi (6 sampai 30 huruf atau angka)." };
      const locked = { ...row, paymentMethod: payment?.method ?? null, paymentId: payment?.id ?? null, paymentStatus: payment?.status ?? null };
      for (const [i, step] of plan.steps.entries()) {
        const when = new Date(at.getTime() + i * 1000);
        await applyTransition(tx, locked, step, {
          actor: staff.name,
          reason: step === "dibatalkan" || step === "diretur" ? reason : plan.payAtStore && step === "dibayar" ? "Dibayar di kasir" : plan.payAtStore && step === "selesai" ? "Sudah diambil pembeli" : null,
          now: when,
          payAtStoreHandover: plan.payAtStore && step === "selesai",
          trackingNumber: step === "dikirim" ? resi : null,
          courierName: step === "dikirim" ? input.courierName : null,
          siteUrl: input.siteUrl,
        });
        if (step === "dibayar") locked.paymentStatus = "lunas";
      }
      await writeAudit(tx, {
        staff,
        action: input.to === "dibatalkan" ? "pesanan.batal" : "pesanan.status",
        objectType: "pesanan",
        objectId: row.number,
        locationId: row.locationId,
        summary: `${plan.label}: ${statusLabels[row.status as OrderStatus]} ke ${statusLabels[input.to]}`,
        before: { status: row.status },
        after: { status: input.to, ...(reason ? { alasan: reason } : {}), ...(resi ? { resi, kurir: input.courierName } : {}) },
        at,
      });
      const products = await tx.selectDistinct({ productId: schema.variants.productId }).from(schema.orderItems).innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id)).where(eq(schema.orderItems.orderId, row.id));
      return { ok: true as const, number: row.number, status: input.to, productIds: products.map((p) => p.productId) };
    });
  } catch (e) {
    if (e instanceof OrderConflictError) return { ok: false, code: "tabrakan", message: e.message };
    throw e;
  }
}

// Aksi massal "Proses pesanan terpilih": Dibayar ke Diproses untuk pesanan kirim (ambil di toko: Siap Diambil).
export async function processSelected(db: AnyDb, staff: StaffPrincipal, numbers: string[], opts: { now?: Date; siteUrl?: string } = {}) {
  const results: { number: string; ok: boolean; message?: string }[] = [];
  for (const number of [...new Set(numbers)].slice(0, 100)) {
    const [o] = await db.select({ status: schema.orders.status, method: schema.orders.method }).from(schema.orders).where(eq(schema.orders.number, number)).limit(1);
    if (!o) {
      results.push({ number, ok: false, message: "Pesanan tidak ditemukan." });
      continue;
    }
    if (o.status !== "dibayar") {
      results.push({ number, ok: false, message: `Berstatus ${statusLabels[o.status as OrderStatus]}, dilewati.` });
      continue;
    }
    const r = await changeOrderStatus(db, staff, { number, from: "dibayar", to: o.method === "ambil" ? "siap_diambil" : "diproses", now: opts.now, siteUrl: opts.siteUrl });
    results.push({ number, ok: r.ok, message: r.ok ? undefined : r.message });
  }
  return results;
}

export type AdminOrderFilters = { status?: OrderStatus | null; method?: OrderMethod | null; locationId?: number | null; courier?: string | null; from?: Date | null; to?: Date | null; q?: string | null; page?: number; pageSize?: number };

// Kondisi lokasi untuk staf yang hanya mengampu lokasi tertentu.
export function orderScope(staff: StaffPrincipal): SQL | undefined {
  return allLocations(staff) ? undefined : inArray(schema.orders.locationId, staff.locationIds.length ? staff.locationIds : [-1]);
}

export type AdminOrderRow = {
  id: number;
  number: string;
  status: OrderStatus;
  method: OrderMethod;
  paymentMethod: string | null;
  name: string;
  phone: string;
  total: number;
  courier: string | null;
  service: string | null;
  locationId: number;
  locationName: string;
  createdAt: Date;
  paidAt: Date | null;
  itemCount: number;
  firstItem: { productName: string; shadeName: string; packaging: string; hex: string; brandColor: string; brandName: string } | null;
};

export async function listAdminOrders(db: AnyDb, staff: StaffPrincipal, f: AdminOrderFilters) {
  const conds: (SQL | undefined)[] = [orderScope(staff)];
  if (f.status) conds.push(eq(schema.orders.status, f.status));
  if (f.method) conds.push(eq(schema.orders.method, f.method));
  if (f.locationId) conds.push(eq(schema.orders.locationId, f.locationId));
  if (f.courier) conds.push(eq(schema.orders.courier, f.courier));
  if (f.from) conds.push(gte(schema.orders.createdAt, f.from));
  if (f.to) conds.push(lt(schema.orders.createdAt, f.to));
  const q = (f.q ?? "").trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(schema.orders.number, like), ilike(schema.orders.guestName, like), ilike(schema.orders.guestPhone, like.replace(/\s/g, "")))!);
  }
  const where = and(...conds.filter(Boolean));
  const pageSize = f.pageSize ?? 20;
  const page = Math.max(1, f.page ?? 1);
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(schema.orders).where(where),
    db
      .select({
        id: schema.orders.id,
        number: schema.orders.number,
        status: schema.orders.status,
        method: schema.orders.method,
        name: schema.orders.guestName,
        phone: schema.orders.guestPhone,
        total: schema.orders.total,
        courier: schema.orders.courier,
        service: schema.orders.service,
        locationId: schema.orders.locationId,
        locationName: schema.locations.name,
        createdAt: schema.orders.createdAt,
        paidAt: schema.orders.paidAt,
      })
      .from(schema.orders)
      .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
      .where(where)
      .orderBy(desc(schema.orders.createdAt), desc(schema.orders.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const enriched = await enrichOrders(db, rows);
  return { rows: enriched, total: Number(n), page, pageCount: Math.max(1, Math.ceil(Number(n) / pageSize)) };
}

async function enrichOrders<T extends { id: number; name: string | null; phone: string | null; status: string }>(db: AnyDb, rows: T[]) {
  const ids = rows.map((r) => r.id);
  const [items, payments] = ids.length
    ? await Promise.all([
        db
          .select({ orderId: schema.orderItems.orderId, quantity: schema.orderItems.quantity, productName: schema.orderItems.productName, shadeName: schema.orderItems.shadeName, packaging: schema.products.packaging, hex: schema.variants.hex, brandColor: schema.brands.color, brandName: schema.brands.name })
          .from(schema.orderItems)
          .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
          .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
          .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
          .where(inArray(schema.orderItems.orderId, ids))
          .orderBy(asc(schema.orderItems.id)),
        db.select({ orderId: schema.payments.orderId, method: schema.payments.method }).from(schema.payments).where(inArray(schema.payments.orderId, ids)),
      ])
    : [[], []];
  return rows.map((r) => {
    const mine = items.filter((i) => i.orderId === r.id);
    return {
      ...r,
      status: r.status as OrderStatus,
      name: r.name ?? "",
      phone: r.phone ?? "",
      paymentMethod: payments.find((p) => p.orderId === r.id)?.method ?? null,
      itemCount: mine.reduce((s, i) => s + i.quantity, 0),
      firstItem: mine[0] ? { productName: mine[0].productName, shadeName: mine[0].shadeName, packaging: mine[0].packaging, hex: mine[0].hex, brandColor: mine[0].brandColor, brandName: mine[0].brandName } : null,
    };
  }) as unknown as AdminOrderRow[];
}

// Papan kanban: pesanan terbaru per kolom (aktif semua; Selesai dan Dibatalkan 14 hari terakhir).
export async function kanbanBoard(db: AnyDb, staff: StaffPrincipal, now: Date, perColumn = 30) {
  const recent = new Date(now.getTime() - 14 * 24 * 60 * 60_000);
  const columns = await Promise.all(
    KANBAN_COLUMNS.map(async (status) => {
      const where = and(orderScope(staff), eq(schema.orders.status, status), status === "selesai" || status === "dibatalkan" ? gte(schema.orders.updatedAt, recent) : undefined);
      const [[{ n }], rows] = await Promise.all([
        db.select({ n: count() }).from(schema.orders).where(where),
        db
          .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, method: schema.orders.method, name: schema.orders.guestName, phone: schema.orders.guestPhone, total: schema.orders.total, courier: schema.orders.courier, service: schema.orders.service, locationId: schema.orders.locationId, locationName: schema.locations.name, createdAt: schema.orders.createdAt, paidAt: schema.orders.paidAt })
          .from(schema.orders)
          .innerJoin(schema.locations, eq(schema.orders.locationId, schema.locations.id))
          .where(where)
          .orderBy(desc(schema.orders.updatedAt), desc(schema.orders.id))
          .limit(perColumn),
      ]);
      return { status, total: Number(n), orders: await enrichOrders(db, rows) };
    }),
  );
  return columns;
}
