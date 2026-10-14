// Fase 6C terhadap database lokal: dashboard sama dengan laporan, segmen SQL sama dengan fungsi murni, penyesuaian
// poin, moderasi ulasan, dan pengirim email dengan adapter tiruan. Data uji dibersihkan di akhir.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { dispatchEmails, notificationIdempotencyKey } from "@/lib/email/dispatch";
import { emailConfig, type EmailMessage, type EmailProvider, type SendResult } from "@/lib/email";
import { checkPointsConsistency } from "@/lib/points";
import { buildReport, resolvePeriod, summarize, topProducts, wibDayKey } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";
import { loadPrincipal } from "./auth";
import { adjustPoints, customerSegment, listCustomers, type Segment } from "./customers";
import { dashboardData } from "./dashboard";
import { resendNotification } from "./outbox";
import type { StaffPrincipal } from "./permissions";
import { deleteReply, hideReviews, listAdminReviews, replyReview, showReview } from "./reviews";

const SITE = "https://rona.test";

function fakeProvider(results: (msg: EmailMessage) => SendResult = () => ({ ok: true, id: `em_${Math.random().toString(36).slice(2)}` })) {
  const sent: EmailMessage[] = [];
  const provider: EmailProvider = {
    name: "tiruan",
    async send(msg) {
      sent.push(msg);
      await new Promise((r) => setTimeout(r, 15));
      return results(msg);
    },
  };
  return { provider, sent };
}

