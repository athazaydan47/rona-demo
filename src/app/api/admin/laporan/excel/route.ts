import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { writeAudit } from "@/lib/admin/audit";
import { currentStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";
import { buildReportWorkbook, periodLabel, reportFileName } from "@/lib/reports/excel";
import { reportForRequest } from "@/lib/reports/request";

// Unduh laporan Excel multi-sheet. Angka dari fungsi laporan yang sama dengan halaman Laporan.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const me = await currentStaff();
  if (!me || !can(me, "laporan.lihat")) return NextResponse.json({ ok: false, message: "Tidak punya izin." }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const at = now();
  const r = await reportForRequest(db, me, { periode: sp.get("periode") ?? undefined, dari: sp.get("dari") ?? undefined, sampai: sp.get("sampai") ?? undefined, lokasi: sp.get("lokasi") ?? undefined }, at);
  if (r.period.error) return NextResponse.json({ ok: false, message: r.period.error }, { status: 400 });
  const wb = await buildReportWorkbook(r.report, r.data, { periodLabel: periodLabel(r.period.from, r.period.to), locationLabel: r.locationLabel, printedBy: me.name, printedAt: at, finance: r.finance });
  const buffer = await wb.xlsx.writeBuffer();
  const file = reportFileName(r.period.firstDay, r.period.lastDay);
  await writeAudit(db, { staff: me, action: "laporan.unduh", objectType: "laporan", objectId: file, summary: `Unduh ${file} (${r.locationLabel})`, at });
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
