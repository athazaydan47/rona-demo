// Kesehatan AI untuk Owner (Fase 7B), dibaca dari ai_logs: permintaan per fitur hari ini dan 30 hari, tingkat gagal,
// latensi median dan p95 (diukur di server produksi, termasuk dari Vercel), token, perkiraan biaya rupiah dari tarif di
// src/lib/ai/pricing.ts, dan pemakaian terhadap AI_DAILY_CAP. Baris evaluasi dan hasil cache tidak dihitung.
import { sql } from "drizzle-orm";
import type { AnyDb } from "@/lib/db-types";
import { wibDayStart } from "@/lib/reports";
import type { AiConfig } from "./client";
import { costIdr, IDR_RATE_NOTE } from "./pricing";

export const FEATURE_LABELS: Record<string, string> = {
  advisor: "Rona Advisor",
  tafsir_cari: "Tafsiran pencarian",
  jelaskan_rutinitas: "Penjelasan rutinitas",
  padanan_teks: "Padanan shade dari teks",
  ringkasan_ulasan: "Ringkasan ulasan",
  foto_kulit: "Foto kuis kulit",
  dupe: "Cari dari video",
  asisten: "Asisten Admin",
  kabar_harian: "Kabar Harian",
  deskripsi: "Penulis deskripsi",
  balasan_ulasan: "Draf balasan ulasan",
  transkripsi: "Masukan suara",
};

export type HealthRow = { feature: string; label: string; today: number; month: number; failRate: number; p50: number; p95: number; inputTokens: number; outputTokens: number; costIdr: number | null };
export type AiHealth = { rows: HealthRow[]; totals: { today: number; month: number; costIdr: number | null; inputTokens: number; outputTokens: number }; cap: number; capUsedPercent: number; unpricedModels: string[]; rateNote: string };

export async function aiHealth(db: AnyDb, cfg: Pick<AiConfig, "dailyCap">, now: Date): Promise<AiHealth> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const today = wibDayStart(now).toISOString();
  const per = (await db.execute(sql`
    select feature,
      (count(*) filter (where created_at >= ${today}::timestamptz))::int as today,
      count(*)::int as month,
      (count(*) filter (where not ok))::int as failed,
      coalesce(percentile_cont(0.5) within group (order by latency_ms) filter (where model <> 'cache'), 0)::int as p50,
      coalesce(percentile_cont(0.95) within group (order by latency_ms) filter (where model <> 'cache'), 0)::int as p95
    from ai_logs where created_at >= ${since}::timestamptz and feature <> 'eval'
    group by feature order by month desc`)) as unknown as { feature: string; today: number; month: number; failed: number; p50: number; p95: number }[];
  const tokens = (await db.execute(sql`
    select feature, model, coalesce(sum(input_tokens), 0)::int as input, coalesce(sum(output_tokens), 0)::int as output
    from ai_logs where created_at >= ${since}::timestamptz and feature <> 'eval' and model <> 'cache'
    group by feature, model`)) as unknown as { feature: string; model: string; input: number; output: number }[];
  const unpriced = new Set<string>();
  const rows: HealthRow[] = per.map((r) => {
    const t = tokens.filter((x) => x.feature === r.feature);
    let cost: number | null = 0;
    for (const x of t) {
      if (!x.input && !x.output) continue;
      const c = costIdr(x.model, x.input, x.output, now);
      if (c == null) {
        unpriced.add(x.model);
        cost = null;
      } else if (cost != null) cost += c;
    }
    return { feature: r.feature, label: FEATURE_LABELS[r.feature] ?? r.feature, today: r.today, month: r.month, failRate: r.month ? Math.round((r.failed / r.month) * 1000) / 10 : 0, p50: r.p50, p95: r.p95, inputTokens: t.reduce((s, x) => s + x.input, 0), outputTokens: t.reduce((s, x) => s + x.output, 0), costIdr: cost == null ? null : Math.round(cost) };
  });
  const [{ capToday }] = (await db.execute(sql`select count(*)::int as "capToday" from ai_logs where created_at >= ${today}::timestamptz and feature <> 'eval' and model <> 'cache'`)) as unknown as { capToday: number }[];
  const priced = rows.every((r) => r.costIdr != null);
  return {
    rows,
    totals: { today: rows.reduce((s, r) => s + r.today, 0), month: rows.reduce((s, r) => s + r.month, 0), costIdr: priced ? rows.reduce((s, r) => s + (r.costIdr ?? 0), 0) : null, inputTokens: rows.reduce((s, r) => s + r.inputTokens, 0), outputTokens: rows.reduce((s, r) => s + r.outputTokens, 0) },
    cap: cfg.dailyCap,
    capUsedPercent: cfg.dailyCap ? Math.round((Number(capToday) / cfg.dailyCap) * 1000) / 10 : 0,
    unpricedModels: [...unpriced].filter((m) => m !== "mock"),
    rateNote: IDR_RATE_NOTE,
  };
}
