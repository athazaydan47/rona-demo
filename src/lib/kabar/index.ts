// Kabar Harian (Fase 7B): ringkasan hari kemarin untuk owner. Isi angka deterministik dari src/lib/reports dan modul
// stok, ulasan, dan saran transfer; narasi 2 sampai 4 kalimat dari otak Asisten Admin (penjaga angka yang sama) bila AI
// tersedia, selain itu templat. Kabar Harian tidak pernah gagal dibuat dan notifikasinya tidak pernah memblokir alur.
// WA hanya ke nomor owner di Profil toko (satu pesan, bukan siaran massal).
import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { StaffPrincipal } from "@/lib/admin/permissions";
import { lowStockThreshold } from "@/lib/admin/stock";
import type { AiModel } from "@/lib/ai/client";
import { composeFromData } from "@/lib/asisten/otak";
import type { AnyDb } from "@/lib/db-types";
import { formatDateWib, formatRupiah, toWibParts, weekdayNameId } from "@/lib/format";
import { transferSuggestions } from "@/lib/inventory/saran";
import { dailySeries, percentChange, summarize, topProducts, wibDayKey, wibDayStart } from "@/lib/reports";
import { loadReportData } from "@/lib/reports/load";
import { loadSettings } from "@/lib/settings/db";

const DAY = 86_400_000;
export const BRIEF_HISTORY_DAYS = 14;

export type BriefData = {
  tanggal: string; // "2026-10-13"
  hari: string; // "Senin, 13 Okt 2026"
  omzetRp: number;
  pesanan: number;
  rataRataPesananRp: number;
  kemarinLusa: { omzetRp: number; pesanan: number; perubahanOmzetPersen: number | null };
  rata7Hari: { omzetRp: number; pesanan: number; perubahanOmzetPersen: number | null };
  terlaris: { produk: string; unit: number }[];
  stokMenipis: { lokasi: string; habis: number; menipis: number }[];
  pesananBermasalah: { kedaluwarsa: number; dibatalkan: number; menungguLama: number };
  ulasanBurukBelumDibalas: number;
  saranTransfer: { produk: string; dari: string; ke: string; jumlah: number }[];
  definisiOmzet: string;
};

// Staf sistem untuk pintu Kabar Harian (peran owner, semua lokasi). Tidak pernah dipakai untuk masuk.
export const BRIEF_PRINCIPAL: StaffPrincipal = { id: 0, name: "Kabar Harian", email: "", roleSlug: "owner", isActive: true, grants: [], revokes: [], locationIds: [] };

