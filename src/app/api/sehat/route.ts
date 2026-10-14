// Pemeriksaan kesehatan (Fase 8B) untuk pemantau uptime gratis (misal UptimeRobot atau Better Stack):
// status database dan latensinya, versi aplikasi (commit), versi seed terpasang dan versi seed di kode, waktu server,
// status cron, dan jumlah data bernama uji (harus 0). Tanpa data pribadi, rahasia, atau isi pesanan.
// HTTP 200 bila database terjangkau, 503 bila tidak.
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { SEED_VERSION } from "@/db/seed/version";
import { bacaCronStatus, cronPeringatan } from "@/lib/cron-status";
import { hitungDataUji } from "@/lib/demo/data-uji";
import { SETTING_KEYS } from "@/lib/settings";

export async function GET() {
  await connection();
  const waktuServer = new Date();
  const versi = { aplikasi: process.env.APP_VERSI ?? "0", commit: process.env.APP_COMMIT ?? "tidak-diketahui" };
  const t0 = performance.now();
  try {
    await db.execute(sql`select 1`);
    const latensiMs = Math.round(performance.now() - t0);
    const [seedRow] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, SETTING_KEYS.seedVersion));
    const cron = await bacaCronStatus(db);
    const peringatan = cronPeringatan(cron.status, cron.patokan, waktuServer);
    const dataUji = await hitungDataUji(db);
    return NextResponse.json(
      {
        ok: true,
        db: { ok: true, latensiMs },
        versi,
        seed: { terpasang: Number(seedRow?.value ?? 0), kode: SEED_VERSION },
        demo: process.env.DEMO_MODE === "true",
        cron: { terakhirBerhasil: cron.status?.terakhirBerhasil ?? null, ok: peringatan == null, peringatan: peringatan?.level ?? null },
        dataUji,
        waktuServer: waktuServer.toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, db: { ok: false }, versi, waktuServer: waktuServer.toISOString() }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
