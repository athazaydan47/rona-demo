import { NextResponse, type NextRequest } from "next/server";
import { getCatalogResult } from "@/lib/catalog/catalog-queries";
import { parseCatalogParams } from "@/lib/catalog/filters";
import { parseScopeParams } from "@/lib/catalog/scope";
import { BATAS, clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";

// Muat bertahap dan hitung hasil untuk bottom sheet filter. Selalu dinamis: memuat harga dan stok.
export async function GET(request: NextRequest) {
  const b = BATAS.katalogPerIp;
  const ip = clientIp(request.headers);
  // Tanpa header IP (lokal, uji) batas dilewati; di Vercel x-forwarded-for selalu ada.
  if (ip !== "lokal" && !limitByKey(`katalog:${hashKey(ip)}`, b.limit, b.windowMs)) return NextResponse.json({ error: "Terlalu cepat, coba sebentar lagi." }, { status: 429 });
  const sp = request.nextUrl.searchParams;
  const scope = parseScopeParams((k) => sp.get(k));
  const params: Record<string, string> = {};
  sp.forEach((v, k) => {
    params[k] = v;
  });
  let filters = parseCatalogParams(params);
  if (scope.kind === "promo") filters = { ...filters, promo: true };
  const result = await getCatalogResult(scope, filters);
  if (sp.get("mode") === "hitung") {
    return NextResponse.json({ total: result.total }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { products: result.products, total: result.total, hasMore: result.hasMore, page: result.page },
    { headers: { "Cache-Control": "no-store" } },
  );
}
