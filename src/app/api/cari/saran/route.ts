import { NextResponse, type NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/catalog/catalog-queries";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const data = await getSearchSuggestions(q);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30" } });
}
