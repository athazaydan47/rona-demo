import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Route simulasi hanya hidup saat DEMO_MODE=true. Di luar itu menjawab 404 seolah tidak ada.
export function demoOnly() {
  if (!env.demoMode) return NextResponse.json({ ok: false, message: "Tidak tersedia." }, { status: 404 });
  return null;
}
