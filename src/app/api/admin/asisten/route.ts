import { NextResponse, type NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentStaff } from "@/lib/admin/current";
import { allLocations } from "@/lib/admin/permissions";
import { aiConfig, aiModel } from "@/lib/ai";
import { checkDailyFeatureLimit, LIMITS } from "@/lib/ai/usage";
import { MAX_HISTORY, MAX_QUESTION, runAssistant, type AsistenTurn } from "@/lib/asisten/otak";
import { now } from "@/lib/clock";
import { rejectCrossOrigin } from "@/lib/security/origin";

// Pintu panel chat Asisten Admin. Jawaban dialirkan sebagai NDJSON: status per tool, lalu jawaban akhir terstruktur.
// Tanpa sesi staf ditolak (401). AI tidak tersedia dijawab jelas berbeda dari penolakan akses.
export const maxDuration = 60;

function parseHistory(raw: unknown): AsistenTurn[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > 40) return null;
  const turns = raw
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t?.role === "assistant" ? ("assistant" as const) : ("user" as const), text: String(t?.text ?? "").slice(0, MAX_QUESTION) }))
    .filter((t) => t.text.trim());
  return turns.length && turns[turns.length - 1].role === "user" ? turns : null;
}

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ ok: false, alasan: "sesi", message: "Sesi berakhir. Masuk lagi ke panel admin, ya." }, { status: 401 });
  const cfg = aiConfig();
  const model = aiModel(cfg);
  if (!model) return NextResponse.json({ ok: false, alasan: "tidak_tersedia", message: "Asisten sedang tidak tersedia, coba lagi sebentar." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { pesan?: unknown } | null;
  const history = parseHistory(body?.pesan);
  if (!history) return NextResponse.json({ ok: false, message: "Pertanyaan tidak valid." }, { status: 400 });
  const at = now();
  const limit = await checkDailyFeatureLimit(db, cfg, `staf:${staff.id}`, "asisten", LIMITS.adminPerDay, at, "Asisten Admin");
  if (!limit.ok) return NextResponse.json({ ok: false, alasan: "batas", message: limit.message }, { status: 429 });
  const locationNames = allLocations(staff) ? [] : (await db.select({ name: schema.locations.name }).from(schema.locations).where(inArray(schema.locations.id, staff.locationIds))).map((l) => l.name);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const r = await runAssistant({ db, model, staff, now: at, door: "panel", locationNames }, history, (text) => send({ type: "status", text }));
      send({ type: "done", ...r, usage: undefined, error: undefined });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
