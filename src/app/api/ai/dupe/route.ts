import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { aiConfig, aiModel } from "@/lib/ai";
import { dupeFromLink, dupeFromScreenshots, MAX_SCREENSHOTS, type DupeOutcome } from "@/lib/ai/dupe";
import { readImages } from "@/lib/ai/images";
import { mockOembedFetch } from "@/lib/ai/oembed";
import { checkDailyFeatureLimit, LIMITS } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { toCardData } from "@/lib/catalog/catalog-queries";
import { loadCatalogItems } from "@/lib/catalog/load-items";
import { now } from "@/lib/clock";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import { rejectCrossOrigin } from "@/lib/security/origin";

// Cari dupe dari link TikTok atau YouTube (JSON {link}) atau 1 sampai 3 screenshot (multipart, kolom "gambar").
// Batas 10 permintaan per pengunjung per hari. Kartu produk dibangun dari data katalog server.
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const cfg = aiConfig();
  const model = aiModel(cfg);
  if (!model) return NextResponse.json({ ok: false, message: "Fitur ini belum tersedia." }, { status: 404 });
  const at = now();
  const hash = await currentVisitorHash();
  const limit = await checkDailyFeatureLimit(db, cfg, hash, "dupe", LIMITS.dupePerDay, at, "cari dari video");
  if (!limit.ok) return NextResponse.json({ ok: false, message: limit.message }, { status: 429 });
  const deps = { db, model, now: at, visitorHash: hash, fetchImpl: cfg.provider === "mock" ? mockOembedFetch : undefined };

  let outcome: DupeOutcome;
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, message: "Gambar tidak terbaca. Coba lagi, ya." }, { status: 400 });
    const read = await readImages(form, "gambar", MAX_SCREENSHOTS);
    if (!read.ok) return NextResponse.json({ ok: false, message: read.message }, { status: 400 });
    outcome = await dupeFromScreenshots(deps, read.images);
  } else {
    const body = (await request.json().catch(() => null)) as { link?: unknown } | null;
    if (typeof body?.link !== "string") return NextResponse.json({ ok: false, message: "Tempel link videonya dulu, ya." }, { status: 400 });
    outcome = await dupeFromLink(deps, body.link);
  }
  if (!outcome.ok) return NextResponse.json(outcome, { status: 200, headers: { "Cache-Control": "no-store" } });

  const ids = outcome.match.picks.map((p) => p.productId);
  const items = ids.length ? await loadCatalogItems(db, { kind: "ids", ids }, at) : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const produk = outcome.match.picks.flatMap((p) => {
    const i = byId.get(p.productId);
    if (!i) return [];
    const online = i.variants.reduce((s, v) => s + (v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0), 0);
    return [{ ...toCardData(i), alasan: p.alasan, varianPilihan: p.variantId, stokOnline: online }];
  });
  return NextResponse.json(
    {
      ok: true,
      sumber: outcome.source,
      tipe: outcome.match.tipe,
      namaTerbaca: "namaTerbaca" in outcome.match ? outcome.match.namaTerbaca : null,
      jenisProduk: outcome.extraction.jenisProduk || null,
      produk,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
