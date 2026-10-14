import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { checkPhoto } from "@/lib/reviews/image-info";
import { photoStorage } from "@/lib/reviews/storage";
import { rejectCrossOrigin } from "@/lib/security/origin";
import { db } from "@/db/client";
import { BATAS, rateLimit } from "@/lib/security/rate-limit";

// Unggah foto produk atau banner dari admin (sudah dikompresi di browser). Sesi staf dan Origin wajib.
export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const me = await currentStaff();
  const kind = request.nextUrl.searchParams.get("jenis") === "banner" ? "banner" : "produk";
  if (!me || !can(me, kind === "banner" ? "promo.kelola" : "produk.kelola")) return NextResponse.json({ ok: false, message: "Tidak punya izin." }, { status: 403 });
  const batas = BATAS.fotoAdminPerStaf;
  const rl = await rateLimit(db, `foto-admin:${me.id}`, batas.limit, batas.windowMs);
  if (!rl.ok) return NextResponse.json({ ok: false, message: "Terlalu banyak unggahan dalam satu jam. Coba lagi nanti." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const storage = photoStorage();
  if (storage.kind === "nonaktif") return NextResponse.json({ ok: false, message: "Unggah foto belum tersedia di server ini. Pakai ProductArt dulu." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("foto");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Pilih foto dulu." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPhoto(bytes, file.type || undefined);
  if (!check.ok) return NextResponse.json({ ok: false, message: check.message }, { status: 400 });
  try {
    const url = await storage.put(`${kind}/${randomBytes(12).toString("hex")}.${check.ext}`, bytes, check.info.type);
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ ok: false, message: "Foto gagal diunggah." }, { status: 500 });
  }
}
