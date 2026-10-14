// Pemeriksa konsistensi data (seed riwayat maupun data hidup): buku stok = stok fisik, dipesan = pesanan menunggu
// pembayaran, saldo poin = buku poin, terjual = unit dari pesanan yang pernah dibayar, kuota flash dan voucher
// terpakai = pemakaian dari pesanan yang tidak batal.
import { sql } from "drizzle-orm";
import type { AnyDb } from "@/lib/db-types";
import { checkPointsConsistency } from "@/lib/points";

export type ConsistencyIssue = { check: "stok" | "dipesan" | "poin" | "terjual" | "flash" | "voucher"; key: string; expected: number; actual: number };

const rows = async <T>(db: AnyDb, q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];

export async function checkDataConsistency(db: AnyDb) {
  const issues: ConsistencyIssue[] = [];
  const stock = await rows<{ v: number; l: number; on_hand: number; ledger: number }>(
    db,
    sql`select i.variant_id as v, i.location_id as l, i.on_hand, coalesce(sum(m.quantity) filter (where m.type in ('masuk', 'keluar', 'transfer', 'opname', 'retur')), 0)::int as ledger
        from inventory i left join stock_movements m on m.variant_id = i.variant_id and m.location_id = i.location_id
        group by i.variant_id, i.location_id, i.on_hand`,
  );
  for (const r of stock) if (Number(r.on_hand) !== Number(r.ledger)) issues.push({ check: "stok", key: `${r.v}:${r.l}`, expected: Number(r.ledger), actual: Number(r.on_hand) });

  const reserved = await rows<{ v: number; l: number; reserved: number; pending: number }>(
    db,
    sql`select i.variant_id as v, i.location_id as l, i.reserved, coalesce(sum(oi.quantity) filter (where o.status = 'menunggu_pembayaran'), 0)::int as pending
        from inventory i
        left join orders o on o.location_id = i.location_id and o.status = 'menunggu_pembayaran'
        left join order_items oi on oi.order_id = o.id and oi.variant_id = i.variant_id
        group by i.variant_id, i.location_id, i.reserved`,
  );
  for (const r of reserved) if (Number(r.reserved) !== Number(r.pending)) issues.push({ check: "dipesan", key: `${r.v}:${r.l}`, expected: Number(r.pending), actual: Number(r.reserved) });

  for (const p of await checkPointsConsistency(db)) issues.push({ check: "poin", key: String(p.customerId), expected: p.ledger, actual: p.balance });

  const sold = await rows<{ id: number; sold_count: number; paid: number }>(
    db,
    sql`select p.id, p.sold_count, coalesce(sum(oi.quantity) filter (where o.paid_at is not null), 0)::int as paid
        from products p
        left join variants v on v.product_id = p.id
        left join order_items oi on oi.variant_id = v.id
        left join orders o on o.id = oi.order_id
        group by p.id, p.sold_count`,
  );
  for (const r of sold) if (Number(r.sold_count) !== Number(r.paid)) issues.push({ check: "terjual", key: String(r.id), expected: Number(r.paid), actual: Number(r.sold_count) });

  const flash = await rows<{ id: number; sold: number; used: number }>(
    db,
    sql`select f.id, f.sold, coalesce(sum(oi.quantity) filter (where o.status <> 'dibatalkan'), 0)::int as used
        from flash_sale_items f left join order_items oi on oi.flash_sale_item_id = f.id left join orders o on o.id = oi.order_id
        group by f.id, f.sold`,
  );
  for (const r of flash) if (Number(r.sold) !== Number(r.used)) issues.push({ check: "flash", key: String(r.id), expected: Number(r.used), actual: Number(r.sold) });

  const vouchers = await rows<{ code: string; used: number; redeemed: number }>(
    db,
    sql`select v.code, v.used, count(r.id)::int as redeemed from vouchers v left join voucher_redemptions r on r.voucher_id = v.id group by v.id, v.code, v.used`,
  );
  for (const r of vouchers) if (Number(r.used) !== Number(r.redeemed)) issues.push({ check: "voucher", key: r.code, expected: Number(r.redeemed), actual: Number(r.used) });

  return { ok: issues.length === 0, issues };
}
