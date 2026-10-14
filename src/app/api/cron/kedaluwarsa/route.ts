import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { dailyResetOn, DemoResetError, resetDemoData } from "@/lib/demo/reset";
import { dispatchEmails } from "@/lib/email/dispatch";
import { completeDueOrders, expireDueOrders } from "@/lib/orders/service";
import { siteUrl } from "@/lib/site";

// Reset demo bisa memakan beberapa detik di fungsi serverless.
export const maxDuration = 60;

// Cron harian (03.00 WIB, lihat vercel.json). Dipanggil Vercel Cron (GET dengan header Authorization: Bearer
// <CRON_SECRET>) atau penjadwal lain lewat GET atau POST dengan header yang sama. Urutan:
// 1. Batalkan pesanan tak dibayar yang lewat batas waktu.
// 2. Tandai Selesai pesanan yang sudah 3 hari Dikirim.
// 3. Kirim email outbox dan coba ulang yang gagal (EMAIL_PROVIDER=resend).
// 4. Reset data demo, hanya bila DEMO_MODE=true dan DEMO_DAILY_RESET=true.
async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, message: "CRON_SECRET belum diisi." }, { status: 503 });
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, message: "Tidak diizinkan." }, { status: 401 });
  }
  const expired = await expireDueOrders(db, undefined, siteUrl());
  const completed = await completeDueOrders(db, undefined, siteUrl());
  // Kirim email yang menunggu dan coba ulang yang gagal (maksimal 3 percobaan) sebelum reset demo mengosongkan outbox.
  const email = await dispatchEmails(db, { site: siteUrl(), retry: true, limit: 200 }).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  let reset: { ran: boolean; durationMs?: number; message?: string } = { ran: false };
  if (dailyResetOn(process.env)) {
    try {
      const r = await resetDemoData(db, { source: "cron" });
      reset = { ran: true, durationMs: r.durationMs };
    } catch (e) {
      reset = { ran: false, message: e instanceof DemoResetError ? e.message : "Reset data demo gagal." };
    }
  }
  return NextResponse.json({ ok: true, ...expired, completed: completed.completed, completedChecked: completed.checked, email, reset });
}

export const GET = handle;
export const POST = handle;
