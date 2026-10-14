// Asisten Admin terhadap database lokal (model mock): angka omzet sama dengan fungsi laporan, peran dihormati, jejak
// audit di ai_logs tanpa isi hasil tool, penyamaran kontak, Kabar Harian dengan dan tanpa AI, transkripsi suara, dan
// saran transfer pada data seed.
import { afterAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { loadPrincipal } from "@/lib/admin/auth";
import { withStream, type AiModel } from "@/lib/ai/client";
import { createMockModel } from "@/lib/ai/mock";
import { transcribeAudio } from "@/lib/asisten/suara";
import { formatRupiah as rupiah } from "@/lib/format";

// Teks jawaban dinormalkan (spasi tak terputus menjadi spasi biasa).
const formatRupiah = (n: number) => rupiah(n).replace(/\u00A0/g, " ");
import { transferSuggestions } from "@/lib/inventory/saran";
import { generateDailyBrief } from "@/lib/kabar";
import { advisorPerformance, summarize, wibDayKey, wibDayStart } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";
import { runAssistant } from "./otak";
import { parsePeriode } from "./periode";
import { executeTool } from "./tools";

describe.skipIf(!dbUrl)("Asisten Admin (integrasi)", () => {
  const t = integration();
  const { db, schema, eq } = t;
  const now = new Date();
  const started = new Date(now.getTime() - 1000);
  const principal = async (email: string) => {
    const [s] = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.email, email));
    return (await loadPrincipal(db, s.id))!;
  };
  const mock = createMockModel();
  const broken: AiModel = withStream({ name: "rusak", generate: async () => Promise.reject(new Error("HTTP 503")) });

  afterAll(async () => {
    await db.delete(schema.aiLogs).where(t.sql`${schema.aiLogs.createdAt} >= ${started.toISOString()}::timestamptz and ${schema.aiLogs.door} in ('panel', 'kabar_harian')`);
    await db.delete(schema.notifications).where(t.sql`${schema.notifications.kind} = 'kabar_harian' and ${schema.notifications.createdAt} >= ${started.toISOString()}::timestamptz`);
    await t.cleanup();
  });

  it("owner: omzet minggu ini sama dengan summarize() untuk periode yang sama, jejak audit tanpa isi hasil tool", async () => {
    const owner = await principal("owner@rona.demo");
    const r = await runAssistant({ db, model: mock, staff: owner, now, door: "panel" }, [{ role: "user", text: "Omzet minggu ini dibanding minggu lalu" }]);
    const p = parsePeriode("minggu ini", now);
    const expected = summarize(await loadReportData(db, p.ok ? p.periode : (null as never))).revenue;
    expect(r.toolCalls).toEqual(["ringkasan_penjualan"]);
    expect(r.teks).toContain(formatRupiah(expected));
    expect(r.peringatan).toBeNull();
    expect(r.tautan[0].href).toContain(`dari=${p.ok && p.periode.firstDay}`);
    const [log] = await db.select().from(schema.aiLogs).where(eq(schema.aiLogs.staffId, owner.id)).orderBy(t.sql`${schema.aiLogs.id} desc`).limit(1);
    expect(log).toMatchObject({ feature: "asisten", door: "panel", tools: ["ringkasan_penjualan"], ok: true, query: null });
    expect(JSON.stringify(log)).not.toContain(String(expected)); // isi hasil tool tidak dicatat
  });

  it("staf Dinoyo: omzet ditolak sopan tanpa tool data; stok dijawab dan terkunci ke Dinoyo", async () => {
    const dinoyo = await principal("dinoyo@rona.demo");
    const refused = await runAssistant({ db, model: mock, staff: dinoyo, now, door: "panel" }, [{ role: "user", text: "Omzet Dinoyo minggu ini berapa?" }]);
    expect(refused).toMatchObject({ status: "langsung", toolCalls: [] });
    expect(refused.teks).toMatch(/izin/);
    const stock = await runAssistant({ db, model: mock, staff: dinoyo, now, door: "panel" }, [{ role: "user", text: "Stok Lumi Velvet Matte Lipstick 05 Mawar Tua di Sawojajar" }]);
    expect(stock.toolCalls).toEqual(["stok_varian"]);
    expect(stock.tabel?.baris.map((b) => b[1])).toEqual(["Rona Dinoyo"]);
  });

  it("hasil tool: kolom rupiah dihapus untuk admin online, kontak disamarkan untuk staf cabang", async () => {
    const admin = await principal("admin@rona.demo");
    const owner = await principal("owner@rona.demo");
    const ctx = (staff: typeof admin) => ({ db, staff, now });
    const a = await executeTool("ringkasan_penjualan", { periode: "bulan ini" }, ctx(admin));
    expect(JSON.stringify(a.result)).not.toMatch(/Rp"/);
    expect(a.result).toMatchObject({ pesanan: expect.any(Number), catatanIzin: expect.stringContaining("disembunyikan") });
    expect((await executeTool("ringkasan_penjualan", { periode: "bulan ini" }, ctx(owner))).result).toHaveProperty("omzetRp");
    const dinoyo = await principal("dinoyo@rona.demo");
    const [order] = await db.select({ number: schema.orders.number, phone: schema.orders.guestPhone, locationId: schema.orders.locationId }).from(schema.orders).where(eq(schema.orders.locationId, dinoyo.locationIds[0])).orderBy(t.sql`${schema.orders.id} desc`).limit(1);
    const found = await executeTool("cari_pesanan", { cari: order.number }, ctx(dinoyo));
    const rows = (found.result.pesanan as { nomorWa: string; cabang: string }[]) ?? [];
    expect(rows[0].nomorWa).toMatch(/\*\*\*\*/);
    expect(rows[0].nomorWa).not.toBe(order.phone);
    expect(JSON.stringify(found.result)).not.toMatch(/totalRp/); // staf cabang tanpa izin keuangan
  });

  it("AI tidak tersedia: jawaban jujur yang berbeda dari penolakan akses", async () => {
    const owner = await principal("owner@rona.demo");
    const r = await runAssistant({ db, model: broken, staff: owner, now, door: "panel" }, [{ role: "user", text: "Omzet hari ini" }]);
    expect(r).toMatchObject({ ok: false, status: "tidak_tersedia" });
    expect(r.teks).toContain("Asisten sedang tidak tersedia");
  });

  it("Kabar Harian dengan AI, tanpa AI, dan saat AI gagal; WA hanya ke nomor owner", async () => {
    const day = wibDayStart(now, 1);
    const key = wibDayKey(day);
    const [before] = await db.select().from(schema.dailyBriefs).where(eq(schema.dailyBriefs.day, key));
    try {
      expect(await generateDailyBrief(db, { now, day, model: null, overwrite: true })).toMatchObject({ day: key, source: "templat", created: true });
      expect(await generateDailyBrief(db, { now, day, model: broken, overwrite: true })).toMatchObject({ source: "templat" });
      const ai = await generateDailyBrief(db, { now, day, model: mock, notify: true, overwrite: true });
      expect(ai).toMatchObject({ source: "ai", notified: true });
      const [row] = await db.select().from(schema.dailyBriefs).where(eq(schema.dailyBriefs.day, key));
      const data = row.data as { omzetRp: number };
      expect(data.omzetRp).toBe(summarize(await loadReportData(db, { from: day, to: wibDayStart(now) })).revenue);
      expect(row.narrative).toContain(formatRupiah(data.omzetRp));
      const sent = await db.select().from(schema.notifications).where(t.sql`${schema.notifications.kind} = 'kabar_harian' and ${schema.notifications.createdAt} >= ${started.toISOString()}::timestamptz`);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ channel: "wa", status: "antre", customerId: null });
      // Sudah ada narasi AI: tanpa overwrite tidak dibuat ulang.
      expect(await generateDailyBrief(db, { now, day, model: mock })).toMatchObject({ created: false, source: "ai" });
    } finally {
      if (before) await db.insert(schema.dailyBriefs).values(before).onConflictDoUpdate({ target: schema.dailyBriefs.day, set: { data: before.data, narrative: before.narrative, source: before.source, model: before.model, createdAt: before.createdAt } });
    }
  });

  it("transkripsi suara: rekaman sah menjadi teks, format salah dan model gagal dijawab rapi", async () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);
    expect(await transcribeAudio(db, mock, webm, { staffId: 1, now })).toEqual({ ok: true, teks: "Omzet minggu ini dibanding minggu lalu" });
    expect(await transcribeAudio(db, mock, new TextEncoder().encode("bukan audio"), { staffId: 1, now })).toMatchObject({ ok: false });
    expect(await transcribeAudio(db, broken, webm, { staffId: 1, now })).toMatchObject({ ok: false });
    expect(await transcribeAudio(db, mock, new Uint8Array(3 * 1024 * 1024).fill(0x1a), { staffId: 1, now })).toMatchObject({ ok: false, message: expect.stringContaining("60 detik") });
  });

  it("saran transfer pada data seed: jumlah wajar dan asal tidak kekurangan; atribusi Advisor terisi", async () => {
    const r = await transferSuggestions(db, { now, kurangHari: 7, lebihHari: 30, keepMin: 5 });
    for (const s of r.suggestions) {
      expect(s.quantity).toBeGreaterThan(0);
      expect(s.fromAvailable - s.quantity).toBeGreaterThanOrEqual(5);
      expect(s.toDaysLeft).toBeLessThan(7);
    }
    const adv = advisorPerformance(await loadReportData(db, { from: wibDayStart(now, 29), to: wibDayStart(now, -1) }));
    expect(adv.orders).toBeGreaterThan(0);
    expect(adv.conversations).toBeGreaterThan(adv.cartAdds);
    expect(adv.ordersShare).toBeLessThan(25);
  });
});
