import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { completeDueOrders, expireDueOrders } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

// Membatalkan pesanan tak dibayar yang lewat batas waktu, lalu menandai Selesai pesanan yang sudah 3 hari Dikirim. Dipanggil Vercel Cron (GET dengan header
// Authorization: Bearer <CRON_SECRET>, lihat vercel.json) atau penjadwal lain lewat GET atau POST dengan header yang sama.
async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, message: "CRON_SECRET belum diisi." }, { status: 503 });
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, message: "Tidak diizinkan." }, { status: 401 });
  }
  const expired = await expireDueOrders(db, undefined, siteUrl());
  const completed = await completeDueOrders(db, undefined, siteUrl());
  return NextResponse.json({ ok: true, ...expired, completed: completed.completed, completedChecked: completed.checked });
}

export const GET = handle;
export const POST = handle;