export async function buildBriefData(db: AnyDb, dayStart: Date, now: Date): Promise<BriefData> {
  const range = { from: dayStart, to: new Date(dayStart.getTime() + DAY) };
  const prevRange = { from: new Date(dayStart.getTime() - DAY), to: dayStart };
  const weekRange = { from: new Date(dayStart.getTime() - 7 * DAY), to: dayStart };
  const [data, prev, week] = await Promise.all([loadReportData(db, range), loadReportData(db, prevRange), loadReportData(db, weekRange)]);
  const s = summarize(data);
  const p = summarize(prev);
  const days = dailySeries(week);
  const avgRev = Math.round(days.reduce((a, d) => a + d.revenue, 0) / Math.max(1, days.length));
  const avgOrders = Math.round((days.reduce((a, d) => a + d.orders, 0) / Math.max(1, days.length)) * 10) / 10;

  const threshold = await lowStockThreshold(db);
  const locs = await db.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(schema.locations.sortOrder);
  const low = await db
    .select({ locationId: schema.inventory.locationId, available: sql<number>`(${schema.inventory.onHand} - ${schema.inventory.reserved})::int` })
    .from(schema.inventory)
    .innerJoin(schema.variants, eq(schema.inventory.variantId, schema.variants.id))
    .where(and(inArray(schema.inventory.locationId, locs.map((l) => l.id)), lte(sql`${schema.inventory.onHand} - ${schema.inventory.reserved}`, threshold), eq(schema.variants.isActive, true)));

  const cancelled = await db
    .select({ paymentStatus: schema.payments.status })
    .from(schema.orderStatusHistory)
    .innerJoin(schema.orders, eq(schema.orderStatusHistory.orderId, schema.orders.id))
    .leftJoin(schema.payments, eq(schema.payments.orderId, schema.orders.id))
    .where(and(eq(schema.orderStatusHistory.toStatus, "dibatalkan"), gte(schema.orderStatusHistory.createdAt, range.from), lt(schema.orderStatusHistory.createdAt, range.to)));
  const [waiting] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.orders).where(and(eq(schema.orders.status, "dibayar"), lt(schema.orders.paidAt, new Date(now.getTime() - DAY))));
  const [badReviews] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.reviews).where(and(lte(schema.reviews.rating, 2), eq(schema.reviews.status, "tampil"), isNull(schema.reviews.storeReply)));
  const settings = await loadSettings(db);
  const transfers = await transferSuggestions(db, { now, kurangHari: settings.saran.kurangHari, lebihHari: settings.saran.lebihHari, keepMin: settings.lowStock, limit: 3 });
  const parts = toWibParts(dayStart);

  return {
    tanggal: wibDayKey(dayStart),
    hari: `${weekdayNameId(parts.weekday)}, ${formatDateWib(dayStart)}`,
    omzetRp: s.revenue,
    pesanan: s.orders,
    rataRataPesananRp: s.averageOrder,
    kemarinLusa: { omzetRp: p.revenue, pesanan: p.orders, perubahanOmzetPersen: percentChange(s.revenue, p.revenue) },
    rata7Hari: { omzetRp: avgRev, pesanan: avgOrders, perubahanOmzetPersen: percentChange(s.revenue, avgRev) },
    terlaris: topProducts(data, "quantity").slice(0, 3).map((r) => ({ produk: r.label, unit: r.quantity })),
    stokMenipis: locs.map((l) => ({ lokasi: l.name, habis: low.filter((x) => x.locationId === l.id && x.available <= 0).length, menipis: low.filter((x) => x.locationId === l.id && x.available > 0).length })),
    pesananBermasalah: { kedaluwarsa: cancelled.filter((c) => c.paymentStatus === "kedaluwarsa").length, dibatalkan: cancelled.filter((c) => c.paymentStatus !== "kedaluwarsa").length, menungguLama: Number(waiting?.n ?? 0) },
    ulasanBurukBelumDibalas: Number(badReviews?.n ?? 0),
    saranTransfer: transfers.suggestions.map((t) => ({ produk: `${t.productName} ${t.shadeName}`, dari: t.fromName, ke: t.toName, jumlah: t.quantity })),
    definisiOmzet: "pesanan yang dibayar hari itu, tanpa yang dibatalkan atau diretur",
  };
}

const pct = (n: number | null) => (n == null ? "belum ada pembanding" : `${n > 0 ? "naik" : n < 0 ? "turun" : "sama"}${n ? ` ${String(Math.abs(n)).replace(".", ",")}%` : ""}`);

// Narasi templat (tanpa AI), selalu tersedia.
export function templateNarrative(d: BriefData) {
  const top = d.terlaris[0];
  const issues = d.pesananBermasalah.kedaluwarsa + d.pesananBermasalah.dibatalkan;
  return [
    `Omzet ${d.hari} ${formatRupiah(d.omzetRp)} dari ${d.pesanan} pesanan, ${pct(d.kemarinLusa.perubahanOmzetPersen)} dibanding kemarin lusa.`,
    top ? `Paling laku ${top.produk} (${top.unit} pcs).` : "Belum ada produk terjual.",
    issues || d.ulasanBurukBelumDibalas ? `Perlu perhatian: ${issues} pesanan batal atau kedaluwarsa dan ${d.ulasanBurukBelumDibalas} ulasan buruk belum dibalas.` : "Tidak ada pesanan bermasalah atau ulasan buruk yang menunggu.",
  ].join(" ");
}

// Teks WA (pratinjau gelembung dan tombol Salin untuk WA).
export function briefWaText(d: BriefData, narrative: string) {
  const lines = [
    "*Kabar Harian Rona Beauty*",
    d.hari,
    "",
    narrative,
    "",
    `*Omzet:* ${formatRupiah(d.omzetRp)} dari ${d.pesanan} pesanan`,
    `vs kemarin lusa: ${pct(d.kemarinLusa.perubahanOmzetPersen)} (${formatRupiah(d.kemarinLusa.omzetRp)})`,
    `vs rata-rata 7 hari: ${pct(d.rata7Hari.perubahanOmzetPersen)} (${formatRupiah(d.rata7Hari.omzetRp)})`,
  ];
  if (d.terlaris.length) lines.push("", "*Terlaris:*", ...d.terlaris.map((t, i) => `${i + 1}. ${t.produk} (${t.unit} pcs)`));
  const stok = d.stokMenipis.filter((s) => s.habis || s.menipis);
  if (stok.length) lines.push("", "*Stok menipis:*", ...stok.map((s) => `${s.lokasi}: ${s.habis} habis, ${s.menipis} menipis`));
  const b = d.pesananBermasalah;
  lines.push("", `*Pesanan bermasalah:* ${b.kedaluwarsa} kedaluwarsa, ${b.dibatalkan} dibatalkan, ${b.menungguLama} menunggu diproses lebih dari sehari`);
  lines.push(`*Ulasan buruk belum dibalas:* ${d.ulasanBurukBelumDibalas}`);
  if (d.saranTransfer.length) lines.push("", "*Saran transfer:*", ...d.saranTransfer.map((t) => `${t.produk}: ${t.jumlah} pcs dari ${t.dari} ke ${t.ke}`));
  lines.push("", `Omzet = ${d.definisiOmzet}.`);
  return lines.join("\n");
}

