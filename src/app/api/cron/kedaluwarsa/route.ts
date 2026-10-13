import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { expireDueOrders } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

// Dipanggil cron (Vercel Cron atau penjadwal lain) dengan header Authorization: Bearer <CRON_SECRET>.
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "CRON_SECRET belum diisi." }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ ok: false, message: "Tidak diizinkan." }, { status: 401 });
  }
  const r = await expireDueOrders(db, undefined, siteUrl());
  return NextResponse.json({ ok: true, ...r });
}

export const GET = handle;
export const POST = handle;
