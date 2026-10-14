import { describe, expect, it } from "vitest";
import { cronPeringatan, type CronStatus } from "./cron-status";

const now = new Date("2026-10-15T05:00:00Z");
const ok = (jamLalu: number): CronStatus => {
  const t = new Date(now.getTime() - jamLalu * 3_600_000).toISOString();
  return { mulai: t, selesai: t, ok: true, galat: null, durasiMs: 1200, terakhirBerhasil: t };
};

describe("peringatan cron", () => {
  it("aman bila berhasil dalam 26 jam, terlambat bila lebih", () => {
    expect(cronPeringatan(ok(2), null, now)).toBeNull();
    expect(cronPeringatan(ok(25.9), null, now)).toBeNull();
    expect(cronPeringatan(ok(27), null, now)).toMatchObject({ level: "terlambat" });
  });
  it("gagal terakhir selalu diperingatkan", () => {
    const s = { ...ok(1), ok: false, galat: "Neon tidak terjangkau" };
    expect(cronPeringatan(s, null, now)?.pesan).toContain("Neon tidak terjangkau");
  });
  it("belum pernah jalan: patokan waktu seed", () => {
    expect(cronPeringatan(null, new Date(now.getTime() - 3_600_000), now)).toBeNull();
    expect(cronPeringatan(null, new Date(now.getTime() - 30 * 3_600_000), now)).toMatchObject({ level: "terlambat" });
    expect(cronPeringatan(null, null, now)).toBeNull();
  });
});