export type BriefOutcome = { day: string; source: "ai" | "templat"; created: boolean; notified: boolean };

// Buat atau perbarui Kabar Harian untuk satu hari. Tidak pernah melempar galat ke pemanggil (cron tetap lanjut).
// overwrite: true menimpa apa pun; "templat" hanya menimpa kabar bertemplat (narasi AI dipertahankan).
export async function generateDailyBrief(db: AnyDb, opts: { now: Date; day?: Date; model: AiModel | null; notify?: boolean; overwrite?: boolean | "templat" }): Promise<BriefOutcome | { day: string; error: string }> {
  const dayStart = opts.day ?? wibDayStart(opts.now, 1);
  const key = wibDayKey(dayStart);
  try {
    const [existing] = await db.select({ source: schema.dailyBriefs.source }).from(schema.dailyBriefs).where(eq(schema.dailyBriefs.day, key)).limit(1);
    const keep = existing && (opts.overwrite === true ? false : opts.overwrite === "templat" ? existing.source === "ai" : existing.source === "ai" || !opts.model);
    if (existing && keep) return { day: key, source: existing.source as "ai" | "templat", created: false, notified: false };
    const data = await buildBriefData(db, dayStart, opts.now);
    let narrative = templateNarrative(data);
    let source: "ai" | "templat" = "templat";
    if (opts.model) {
      const r = await composeFromData({ db, model: opts.model, staff: BRIEF_PRINCIPAL, now: opts.now, door: "kabar_harian" }, "TUGAS: kabar_harian. Tulis narasi Kabar Harian untuk owner, 2 sampai 4 kalimat: omzet kemarin dan perbandingannya, produk terlaris, dan hal yang perlu perhatian. Sebut bahwa periodenya kemarin.", data as unknown as Record<string, unknown>, { maxSentences: 4 });
      if (r.ok && r.teks) {
        narrative = r.teks;
        source = "ai";
      }
    }
    await db
      .insert(schema.dailyBriefs)
      .values({ day: key, data: data as unknown as Record<string, unknown>, narrative, source, model: source === "ai" ? (opts.model?.name ?? "") : "", createdAt: opts.now })
      .onConflictDoUpdate({ target: schema.dailyBriefs.day, set: { data: data as unknown as Record<string, unknown>, narrative, source, model: source === "ai" ? (opts.model?.name ?? "") : "", createdAt: opts.now } });
    let notified = false;
    if (opts.notify) {
      // Satu pesan ke nomor owner saja; kegagalan antrean tidak menggagalkan Kabar Harian.
      try {
        const settings = await loadSettings(db);
        await db.insert(schema.notifications).values({ kind: "kabar_harian", channel: "wa", recipient: settings.profile.whatsapp, subject: `Kabar Harian ${data.hari}`, body: briefWaText(data, narrative), status: "antre", createdAt: opts.now });
        notified = true;
      } catch {
        notified = false;
      }
    }
    return { day: key, source, created: true, notified };
  } catch (e) {
    return { day: key, error: e instanceof Error ? e.message : String(e) };
  }
}

// Isi riwayat 14 hari dengan templat (tanpa AI dan tanpa WA). Dipakai seed supaya halaman tidak kosong saat demo; kabar
// bertemplat dari data lama ditimpa, narasi AI dipertahankan.
export async function fillBriefHistory(db: AnyDb, now: Date, days = BRIEF_HISTORY_DAYS) {
  let created = 0;
  for (let i = days; i >= 1; i--) {
    const r = await generateDailyBrief(db, { now, day: wibDayStart(now, i), model: null, overwrite: "templat" });
    if ("created" in r && r.created) created++;
  }
  return created;
}

export async function listBriefs(db: AnyDb, now: Date) {
  const from = wibDayKey(wibDayStart(now, BRIEF_HISTORY_DAYS));
  return db.select().from(schema.dailyBriefs).where(gte(schema.dailyBriefs.day, from)).orderBy(sql`${schema.dailyBriefs.day} desc`);
}
