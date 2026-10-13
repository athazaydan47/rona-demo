// OTP dan sesi dengan jam palsu (waktu dioper eksplisit), terhadap database lokal.
import { afterAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { LIMITS, OTP_MAX_ATTEMPTS, requestOtp, verifyOtp } from "./otp";
import { createSession, readSession, revokeAllSessions, revokeSession, SESSION_TTL_MS } from "./session";

const secret = "rahasia-uji-otp-1234567890";
const T0 = new Date("2026-10-14T03:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

describe.skipIf(!dbUrl)("OTP (integrasi, jam palsu)", () => {
  const t = integration();
  const { db, schema, eq } = t;
  afterAll(() => t.cleanup());

  it("kode disimpan sebagai hash dan hanya bisa dipakai sekali", async () => {
    const phone = t.phone();
    const r = await requestOtp(db, { phone, purpose: "masuk", secret, now: T0, code: "123456" });
    expect(r.ok).toBe(true);
    const [row] = await db.select().from(schema.otpCodes).where(eq(schema.otpCodes.phone, phone));
    expect(row.codeHash).not.toContain("123456");
    expect(row.codeHash).toHaveLength(64);
    expect(await verifyOtp(db, { phone, purpose: "masuk", code: "123456", secret, now: at(MIN) })).toEqual({ ok: true });
    expect((await verifyOtp(db, { phone, purpose: "masuk", code: "123456", secret, now: at(2 * MIN) })).ok).toBe(false);
  });

  it("kedaluwarsa setelah 5 menit", async () => {
    const phone = t.phone();
    await requestOtp(db, { phone, purpose: "masuk", secret, now: T0, code: "222222" });
    expect((await verifyOtp(db, { phone, purpose: "masuk", code: "222222", secret, now: at(5 * MIN + 1000) })).ok).toBe(false);
    const phone2 = t.phone();
    await requestOtp(db, { phone: phone2, purpose: "masuk", secret, now: T0, code: "333333" });
    expect((await verifyOtp(db, { phone: phone2, purpose: "masuk", code: "333333", secret, now: at(5 * MIN - 1000) })).ok).toBe(true);
  });

  it("maksimal 5 kali salah per kode; setelah itu kode benar pun ditolak", async () => {
    const phone = t.phone();
    await requestOtp(db, { phone, purpose: "masuk", secret, now: T0, code: "444444" });
    const results = [];
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) results.push(await verifyOtp(db, { phone, purpose: "masuk", code: "000000", secret, now: at(1000 * (i + 1)) }));
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0]).toMatchObject({ ok: false, remaining: 4 });
    expect(results[4]).toMatchObject({ ok: false, message: expect.stringContaining("Terlalu banyak") });
    expect((await verifyOtp(db, { phone, purpose: "masuk", code: "444444", secret, now: at(10_000) })).ok).toBe(false);
  });

  it("kirim ulang paling cepat 60 detik dan maksimal 3 per nomor per 10 menit", async () => {
    const phone = t.phone();
    expect((await requestOtp(db, { phone, purpose: "masuk", secret, now: T0 })).ok).toBe(true);
    const tooSoon = await requestOtp(db, { phone, purpose: "masuk", secret, now: at(30_000) });
    expect(tooSoon).toMatchObject({ ok: false, retryAfterSec: 30 });
    expect((await requestOtp(db, { phone, purpose: "masuk", secret, now: at(61_000) })).ok).toBe(true);
    expect((await requestOtp(db, { phone, purpose: "masuk", secret, now: at(122_000) })).ok).toBe(true);
    const fourth = await requestOtp(db, { phone, purpose: "masuk", secret, now: at(183_000) });
    expect(fourth).toMatchObject({ ok: false, message: expect.stringContaining("10 menit") });
    // Setelah jendela 10 menit bergeser, boleh lagi.
    expect((await requestOtp(db, { phone, purpose: "masuk", secret, now: at(10 * MIN + 1000) })).ok).toBe(true);
  });

  it("maksimal 10 permintaan per nomor per hari", async () => {
    const phone = t.phone();
    for (let i = 0; i < LIMITS.phoneDay; i++) expect((await requestOtp(db, { phone, purpose: "masuk", secret, now: at(i * 5 * MIN) })).ok).toBe(true);
    const over = await requestOtp(db, { phone, purpose: "masuk", secret, now: at(LIMITS.phoneDay * 5 * MIN) });
    expect(over).toMatchObject({ ok: false, message: expect.stringContaining("hari ini") });
  });

  it("batas per IP berlaku lintas nomor", async () => {
    const addr = ip();
    for (let i = 0; i < LIMITS.ip10m; i++) expect((await requestOtp(db, { phone: t.phone(), purpose: "masuk", secret, ip: addr, now: at(i * 1000) })).ok).toBe(true);
    const over = await requestOtp(db, { phone: t.phone(), purpose: "masuk", secret, ip: addr, now: at(20_000) });
    expect(over).toMatchObject({ ok: false, message: expect.stringContaining("jaringan") });
  });

  it("jawaban tidak membedakan nomor terdaftar dan belum", async () => {
    const registered = await t.customer();
    const fresh = t.phone();
    const a = await requestOtp(db, { phone: registered.phone, purpose: "masuk", secret, now: T0, code: "555555" });
    const b = await requestOtp(db, { phone: fresh, purpose: "masuk", secret, now: T0, code: "555555" });
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    const wa = await verifyOtp(db, { phone: registered.phone, purpose: "masuk", code: "999999", secret, now: at(1000) });
    const wb = await verifyOtp(db, { phone: fresh, purpose: "masuk", code: "999999", secret, now: at(1000) });
    expect(wa).toEqual(wb);
  });

  it("kode ganti nomor terikat ke pembeli yang memintanya", async () => {
    const a = await t.customer();
    const b = await t.customer();
    const target = t.phone();
    await requestOtp(db, { phone: target, purpose: "ganti_nomor", secret, now: T0, customerId: a.id, code: "777777" });
    expect((await verifyOtp(db, { phone: target, purpose: "ganti_nomor", code: "777777", secret, now: at(1000), customerId: b.id })).ok).toBe(false);
    expect((await verifyOtp(db, { phone: target, purpose: "masuk", code: "777777", secret, now: at(1000) })).ok).toBe(false);
    expect((await verifyOtp(db, { phone: target, purpose: "ganti_nomor", code: "777777", secret, now: at(2000), customerId: a.id })).ok).toBe(true);
  });
});

