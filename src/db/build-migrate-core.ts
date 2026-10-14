// Migrasi otomatis saat build Vercel. Murni dan bisa diuji: keputusan "hanya produksi" dan alur kunci, migrasi,
// pencatatan, serta gagal. Pemanggil nyata ada di build-migrate.ts.

export type BuildMigrationPlan = { run: true; url: string; via: "DATABASE_URL_UNPOOLED" | "DATABASE_URL" } | { run: false; reason: string };

// Hanya build produksi Vercel yang memigrasi. Preview memakai database yang sama dengan produksi, jadi tidak boleh.
export function planBuildMigration(env: Record<string, string | undefined>): BuildMigrationPlan {
  if (env.VERCEL_ENV !== "production") {
    const where = env.VERCEL_ENV ? `build ${env.VERCEL_ENV}` : "build lokal";
    return { run: false, reason: `Migrasi dilewati (${where}). Migrasi otomatis hanya berjalan di build produksi Vercel.` };
  }
  if (env.SKIP_BUILD_MIGRATION === "true") return { run: false, reason: "Migrasi dilewati karena SKIP_BUILD_MIGRATION=true." };
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) return { run: true, url: unpooled, via: "DATABASE_URL_UNPOOLED" };
  const pooled = env.DATABASE_URL?.trim();
  if (pooled) return { run: true, url: pooled, via: "DATABASE_URL" };
  throw new Error("Build produksi butuh DATABASE_URL_UNPOOLED atau DATABASE_URL untuk menjalankan migrasi.");
}

export type JournalEntry = { tag: string; when: number };

export type MigrationDeps = {
  lock: () => Promise<void>;
  unlock: () => Promise<void>;
  applied: () => Promise<number[]>; // created_at (folderMillis) dari drizzle.__drizzle_migrations
  migrate: () => Promise<void>;
  journal: JournalEntry[];
  log: (line: string) => void;
};

// Kunci advisory, migrasi, lalu catat migrasi mana yang baru dijalankan. Bila migrasi gagal, kunci tetap dilepas
// dan error dilempar lagi supaya build gagal dan versi lama tetap tayang.
export async function runBuildMigrations(deps: MigrationDeps): Promise<string[]> {
  deps.log("Migrasi produksi: menunggu kunci advisory...");
  await deps.lock();
  try {
    const before = new Set(await deps.applied());
    const pending = deps.journal.filter((j) => !before.has(j.when)).map((j) => j.tag);
    deps.log(pending.length ? `Migrasi yang akan dijalankan: ${pending.join(", ")}` : "Tidak ada migrasi baru.");
    try {
      await deps.migrate();
    } catch (e) {
      deps.log(`MIGRASI GAGAL: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    const after = new Set(await deps.applied());
    const ran = deps.journal.filter((j) => !before.has(j.when) && after.has(j.when)).map((j) => j.tag);
    deps.log(ran.length ? `Migrasi selesai: ${ran.join(", ")}` : "Skema sudah terbaru.");
    return ran;
  } finally {
    await deps.unlock();
  }
}
