// Perlindungan CSRF untuk route handler yang menerima POST dari browser.
// Browser selalu mengirim header Origin pada POST; permintaan dari situs lain ditolak.
// Server action Next.js sudah memeriksa Origin dengan sendirinya.
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";

export function allowedOrigins(request: Request, env: Record<string, string | undefined> = process.env): Set<string> {
  const out = new Set<string>();
  try {
    out.add(new URL(request.url).origin);
  } catch {
    // abaikan
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? (env.NODE_ENV === "production" ? "https" : "http");
    out.add(`${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`);
  }
  try {
    out.add(new URL(siteUrl()).origin);
  } catch {
    // abaikan
  }
  return out;
}

export function isSameOrigin(request: Request, env?: Record<string, string | undefined>) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  return allowedOrigins(request, env).has(origin);
}

export function rejectCrossOrigin(request: Request) {
  if (isSameOrigin(request)) return null;
  return NextResponse.json({ ok: false, message: "Permintaan ditolak." }, { status: 403 });
}
