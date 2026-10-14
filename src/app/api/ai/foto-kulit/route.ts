import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { aiConfig, aiModel } from "@/lib/ai";
import { readImages } from "@/lib/ai/images";
import { analyzeSkinPhoto } from "@/lib/ai/skin-photo";
import { checkDailyFeatureLimit, LIMITS } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { now } from "@/lib/clock";
import { rejectCrossOrigin } from "@/lib/security/origin";

// Bantu isi kuis dari foto (opsional). Foto hanya dibaca ke memori untuk satu panggilan model lalu dibuang: tidak
// ditulis ke disk, Blob, database, cache, atau log. Batas 5 foto per pengunjung per hari plus batas global.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const cfg = aiConfig();
  const model = aiModel("aiFotoLink", cfg);
  if (!model) return NextResponse.json({ ok: false, message: "Fitur foto belum tersedia. Isi kuisnya sendiri, ya." }, { status: 404 });
  const at = now();
  const hash = await currentVisitorHash();
  const limit = await checkDailyFeatureLimit(db, cfg, hash, "foto_kulit", LIMITS.photoPerDay, at, "bantuan foto");
  if (!limit.ok) return NextResponse.json({ ok: false, message: limit.message }, { status: 429 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, message: "Foto tidak terbaca. Coba lagi, ya." }, { status: 400 });
  const read = await readImages(form, "foto", 1);
  if (!read.ok) return NextResponse.json({ ok: false, message: read.message }, { status: 400 });
  const r = await analyzeSkinPhoto(db, model, read.images[0], { now: at, visitorHash: hash });
  return NextResponse.json(r, { status: r.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
