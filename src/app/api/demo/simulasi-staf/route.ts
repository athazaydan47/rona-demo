import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { demoOnly } from "@/lib/orders/demo-guard";
import { canAccessOrder, getOrderDetail } from "@/lib/orders/queries";
import { revalidateProducts } from "@/lib/orders/revalidate";
import { markPaidAndPickedUp } from "@/lib/orders/service";
import { rejectCrossOrigin } from "@/lib/security/origin";
import { siteUrl } from "@/lib/site";

// Simulasi staf cabang: tandai lunas dan sudah diambil (pesanan Bayar di Toko).
export async function POST(request: NextRequest) {
  const blocked = demoOnly();
  if (blocked) return blocked;
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const body = (await request.json().catch(() => ({}))) as { nomor?: string; token?: string };
  const order = body.nomor ? await getOrderDetail(db, String(body.nomor)) : null;
  if (!order || !canAccessOrder(order, body.token, [], (await currentCustomer())?.customerId)) return NextResponse.json({ ok: false, message: "Pesanan tidak ditemukan." }, { status: 404 });
  const r = await markPaidAndPickedUp(db, order.number, { actor: "staf demo", siteUrl: siteUrl() });
  if (r.ok) await revalidateProducts(r.productIds);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
