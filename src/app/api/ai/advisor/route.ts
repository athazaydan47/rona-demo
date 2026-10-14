import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db/client";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import { aiConfig, aiModel, aiTersedia } from "@/lib/ai";
import { MAX_HISTORY, MAX_MESSAGE_CHARS, runAdvisor, type ChatTurn } from "@/lib/ai/advisor";
import { checkChatLimit, globalCapReached, logAi, RESTING_MESSAGE } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { toCardData } from "@/lib/catalog/catalog-queries";
import { loadCatalogItems } from "@/lib/catalog/load-items";
import { now } from "@/lib/clock";
import { rejectCrossOrigin } from "@/lib/security/origin";
import { currentSkinProfile } from "@/lib/skin/current";

// Rona Advisor. Jawaban dialirkan sebagai NDJSON: status per tool, potongan teks, lalu kartu produk dari data server.
export const maxDuration = 60;

export async function GET() {
  const cfg = aiConfig();
  if (!aiTersedia(cfg)) return NextResponse.json({ tersedia: false }, { status: 404 });
  const [istirahat, profil] = await Promise.all([globalCapReached(db, cfg, now()).catch(() => false), currentSkinProfile().catch(() => null)]);
  return NextResponse.json({ tersedia: true, istirahat, pesanIstirahat: RESTING_MESSAGE, profil: Boolean(profil?.skinType) }, { headers: { "Cache-Control": "no-store" } });
}

function parseHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null;
  const turns = raw
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t?.role === "assistant" ? ("assistant" as const) : ("user" as const), text: String(t?.text ?? "").slice(0, MAX_MESSAGE_CHARS) }))
    .filter((t) => t.text.trim());
  if (!turns.length || turns[turns.length - 1].role !== "user") return null;
  return turns;
}

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const cfg = aiConfig();
  const model = aiModel(cfg);
  if (!model) return NextResponse.json({ ok: false, message: "Rona Advisor belum tersedia." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { pesan?: unknown; produkId?: unknown } | null;
  const history = parseHistory(body?.pesan);
  if (!history) return NextResponse.json({ ok: false, message: "Pesan tidak valid." }, { status: 400 });
  const productId = Number.isInteger(Number(body?.produkId)) && Number(body?.produkId) > 0 ? Number(body?.produkId) : null;
  const at = now();
  const hash = await currentVisitorHash();
  const limit = await checkChatLimit(db, cfg, hash, at);
  if (!limit.ok) return NextResponse.json({ ok: false, message: limit.message, alasan: limit.reason }, { status: 429 });
  const profile = await currentSkinProfile();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const t0 = Date.now();
      // Peristiwa dialirkan apa adanya: status per tool, kalimat pembuka dari catatan tool, lalu kalimat jawaban
      // yang sudah lolos pemeriksaan. Kartu produk dibangun dari data server terbaru.
      const r = await runAdvisor(db, model, { history, productId, profile, now: at }, (e) => send(e));
      const items = r.productIds.length ? await loadCatalogItems(db, { kind: "ids", ids: r.productIds }, at) : [];
      const byId = new Map(items.map((i) => [i.id, i]));
      const locs = new Map((await db.select({ slug: schema.locations.slug, name: schema.locations.name }).from(schema.locations)).map((l) => [l.slug, l.name]));
      const products = r.products
        .map((p) => ({ p, i: byId.get(p.id) }))
        .filter((x): x is { p: (typeof r.products)[number]; i: NonNullable<ReturnType<typeof byId.get>> } => Boolean(x.i))
        .map(({ p, i }) => {
          const branches = new Set<string>();
          for (const v of i.variants) for (const [slug, n] of Object.entries(v.stockByLocation)) if (n > 0 && slug !== ONLINE_WAREHOUSE_SLUG) branches.add(locs.get(slug) ?? slug);
          const online = i.variants.reduce((s, v) => s + (v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0), 0);
          return { ...toCardData(i), alasan: p.alasan, stokOnline: online, cabang: [...branches].sort() };
        });
      // Total paket dihitung server dari harga efektif kartu, bukan dari model.
      const total = products.length > 1 ? products.reduce((s, p) => s + p.price, 0) : null;
      send({ type: "done", ok: r.ok, teks: r.text, produk: products, total });
      controller.close();
      await logAi(db, { feature: "advisor", model: model.name, inputTokens: r.usage.input, outputTokens: r.usage.output, latencyMs: Date.now() - t0, ok: r.ok, error: r.error, visitorHash: hash, at }).catch(() => {});
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
