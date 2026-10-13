import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { demoOnly } from "@/lib/orders/demo-guard";
import { canAccessOrder, getOrderDetail } from "@/lib/orders/queries";
import { revalidateProducts } from "@/lib/orders/revalidate";
import { confirmPayment } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

// Simulasi pembayaran berhasil. Lewat satu pintu yang sama dengan webhook (confirmPayment).
export async function POST(request: NextRequest) {
  const blocked = demoOnly();
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { nomor?: string; token?: string };
  const order = body.nomor ? await getOrderDetail(db, String(body.nomor)) : null;
  if (!order || !order.payment || !canAccessOrder(order, body.token, [])) return NextResponse.json({ ok: false, message: "Pesanan tidak ditemukan." }, { status: 404 });
  const r = await confirmPayment(db, { idempotencyKey: order.payment.idempotencyKey, amount: order.payment.amount, actor: "simulasi demo", siteUrl: siteUrl() });
  if (r.ok && !r.alreadyProcessed) await revalidateProducts(r.productIds);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
