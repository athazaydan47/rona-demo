// Pemeriksaan TikTok dari server (Fase 8C), dipakai npm run uji:produksi untuk tahu apakah TikTok memblokir IP server
// (misal Vercel). Hanya membaca satu link contoh tetap dari konten demo, bukan URL dari pengunjung, jadi tidak bisa
// dipakai sebagai proksi. Jawaban berisi tahap, status HTTP, dan sumber yang berhasil, tanpa caption.
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { ambilInfoVideo, classifyLink, ringkasGagal } from "@/lib/ai/oembed";
import { logAi } from "@/lib/ai/usage";
import { CONTOH_LINK_TIKTOK } from "@/lib/content/demo";
import { clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";

export const maxDuration = 30;

export async function GET() {
  await connection();
  if (!limitByKey(`sehat-tiktok:${hashKey(clientIp(await headers()))}`, 6, 60_000)) return NextResponse.json({ ok: false, pesan: "Terlalu sering." }, { status: 429 });
  const link = classifyLink(CONTOH_LINK_TIKTOK);
  if (link.kind !== "tiktok") return NextResponse.json({ ok: false, pesan: "Link contoh tidak valid." }, { status: 500 });
  const t0 = Date.now();
  const r = await ambilInfoVideo(link);
  const ms = Date.now() - t0;
  await logAi(db, { feature: "link_video", model: r.ok ? r.sumber : "gagal", latencyMs: ms, ok: r.ok, error: r.ok ? null : ringkasGagal(r.gagal, r.jejak), visitorHash: "sehat", door: "sehat" }).catch(() => {});
  return NextResponse.json(
    { ok: r.ok, sumber: r.ok ? r.sumber : null, gagal: r.ok ? null : r.gagal, ms, jejak: r.jejak.map((j) => ({ tahap: j.tahap, status: j.status, ms: j.ms })), adaCaption: r.ok ? r.info.title.length > 0 : false },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
