import { NextResponse, type NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/catalog/catalog-queries";
import { BATAS, clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const b = BATAS.saranCariPerIp;
  const ip = clientIp(request.headers);
  // Tanpa header IP (lokal, uji) batas dilewati; di Vercel x-forwarded-for selalu ada.
  if (ip !== "lokal" && !limitByKey(`saran:${hashKey(ip)}`, b.limit, b.windowMs)) return NextResponse.json({ error: "Terlalu cepat, coba sebentar lagi." }, { status: 429 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const data = await getSearchSuggestions(q);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30" } });
}