describe.skipIf(!dbUrl)("Fase 6C (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, inArray } = t;
  let owner: StaffPrincipal;
  let adminOnline: StaffPrincipal;
  let gudang: StaffPrincipal;
  const now = new Date();
  const reviewIds: number[] = [];
  const notifIds: number[] = [];

  const principal = async (email: string) => {
    const [s] = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.email, email));
    return (await loadPrincipal(db, s.id))!;
  };

  beforeAll(async () => {
    [owner, adminOnline, gudang] = await Promise.all(["owner@rona.demo", "admin@rona.demo", "gudang@rona.demo"].map(principal));
  });

  afterAll(async () => {
    if (notifIds.length) await db.delete(schema.notifications).where(inArray(schema.notifications.id, notifIds));
    if (reviewIds.length) {
      const pids = (await db.selectDistinct({ id: schema.reviews.productId }).from(schema.reviews).where(inArray(schema.reviews.id, reviewIds))).map((r) => r.id);
      await db.delete(schema.reviews).where(inArray(schema.reviews.id, reviewIds));
      for (const pid of pids) await db.execute(t.sql`update products set rating_avg = coalesce((select round(avg(rating)::numeric, 1) from reviews where product_id = ${pid} and status = 'tampil'), 0), review_count = (select count(*) from reviews where product_id = ${pid} and status = 'tampil') where id = ${pid}`);
    }
    await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.staffId, [owner.id, adminOnline.id]));
    await t.cleanup();
  });

  it("angka dashboard sama dengan angka laporan untuk 30 hari yang sama", async () => {
    const dash = await dashboardData(db, owner, now);
    const data = await loadReportData(db, resolvePeriod("30_hari", now));
    const s = summarize(data);
    expect(dash.revenue?.total).toBe(s.revenue);
    expect(dash.paidOrders30).toBe(s.orders);
    expect(dash.revenue?.averageOrder).toBe(s.averageOrder);
    expect(dash.revenue?.series).toEqual(buildReport(data).daily);
    expect(dash.best.map((b) => [b.productId, b.qty])).toEqual(topProducts(data, "quantity").slice(0, 5).map((p) => [p.productId, p.quantity]));
    expect(s.revenue).toBeGreaterThan(0);
  });

  it("rekonsiliasi omzet selalu tepat pada data riwayat (90 hari dan per cabang)", async () => {
    const range = resolvePeriod("kustom", now, { from: wibDayKey(new Date(now.getTime() - 89 * 86_400_000)), to: wibDayKey(now) });
    const all = buildReport(await loadReportData(db, range));
    expect(all.reconciliation.balanced).toBe(true);
    expect(all.reconciliation.revenue).toBe(all.summary.revenue);
    expect(all.reconciliation.voucherShipping).toBeGreaterThanOrEqual(0);
    for (const loc of all.locations) expect(buildReport(await loadReportData(db, range, { locationIds: [Number(loc.key)] })).reconciliation.balanced).toBe(true);
  });

  it("laporan cabang hanya berisi pesanan cabang itu, dan jumlah per cabang sama dengan total", async () => {
    const range = resolvePeriod("30_hari", now);
    const all = buildReport(await loadReportData(db, range));
    let sum = 0;
    for (const loc of all.locations) {
      const one = summarize(await loadReportData(db, range, { locationIds: [Number(loc.key)] }));
      expect(one.revenue).toBe(loc.revenue);
      sum += one.revenue;
    }
    expect(sum).toBe(all.summary.revenue);
  });

  it("segmen di daftar pelanggan (SQL) sama dengan fungsi murni", async () => {
    const orders = await db.select({ customerId: schema.orders.customerId, createdAt: schema.orders.createdAt, status: schema.orders.status }).from(schema.orders);
    const customers = await db.select({ id: schema.customers.id }).from(schema.customers);
    const expected = new Map(customers.map((c) => [c.id, customerSegment({ orders: orders.filter((o) => o.customerId === c.id) }, now)]));
    for (const seg of ["baru", "setia", "tidak_aktif", "lainnya"] as Segment[]) {
      const ids: number[] = [];
      for (let page = 1; page < 50; page++) {
        const r = await listCustomers(db, { segment: seg, page }, now);
        ids.push(...r.rows.map((x) => x.id));
        if (page >= r.pageCount) break;
      }
      expect(ids.sort((a, b) => a - b), seg).toEqual([...expected.entries()].filter(([, s]) => s === seg).map(([id]) => id).sort((a, b) => a - b));
    }
  });

  it("penyesuaian poin: hanya Owner, alasan wajib, ditulis ke buku poin, saldo tidak boleh negatif", async () => {
    const c = await t.customer();
    expect(await adjustPoints(db, adminOnline, c.id, 500, "Kompensasi paket telat")).toMatchObject({ ok: false, message: expect.stringMatching(/izin/) });
    expect(await adjustPoints(db, owner, c.id, 500, "ok")).toMatchObject({ ok: false });
    expect(await adjustPoints(db, owner, c.id, 500, "Kompensasi paket telat", { now })).toEqual({ ok: true, balance: 500 });
    expect(await adjustPoints(db, owner, c.id, -600, "Koreksi salah input")).toMatchObject({ ok: false, message: expect.stringMatching(/negatif/) });
    expect(await adjustPoints(db, owner, c.id, -200, "Koreksi salah input")).toEqual({ ok: true, balance: 300 });
    const ledger = await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.customerId, c.id));
    expect(ledger.map((l) => l.amount).sort((a, b) => a - b)).toEqual([-200, 500]);
    expect(ledger.every((l) => l.reason.startsWith("Penyesuaian manual:") && l.idempotencyKey?.startsWith("manual:"))).toBe(true);
    expect(await checkPointsConsistency(db, c.id)).toEqual([]);
    const logs = await db.select().from(schema.auditLogs).where(t.and(eq(schema.auditLogs.action, "pelanggan.poin"), eq(schema.auditLogs.objectId, String(c.id))));
    expect(logs).toHaveLength(2);
  });

  it("filter daftar ulasan: produk, bintang, belum dibalas, status", async () => {
    const [p] = await db.select({ name: schema.products.name, id: schema.products.id }).from(schema.products).where(t.sql`${schema.products.reviewCount} >= 2`).limit(1);
    const r = await listAdminReviews(db, { product: p.name.slice(0, 8) });
    expect(r.total).toBeGreaterThanOrEqual(2);
    expect(r.rows.every((x) => x.productName.toLowerCase().includes(p.name.slice(0, 8).toLowerCase()))).toBe(true);
    const low = await listAdminReviews(db, { rating: 2, unreplied: true, status: "tampil" });
    expect(low.rows.every((x) => x.rating === 2 && x.storeReply == null && x.status === "tampil")).toBe(true);
    expect(low.total).toBe(low.rows.length);
  });

  it("menyembunyikan ulasan menghitung ulang rating; balasan pertama memberi tahu pembeli", async () => {
    const c = await t.customer({ email: `uji${Date.now()}@contoh.demo` });
    const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(t.sql`${schema.products.reviewCount} >= 2`).limit(1);
    const ratingOf = async () => (await db.select({ a: schema.products.ratingAvg, n: schema.products.reviewCount }).from(schema.products).where(eq(schema.products.id, p.id)))[0];
    const before = await ratingOf();
    const [r] = await db.insert(schema.reviews).values({ productId: p.id, customerId: c.id, authorName: "Pembeli Uji", rating: 1, body: "Ulasan uji untuk moderasi, isinya cukup panjang.", status: "tampil" }).returning({ id: schema.reviews.id });
    reviewIds.push(r.id);
    await db.execute(t.sql`update products set review_count = review_count + 1 where id = ${p.id}`);

    expect(await hideReviews(db, gudang, [r.id], "Spam berulang")).toMatchObject({ ok: false });
    expect(await hideReviews(db, adminOnline, [r.id], "x")).toMatchObject({ ok: false, message: expect.stringMatching(/alasan/) });
    const hidden = await hideReviews(db, adminOnline, [r.id], "Berisi data pribadi", { now });
    expect(hidden).toMatchObject({ ok: true, changed: 1 });
    expect(await ratingOf()).toEqual(before);
    const [h] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, r.id));
    expect(h).toMatchObject({ status: "sembunyi", hiddenReason: "Berisi data pribadi" });

    expect(await showReview(db, adminOnline, r.id, { now })).toMatchObject({ ok: true, changed: 1 });
    const shown = await ratingOf();
    expect(shown.n).toBe(before.n + 1);
    expect(shown.a).toBeLessThan(before.a);

    const first = await replyReview(db, owner, r.id, "Maaf atas pengalamannya, Kak. Tim kami menghubungimu ya.", { now });
    expect(first).toMatchObject({ ok: true, notified: 2 });
    const notes = await db.select().from(schema.notifications).where(t.and(eq(schema.notifications.customerId, c.id), eq(schema.notifications.kind, "ulasan_dibalas")));
    expect(notes.map((n) => n.channel).sort()).toEqual(["email", "wa"]);
    expect(notes[0].body).toContain("Maaf atas pengalamannya");
    expect(await replyReview(db, owner, r.id, "Balasan diperbarui, terima kasih sudah menunggu.", { now })).toMatchObject({ ok: true, notified: 0 });
    expect(await replyReview(db, owner, r.id, "ok")).toMatchObject({ ok: false });
    const [replied] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, r.id));
    expect(replied.storeReply).toBe("Balasan diperbarui, terima kasih sudah menunggu.");
    expect(await deleteReply(db, owner, r.id, { now })).toMatchObject({ ok: true, changed: 1 });
    const [cleared] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, r.id));
    expect(cleared.storeReply).toBeNull();
    const actions = (await db.select({ a: schema.auditLogs.action }).from(schema.auditLogs).where(t.and(eq(schema.auditLogs.objectType, "ulasan"), eq(schema.auditLogs.objectId, String(r.id))))).map((x) => x.a);
    expect(actions.sort()).toEqual(["ulasan.balas", "ulasan.balas", "ulasan.hapus_balasan", "ulasan.sembunyi", "ulasan.tampil"]);
  });

  describe("pengirim email", () => {
    const insert = async (recipient: string) => {
      const [n] = await db.insert(schema.notifications).values({ channel: "email", recipient, subject: "Pesanan uji dibayar", body: "Halo, pesananmu dibayar. Lihat /pesanan/RONA-UJI", status: "antre", kind: "dibayar" }).returning({ id: schema.notifications.id });
      notifIds.push(n.id);
      return n.id;
    };
    const row = async (id: number) => (await db.select().from(schema.notifications).where(eq(schema.notifications.id, id)))[0];
    const demo = (allow: string[]) => ({ ...emailConfig({ DEMO_MODE: "true", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "x", EMAIL_FROM: "Rona <h@r.t>" }), allowlist: allow });

    it("mode pratinjau tidak mengirim apa pun", async () => {
      const id = await insert("siapa@contoh.demo");
      const r = await dispatchEmails(db, { site: SITE, ids: [id], config: emailConfig({}) });
      expect(r.mode).toBe("preview");
      expect(await row(id)).toMatchObject({ status: "antre", attempts: 0 });
    });

    it("mode demo: hanya alamat di allowlist yang dikirim, sisanya dilewati; kunci idempoten per notifikasi", async () => {
      const ok = await insert("Tim@Contoh.demo");
      const skip = await insert("orang@lain.demo");
      const f = fakeProvider();
      const r = await dispatchEmails(db, { site: SITE, ids: [ok, skip], config: demo(["tim@contoh.demo"]), provider: f.provider, now });
      expect(r).toMatchObject({ mode: "kirim", sent: 1, skipped: 1 });
      expect(f.sent).toHaveLength(1);
      expect(f.sent[0]).toMatchObject({ to: "Tim@Contoh.demo", idempotencyKey: notificationIdempotencyKey(ok) });
      expect(f.sent[0].text).toContain(`${SITE}/pesanan/RONA-UJI`);
      expect(await row(ok)).toMatchObject({ status: "terkirim", attempts: 1, lastError: null, claimedAt: null });
      expect((await row(ok)).providerId).toMatch(/^em_/);
      expect(await row(skip)).toMatchObject({ status: "dilewati", lastError: expect.stringMatching(/ALLOWLIST/) });
      // Dikirim lagi: yang sudah terkirim tidak pernah dikirim ulang.
      await dispatchEmails(db, { site: SITE, ids: [ok, skip], config: demo(["tim@contoh.demo"]), provider: f.provider, retry: true });
      expect(f.sent).toHaveLength(1);
    });

    it("dua pengirim bersamaan tidak mengirim notifikasi yang sama dua kali", async () => {
      const ids = [await insert("tim@contoh.demo"), await insert("tim@contoh.demo"), await insert("tim@contoh.demo")];
      const f = fakeProvider();
      const cfg = demo(["tim@contoh.demo"]);
      await Promise.all([1, 2, 3].map(() => dispatchEmails(db, { site: SITE, ids, config: cfg, provider: f.provider })));
      expect(f.sent.map((m) => m.idempotencyKey).sort()).toEqual(ids.map(notificationIdempotencyKey).sort());
      for (const id of ids) expect((await row(id)).status).toBe("terkirim");
    });

    it("error penyedia: gagal dicatat, dicoba ulang lewat cron sampai 3 kali, error permanen langsung berhenti", async () => {
      const id = await insert("tim@contoh.demo");
      const down = fakeProvider(() => ({ ok: false, error: "Resend 503: sibuk", retryable: true }));
      const cfg = demo(["tim@contoh.demo"]);
      await dispatchEmails(db, { site: SITE, ids: [id], config: cfg, provider: down.provider });
      expect(await row(id)).toMatchObject({ status: "gagal", attempts: 1, lastError: "Resend 503: sibuk" });
      // Tanpa retry (kirim setelah transaksi) yang gagal tidak diambil lagi.
      await dispatchEmails(db, { site: SITE, ids: [id], config: cfg, provider: down.provider });
      expect((await row(id)).attempts).toBe(1);
      for (let i = 0; i < 4; i++) await dispatchEmails(db, { site: SITE, ids: [id], config: cfg, provider: down.provider, retry: true });
      expect(await row(id)).toMatchObject({ status: "gagal", attempts: 3 });
      expect(down.sent).toHaveLength(3);

      const bad = await insert("tim@contoh.demo");
      const reject = fakeProvider(() => ({ ok: false, error: "Resend 422: alamat tidak valid", retryable: false }));
      await dispatchEmails(db, { site: SITE, ids: [bad], config: cfg, provider: reject.provider });
      expect(await row(bad)).toMatchObject({ status: "gagal", attempts: 3 });

      // Kirim ulang manual dari admin mengabaikan batas percobaan dan tercatat di log.
      const up = fakeProvider();
      expect(await resendNotification(db, adminOnline, id, { site: SITE, config: cfg, provider: up.provider })).toMatchObject({ ok: false });
      expect(await resendNotification(db, owner, id, { site: SITE, config: cfg, provider: up.provider, now })).toMatchObject({ ok: true, status: "terkirim" });
      expect(await row(id)).toMatchObject({ status: "terkirim", attempts: 4 });
      const [log] = await db.select().from(schema.auditLogs).where(t.and(eq(schema.auditLogs.action, "notifikasi.kirim_ulang"), eq(schema.auditLogs.objectId, String(id))));
      expect(log).toBeTruthy();
    });
  });
});
