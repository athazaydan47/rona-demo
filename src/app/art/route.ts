import { NextResponse, type NextRequest } from "next/server";
import { packagingValues, type Packaging } from "@/db/schema/enums";
import { productArtSvg } from "@/lib/product/og-svg";

// Packshot ProductArt sebagai berkas SVG yang bisa di-cache (Fase 8A). Halaman memakai <img src="/art?..."> alih-alih
// SVG inline, sehingga HTML dan payload RSC tidak memuat puluhan pohon SVG dan browser mengunduh tiap packshot sekali.
// Keluaran murni fungsi dari parameter, jadi boleh di-cache setahun (immutable).
const HEX = /^[0-9a-f]{6}$/i;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const packaging = q.get("p") ?? "";
  const shade = (q.get("s") ?? "").replace(/^#/, "");
  const brand = (q.get("b") ?? "").replace(/^#/, "");
  const name = (q.get("n") ?? "").slice(0, 40);
  const view = q.get("v") === "detail" ? "detail" : "depan";
  const background = q.get("bg") === "none" ? "none" : "soft";
  if (!(packagingValues as readonly string[]).includes(packaging) || !HEX.test(shade) || !HEX.test(brand)) return NextResponse.json({ ok: false, message: "Parameter gambar tidak valid." }, { status: 400 });
  const svg = productArtSvg({ packaging: packaging as Packaging, shade: `#${shade}`, brandColor: `#${brand}`, brandName: name, view, background });
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${svg}`, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
}
