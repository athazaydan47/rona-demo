import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { currentStaff } from "@/lib/admin/current";
import { labelData } from "@/lib/admin/labels";
import { labelsPdf } from "@/lib/admin/pdf";
import { can } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";

// Label kirim A6 (PDF) untuk satu atau beberapa pesanan: /api/admin/label?nomor=RONA-2610-000001,RONA-2610-000002
// GET tanpa efek samping; hanya untuk staf dengan izin pesanan.cetak di lokasi pesanannya.
export async function GET(request: NextRequest) {
  const me = await currentStaff();
  if (!me) return NextResponse.json({ ok: false, message: "Masuk sebagai staf dulu." }, { status: 401 });
  if (!can(me, "pesanan.cetak")) return NextResponse.json({ ok: false, message: "Tidak punya izin mencetak." }, { status: 403 });
  const numbers = (request.nextUrl.searchParams.get("nomor") ?? "").split(",").filter(Boolean);
  const { labels } = await labelData(db, me, numbers);
  if (!labels.length) return NextResponse.json({ ok: false, message: "Pesanan tidak ditemukan." }, { status: 404 });
  const bytes = await labelsPdf(labels, now());
  return new NextResponse(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="label-${labels.length === 1 ? labels[0].number : `${labels.length}-pesanan`}.pdf"`, "cache-control": "private, no-store" },
  });
}
