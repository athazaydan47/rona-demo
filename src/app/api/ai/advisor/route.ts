import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { db, schema } from "@/db/client";
import { aiConfig, aiModel, aiTersedia } from "@/lib/ai";
import { MAX_HISTORY, MAX_MESSAGE_CHARS, type ChatTurn } from "@/lib/ai/advisor";
import { mockOembedFetch } from "@/lib/ai/oembed";
import { globalCapReached, logAi, RESTING_MESSAGE } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { currentCustomer } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { rejectCrossOrigin } from "@/lib/security/origin";
import { clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";
import { currentSkinProfile } from "@/lib/skin/current";
import type { TanyaEvent } from "@/lib/tanya/kartu";
import { jawabTanya } from "@/lib/tanya/otak";
import { cocok, skema } from "@/lib/validasi";
import { MEREK } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";

// chat asisten satu pintu (Fase 8C). Jawaban dialirkan sebagai NDJSON: status per tahap, potongan teks, lalu kartu dari
// data server. Tersedia selama fitur aktif; tanpa kunci AI, kemampuan berbasis aturan tetap jalan.
export const maxDuration = 60;

export async function GET() {
  if (!fiturAktif("aiPembeli")) return NextResponse.json({ tersedia: false }, { status: 404 });
  const cfg = aiConfig();
  const ai = aiTersedia("aiPembeli", cfg);
  const [istirahat, profil, me] = await Promise.all([ai ? globalCapReached(db, cfg, now()).catch(() => false) : false, currentSkinProfile().catch(() => null), currentCustomer().catch(() => null)]);
  return NextResponse.json({ tersedia: true, ai, aiFoto: aiTersedia("aiFotoLink", cfg), istirahat, pesanIstirahat: RESTING_MESSAGE, profil: Boolean(profil?.skinType), masuk: Boolean(me) }, { headers: { "Cache-Control": "no-store" } });
}

function parseHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length > 40) return null;
  const turns = raw
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t?.role === "assistant" ? ("assistant" as const) : ("user" as const), text: String(t?.text ?? "").slice(0, MAX_MESSAGE_CHARS) }))
    .filter((t) => t.text.trim());
  return turns;
}

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  if (!fiturAktif("aiPembeli")) return NextResponse.json({ ok: false, message: `${MEREK.asisten.nama} belum tersedia.` }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { pesan?: unknown; produkId?: unknown; aksi?: unknown } | null;
  const aksi = body?.aksi == null ? null : cocok(skema.aksiTanya, body.aksi);
  if (body?.aksi != null && !aksi) return NextResponse.json({ ok: false, message: "Aksi tidak valid." }, { status: 400 });
  const history = parseHistory(body?.pesan ?? []);
  if (!history || (!aksi && (!history.length || history[history.length - 1].role !== "user"))) return NextResponse.json({ ok: false, message: "Pesan tidak valid." }, { status: 400 });
  const produkId = Number.isInteger(Number(body?.produkId)) && Number(body?.produkId) > 0 ? Number(body?.produkId) : null;
  const ipKey = hashKey(clientIp(await headers()));
  // Batas ringan untuk semua permintaan (termasuk aksi tanpa AI); batas AI dan lacak dihitung terpisah di database.
  if (!limitByKey(`tanya:${ipKey}`, 60, 60_000)) return NextResponse.json({ ok: false, message: "Pelan-pelan, ya. Tunggu sebentar sebelum bertanya lagi." }, { status: 429 });
  const cfg = aiConfig();
  const at = now();
  const [hash, me, profile] = await Promise.all([currentVisitorHash(), currentCustomer(), currentSkinProfile()]);
  // Corong Advisor (tab Laporan): satu pesan pembeli satu catatan, tanpa isi pesan.
  if (!aksi) await db.insert(schema.advisorEvents).values({ kind: "percakapan", visitorHash: hash, createdAt: at }).catch(() => {});
  const deps = {
    db,
    now: at,
    cfg,
    model: aiModel("aiPembeli", cfg),
    modelFoto: aiModel("aiFotoLink", cfg),
    visitorHash: hash,
    ipKey,
    customerId: me?.customerId ?? null,
    profile,
    fetchImpl: cfg.provider === "mock" ? mockOembedFetch : undefined,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: TanyaEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const t0 = Date.now();
      const r = await jawabTanya(deps, { history, produkId, aksi }, send).catch((e: unknown) => ({ ok: false, teks: `${MEREK.asisten.nama} sedang tidak bisa dihubungi. Coba lagi sebentar lagi, ya.`, kartu: [], chips: [], jalur: "ai" as const, niat: null, usage: { input: 0, output: 0 }, toolCalls: [], firstTextMs: null, error: e instanceof Error ? e.message : String(e) }));
      send({ type: "done", ok: r.ok, teks: r.teks, kartu: r.kartu, chips: r.chips });
      controller.close();
      if (r.jalur === "ai" && deps.model) await logAi(db, { feature: "advisor", model: deps.model.name, inputTokens: r.usage.input, outputTokens: r.usage.output, latencyMs: Date.now() - t0, ok: r.ok, error: r.error, visitorHash: hash, tools: r.toolCalls, at }).catch(() => {});
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
