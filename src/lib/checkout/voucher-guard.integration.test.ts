// Penjaga tebak kode voucher (Fase 8B): kode salah yang sama dihitung sekali, kode berbeda dihitung sampai batas,
// lalu IP itu terblokir sampai jendela berakhir.
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { dbUrl, integration } from "@/test/integration";
import { BATAS } from "@/lib/security/rate-limit";
import { catatVoucherSalah, voucherTerblokir } from "./voucher-guard";

describe.skipIf(!dbUrl)("penjaga tebak voucher (integrasi)", () => {
  const t = integration();
  const { db } = t;
  const ip = `uji-voucher-${process.pid}`;
  const at = new Date("2026-10-15T03:00:00Z");
  afterAll(async () => {
    await db.execute(sql`delete from rate_limits where key like ${`%${ip}%`}`);
    await t.cleanup();
  });

  it("kode salah yang sama berulang hanya dihitung sekali", async () => {
    for (let i = 0; i < BATAS.voucherSalahPerIp.limit + 5; i++) await catatVoucherSalah(db, ip, "salahsatu", at);
    expect(await voucherTerblokir(db, ip, at)).toBe(false);
  });

  it("kode berbeda yang salah sampai batas memblokir IP, IP lain tidak terdampak", async () => {
    for (let i = 1; i < BATAS.voucherSalahPerIp.limit; i++) await catatVoucherSalah(db, ip, `TEBAK${i}`, at);
    expect(await voucherTerblokir(db, ip, at)).toBe(true);
    expect(await voucherTerblokir(db, `${ip}-lain`, at)).toBe(false);
    // Jendela berikutnya bersih lagi.
    expect(await voucherTerblokir(db, ip, new Date(at.getTime() + BATAS.voucherSalahPerIp.windowMs))).toBe(false);
  });
});

describe.skipIf(!dbUrl)("pembatas laju di Postgres (integrasi)", () => {
  const t = integration();
  const { db } = t;
  const key = `uji-batas-${process.pid}`;
  afterAll(async () => {
    await db.execute(sql`delete from rate_limits where key like ${`${key}%`}`);
    await t.cleanup();
  });

  it("menghitung per jendela, menolak setelah batas, dan pulih di jendela berikutnya", async () => {
    const { rateLimit, hitSaatIni, cleanRateLimits } = await import("@/lib/security/rate-limit");
    const at = new Date("2026-10-15T03:00:10Z");
    const hasil = [];
    for (let i = 0; i < 4; i++) hasil.push(await rateLimit(db, key, 3, 60_000, at));
    expect(hasil.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(hasil[3]).toMatchObject({ hits: 4, limit: 3, retryAfterSec: 50 });
    expect(await hitSaatIni(db, key, 60_000, at)).toBe(4);
    expect((await rateLimit(db, key, 3, 60_000, new Date(at.getTime() + 60_000))).ok).toBe(true);
    // Cron membersihkan jendela yang sudah lewat lebih dari dua hari.
    expect(await cleanRateLimits(db, new Date(at.getTime() + 3 * 86_400_000))).toBeGreaterThanOrEqual(2);
    expect(await hitSaatIni(db, key, 60_000, at)).toBe(0);
  });
});
