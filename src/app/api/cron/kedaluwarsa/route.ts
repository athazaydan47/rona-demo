import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { expireDueOrders } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

// Membatalkan pesanan tak dibayar yang lewat batas waktu. Dipanggil Vercel Cron (GET dengan header
// Authorization: Bearer <CRON_SECRET>, lihat vercel.json) atau penjadwal lain lewat GET atau POST dengan header yang sama.
async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, message: "CRON_SECRET belum diisi." }, { status: 503 });
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, message: "Tidak diizinkan." }, { status: 401 });
  }
  const r = await expireDueOrders(db, undefined, siteUrl());
  return NextResponse.json({ ok: true, ...r });
}

export const GET = handle;
export const POST = handle;
