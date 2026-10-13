import { NextResponse, type NextRequest } from "next/server";
import { clockOffset, now, setClockOffset } from "@/lib/clock";
import { demoOnly } from "@/lib/orders/demo-guard";

// Hanya untuk uji Playwright: memajukan jam server. Butuh DEMO_MODE=true dan ALLOW_CLOCK_OVERRIDE=true.
function guard() {
  const blocked = demoOnly();
  if (blocked) return blocked;
  if (process.env.ALLOW_CLOCK_OVERRIDE !== "true") return NextResponse.json({ ok: false, message: "Tidak tersedia." }, { status: 404 });
  return null;
}

export async function GET() {
  const blocked = guard();
  if (blocked) return blocked;
  return NextResponse.json({ ok: true, offsetMinutes: clockOffset() / 60_000, now: now().toISOString() });
}

export async function POST(request: NextRequest) {
  const blocked = guard();
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { menit?: number };
  const minutes = Number(body.menit ?? 0);
  if (!Number.isFinite(minutes) || Math.abs(minutes) > 60 * 24 * 7) return NextResponse.json({ ok: false, message: "Nilai menit tidak valid." }, { status: 400 });
  setClockOffset(minutes * 60_000);
  return NextResponse.json({ ok: true, offsetMinutes: minutes, now: now().toISOString() });
}
