import { describe, expect, it } from "vitest";
import { planBuildMigration, runBuildMigrations, type MigrationDeps } from "./build-migrate-core";

describe("migrasi otomatis saat build", () => {
  it("hanya build produksi Vercel yang memigrasi, memakai koneksi langsung bila ada", () => {
    expect(planBuildMigration({})).toMatchObject({ run: false });
    expect(planBuildMigration({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://x" })).toMatchObject({ run: false, reason: expect.stringContaining("preview") });
    expect(planBuildMigration({ VERCEL_ENV: "development", DATABASE_URL: "postgres://x" })).toMatchObject({ run: false });
    expect(planBuildMigration({ VERCEL_ENV: "production", DATABASE_URL: "postgres://pool", DATABASE_URL_UNPOOLED: "postgres://direct" })).toEqual({ run: true, url: "postgres://direct", via: "DATABASE_URL_UNPOOLED" });
    expect(planBuildMigration({ VERCEL_ENV: "production", DATABASE_URL: "postgres://pool" })).toEqual({ run: true, url: "postgres://pool", via: "DATABASE_URL" });
    expect(planBuildMigration({ VERCEL_ENV: "production", DATABASE_URL: "x", SKIP_BUILD_MIGRATION: "true" })).toMatchObject({ run: false });
    expect(() => planBuildMigration({ VERCEL_ENV: "production" })).toThrow(/DATABASE_URL/);
  });

  const journal = [
    { tag: "0000_fondasi", when: 1 },
    { tag: "0001_pesanan", when: 2 },
    { tag: "0002_akun", when: 3 },
  ];
  function fake(opts: { applied: number[]; fail?: boolean }) {
    const calls: string[] = [];
    const logs: string[] = [];
    let applied = [...opts.applied];
    const deps: MigrationDeps = {
      journal,
      log: (l) => logs.push(l),
      lock: async () => void calls.push("lock"),
      unlock: async () => void calls.push("unlock"),
      applied: async () => applied,
      migrate: async () => {
        calls.push("migrate");
        if (opts.fail) throw new Error("kolom sudah ada");
        applied = journal.map((j) => j.when);
      },
    };
    return { deps, calls, logs };
  }

  it("mengunci, menjalankan, dan mencatat migrasi yang baru dijalankan", async () => {
    const f = fake({ applied: [1] });
    expect(await runBuildMigrations(f.deps)).toEqual(["0001_pesanan", "0002_akun"]);
    expect(f.calls).toEqual(["lock", "migrate", "unlock"]);
    expect(f.logs.join("\n")).toContain("0001_pesanan, 0002_akun");
  });

  it("gagal migrasi: error dilempar (build gagal) dan kunci tetap dilepas", async () => {
    const f = fake({ applied: [1, 2], fail: true });
    await expect(runBuildMigrations(f.deps)).rejects.toThrow("kolom sudah ada");
    expect(f.calls).toEqual(["lock", "migrate", "unlock"]);
    expect(f.logs.some((l) => l.startsWith("MIGRASI GAGAL"))).toBe(true);
  });

  it("tanpa migrasi baru tetap aman", async () => {
    const f = fake({ applied: [1, 2, 3] });
    expect(await runBuildMigrations(f.deps)).toEqual([]);
    expect(f.logs).toContain("Tidak ada migrasi baru.");
  });
});
