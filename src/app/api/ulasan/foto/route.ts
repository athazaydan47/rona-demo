import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentCustomer } from "@/lib/auth/current";
import { checkPhoto } from "@/lib/reviews/image-info";
import { photoStorage } from "@/lib/reviews/storage";
import { rejectCrossOrigin } from "@/lib/security/origin";

// Unggah satu foto ulasan (sudah dikompresi di browser). Identitas hanya dari sesi; Origin wajib sama.
export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ ok: false, message: "Masuk dulu untuk mengunggah foto." }, { status: 401 });
  const storage = photoStorage();
  if (storage.kind === "nonaktif") return NextResponse.json({ ok: false, message: "Unggah foto sedang tidak tersedia. Ulasan teksmu tetap bisa dikirim." }, { status: 503 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 3 * 1024 * 1024) return NextResponse.json({ ok: false, message: "Foto terlalu besar. Maksimal 2 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("foto");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Pilih foto dulu." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPhoto(bytes, file.type || undefined);
  if (!check.ok) return NextResponse.json({ ok: false, message: check.message }, { status: 400 });
  const key = `ulasan/${customer.customerId}/${randomBytes(12).toString("hex")}.${check.ext}`;
  try {
    const url = await storage.put(key, bytes, check.info.type);
    return NextResponse.json({ ok: true, url, width: check.info.width, height: check.info.height });
  } catch {
    return NextResponse.json({ ok: false, message: "Foto gagal diunggah. Coba lagi, ya." }, { status: 500 });
  }
}
