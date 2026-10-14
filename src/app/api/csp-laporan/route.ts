// Penerima laporan pelanggaran CSP (Fase 8B). Browser mengirim laporan sendiri (report-uri dan Reporting API), jadi
// route ini tidak memeriksa asal. Isinya dicatat sebagai log terstruktur tanpa data pribadi (hanya direktif, URL
// sumber yang diblokir, dan halaman tanpa query), dibatasi ukuran dan jumlah per menit per IP.
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import { normalisasiLaporan } from "@/lib/security/csp";
import { BATAS, clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const b = BATAS.cspPerIp;
  if (!limitByKey(`csp:${hashKey(clientIp(request.headers))}`, b.limit, b.windowMs)) return new NextResponse(null, { status: 204 });
  const text = (await request.text().catch(() => "")).slice(0, 20_000);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  for (const l of normalisasiLaporan(body)) logEvent("csp.pelanggaran", l, "warn");
  return new NextResponse(null, { status: 204 });
}
