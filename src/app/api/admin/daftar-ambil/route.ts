import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { currentStaff } from "@/lib/admin/current";
import { pickList } from "@/lib/admin/labels";
import { pickListPdf } from "@/lib/admin/pdf";
import { can } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";

// Daftar ambil A4 (PDF): item pesanan terpilih dijumlahkan per varian dan lokasi.
export async function GET(request: NextRequest) {
  const me = await currentStaff();
  if (!me) return NextResponse.json({ ok: false, message: "Masuk sebagai staf dulu." }, { status: 401 });
  if (!can(me, "pesanan.cetak")) return NextResponse.json({ ok: false, message: "Tidak punya izin mencetak." }, { status: 403 });
  const numbers = (request.nextUrl.searchParams.get("nomor") ?? "").split(",").filter(Boolean);
  const r = await pickList(db, me, numbers);
  if (!r.rows.length) return NextResponse.json({ ok: false, message: "Pesanan tidak ditemukan." }, { status: 404 });
  const bytes = await pickListPdf(r.rows, r.orders, now(), me.name);
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": 'inline; filename="daftar-ambil.pdf"', "cache-control": "private, no-store" } });
}
