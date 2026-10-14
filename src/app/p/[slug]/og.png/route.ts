import { NextResponse, type NextRequest } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import { productArtInnerSvg } from "@/lib/product/og-svg";
import { getProductDetail } from "@/lib/product/queries";
import { formatRupiah } from "@/lib/format";
import { mix } from "@/lib/color";
import { MEREK } from "@/config/merek";

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

// Gambar OG 1200 x 630 dirasterisasi dari ProductArt dengan resvg.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product || product.variants.length === 0) return new NextResponse("Tidak ditemukan", { status: 404 });
  const shadeSlug = request.nextUrl.searchParams.get("shade");
  const v = product.variants.find((x) => x.shadeSlug === shadeSlug) ?? product.variants[0];
  const inner = productArtInnerSvg({ packaging: product.packaging, shade: v.hex, brandColor: product.brand.color, brandName: product.brand.name });
  const bg1 = mix(v.hex, "#FAF7F5", 0.85);
  const bg2 = mix(v.hex, "#F4DCDF", 0.7);
  const title = product.name.length > 42 ? `${product.name.slice(0, 41)}…` : product.name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="930" cy="330" r="250" fill="#FFFFFF" fill-opacity="0.45"/>
  <svg x="720" y="70" width="420" height="504" viewBox="0 0 200 240">${inner}</svg>
  <text x="80" y="120" font-family="Georgia, serif" font-size="30" fill="#B8475D" font-weight="600">${MEREK.nama}</text>
  <text x="156" y="120" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="4" fill="#B8475D">BEAUTY</text>
  <text x="80" y="205" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="3" fill="#6E615D">${esc(product.brand.name.toUpperCase())}</text>
  <text x="80" y="290" font-family="Georgia, serif" font-size="56" fill="#2A1F1D">${esc(title)}</text>
  ${product.variants.length > 1 ? `<text x="80" y="345" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#6E615D">Shade ${esc(v.shadeName)}</text>` : ""}
  <text x="80" y="430" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#2A1F1D">${esc(formatRupiah(v.salePrice))}</text>
  <text x="80" y="560" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#6E615D">Toko demo dengan data fiktif · ${MEREK.domainDemo}</text>
</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" } }).render().asPng();
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
}
