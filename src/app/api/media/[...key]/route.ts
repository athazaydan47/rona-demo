import { NextResponse, type NextRequest } from "next/server";
import { readLocalPhoto, storageKind } from "@/lib/reviews/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

// Menyajikan foto ulasan dari disk lokal (hanya mode penyimpanan lokal saat dev).
export async function GET(_request: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (storageKind() !== "lokal") return new NextResponse(null, { status: 404 });
  const { key } = await ctx.params;
  const joined = key.join("/");
  const bytes = await readLocalPhoto(joined);
  if (!bytes) return new NextResponse(null, { status: 404 });
  const ext = joined.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
}
