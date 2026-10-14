import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { revalidateProducts } from "@/lib/orders/revalidate";
import { confirmPayment } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";
import { scheduleEmailDispatch } from "@/lib/email/schedule";

// Satu pintu konfirmasi pembayaran bergaya webhook payment gateway.
// Body JSON: { "idempotency_key": "...", "amount": 123000, "status": "settlement" }
// Header: x-rona-signature = HMAC-SHA256(body mentah, PAYMENT_WEBHOOK_SECRET) dalam hex.
// Aman dipanggil berkali-kali: panggilan kedua untuk kunci yang sama tidak memproses ulang.
export async function POST(request: NextRequest) {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "Webhook belum dikonfigurasi." }, { status: 503 });
  const raw = await request.text();
  const given = request.headers.get("x-rona-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ ok: false, message: "Tanda tangan tidak valid." }, { status: 401 });
  }
  let body: { idempotency_key?: string; amount?: number; status?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, message: "Body bukan JSON." }, { status: 400 });
  }
  if (!body.idempotency_key) return NextResponse.json({ ok: false, message: "idempotency_key wajib." }, { status: 400 });
  if (body.status !== "settlement" && body.status !== "lunas") return NextResponse.json({ ok: true, ignored: true });
  const r = await confirmPayment(db, { idempotencyKey: body.idempotency_key, amount: typeof body.amount === "number" ? body.amount : null, actor: "webhook pembayaran", siteUrl: siteUrl() });
  if (r.ok && !r.alreadyProcessed) await revalidateProducts(r.productIds);
  return NextResponse.json(r, { status: r.ok ? 200 : r.code === "tidak_ditemukan" ? 404 : 409 });
}
