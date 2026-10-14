import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { currentStaff } from "@/lib/admin/current";
import { aiConfig, aiModel } from "@/lib/ai";
import { checkDailyFeatureLimit, LIMITS } from "@/lib/ai/usage";
import { transcribeAudio } from "@/lib/asisten/suara";
import { now } from "@/lib/clock";
import { rejectCrossOrigin } from "@/lib/security/origin";

// Masukan suara opsional Asisten Admin: rekaman (maksimal 60 detik) ditranskripsi Gemini lalu dikembalikan sebagai
// teks untuk kotak ketik. Rekaman hanya di memori dan tidak disimpan. Kegagalan dijawab rapi, tidak pernah 500.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ ok: false, message: "Sesi berakhir. Masuk lagi ke panel admin, ya." }, { status: 401 });
  try {
    const cfg = aiConfig();
    const model = aiModel("asistenAdmin", cfg);
    if (!model) return NextResponse.json({ ok: false, message: "Masukan suara sedang tidak tersedia. Ketik pertanyaanmu, ya." }, { status: 503 });
    const at = now();
    const limit = await checkDailyFeatureLimit(db, cfg, `staf:${staff.id}`, "transkripsi", LIMITS.transcribePerDay, at, "masukan suara");
    if (!limit.ok) return NextResponse.json({ ok: false, message: limit.message }, { status: 429 });
    const form = await request.formData().catch(() => null);
    const file = form?.get("audio");
    if (!file || typeof file === "string") return NextResponse.json({ ok: false, message: "Rekaman tidak terbaca. Coba lagi, ya." }, { status: 400 });
    const r = await transcribeAudio(db, model, new Uint8Array(await file.arrayBuffer()), { staffId: staff.id, now: at });
    return NextResponse.json(r, { status: r.ok ? 200 : 422, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Rekaman belum bisa diproses. Ketik pertanyaanmu, ya." }, { status: 502 });
  }
}
