// Galat dari browser (Fase 8B): halaman galat mengirim pesan singkat ke sini, lalu server mencatatnya dan meneruskan
// ke Sentry bila SENTRY_DSN diisi. Asal wajib sama, ukuran dan jumlah per menit dibatasi.
import { NextResponse, type NextRequest } from "next/server";
import { laporGalat } from "@/lib/galat";
import { BATAS, clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";
import { rejectCrossOrigin } from "@/lib/security/origin";

export async function POST(request: NextRequest) {
  const cross = rejectCrossOrigin(request);
  if (cross) return cross;
  const b = BATAS.galatKlienPerIp;
  if (!limitByKey(`galat:${hashKey(clientIp(request.headers))}`, b.limit, b.windowMs)) return new NextResponse(null, { status: 204 });
  const raw = (await request.text().catch(() => "")).slice(0, 4000);
  let d: { pesan?: unknown; digest?: unknown; url?: unknown } = {};
  try {
    d = JSON.parse(raw) as typeof d;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const err = new Error(String(d.pesan ?? "Galat di browser").slice(0, 300));
  err.name = "GalatKlien";
  await laporGalat(err, { sisi: "klien", tempat: "halaman galat", url: typeof d.url === "string" ? d.url : undefined, digest: typeof d.digest === "string" ? d.digest.slice(0, 40) : undefined });
  return new NextResponse(null, { status: 204 });
}