describe.skipIf(!dbUrl)("sesi (integrasi)", () => {
  const t = integration();
  const { db, schema, eq } = t;
  afterAll(() => t.cleanup());

  it("dibuat dengan token acak yang disimpan sebagai hash, lalu bisa dibaca", async () => {
    const c = await t.customer({ name: "Sesi Uji" });
    const s = await createSession(db, c.id, T0, "uji");
    const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.customerId, c.id));
    expect(row.tokenHash).not.toBe(s.token);
    expect(s.expiresAt.getTime() - T0.getTime()).toBe(SESSION_TTL_MS);
    expect(await readSession(db, s.token, at(MIN))).toMatchObject({ customerId: c.id, name: "Sesi Uji" });
    expect(await readSession(db, `${s.token}x`, at(MIN))).toBeNull();
    expect(await readSession(db, s.token, at(SESSION_TTL_MS + 1000))).toBeNull();
  });

  it("diperpanjang 30 hari dari pemakaian terakhir bila aktif lebih dari 12 jam kemudian", async () => {
    const c = await t.customer();
    const s = await createSession(db, c.id, T0);
    await readSession(db, s.token, at(60 * MIN));
    let [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.customerId, c.id));
    expect(row.expiresAt.getTime()).toBe(s.expiresAt.getTime());
    const later = at(20 * 24 * 60 * MIN);
    expect(await readSession(db, s.token, later)).not.toBeNull();
    [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.customerId, c.id));
    expect(row.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
    // Tanpa perpanjangan, sesi sudah kedaluwarsa di hari ke-35; dengan perpanjangan masih hidup.
    expect(await readSession(db, s.token, at(35 * 24 * 60 * MIN))).not.toBeNull();
  });

  it("dicabut satu per satu atau semua perangkat", async () => {
    const c = await t.customer();
    const s1 = await createSession(db, c.id, T0);
    const s2 = await createSession(db, c.id, T0);
    const s3 = await createSession(db, c.id, T0);
    await revokeSession(db, s1.token, at(1000));
    expect(await readSession(db, s1.token, at(2000))).toBeNull();
    expect(await readSession(db, s2.token, at(2000))).not.toBeNull();
    expect(await revokeAllSessions(db, c.id, at(3000))).toBe(2);
    expect(await readSession(db, s2.token, at(4000))).toBeNull();
    expect(await readSession(db, s3.token, at(4000))).toBeNull();
  });
});
