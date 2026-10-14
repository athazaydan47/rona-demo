// Notifikasi keluar (outbox) di panel admin: daftar dengan filter dan kirim ulang email yang gagal.
import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { dispatchEmails, type DispatchOptions } from "@/lib/email/dispatch";
import { writeAudit } from "./audit";
import { can, type StaffPrincipal } from "./permissions";

export const OUTBOX_PAGE_SIZE = 25;
export const OUTBOX_STATUS_LABELS: Record<string, string> = { antre: "Menunggu", terkirim: "Terkirim", gagal: "Gagal", dilewati: "Dilewati" };
export type OutboxFilters = { channel?: "wa" | "email" | null; status?: "antre" | "terkirim" | "gagal" | "dilewati" | null; from?: Date | null; to?: Date | null; page?: number };

export async function listOutbox(db: AnyDb, f: OutboxFilters) {
  const n = schema.notifications;
  const where = and(...([f.channel ? eq(n.channel, f.channel) : undefined, f.status ? eq(n.status, f.status) : undefined, f.from ? gte(n.createdAt, f.from) : undefined, f.to ? lt(n.createdAt, f.to) : undefined] as (SQL | undefined)[]));
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ total }], byStatus] = await Promise.all([
    db
      .select({ id: n.id, channel: n.channel, kind: n.kind, recipient: n.recipient, subject: n.subject, body: n.body, status: n.status, attempts: n.attempts, lastError: n.lastError, createdAt: n.createdAt, sentAt: n.sentAt, orderId: n.orderId, customerId: n.customerId })
      .from(n)
      .where(where)
      .orderBy(desc(n.createdAt), desc(n.id))
      .limit(OUTBOX_PAGE_SIZE)
      .offset((page - 1) * OUTBOX_PAGE_SIZE),
    db.select({ total: count() }).from(n).where(where),
    db.select({ channel: n.channel, status: n.status, c: count() }).from(n).groupBy(n.channel, n.status),
  ]);
  return { rows, total: Number(total), page, pageCount: Math.max(1, Math.ceil(Number(total) / OUTBOX_PAGE_SIZE)), byStatus: byStatus.map((b) => ({ ...b, c: Number(b.c) })) };
}

// Kirim ulang manual satu email gagal atau dilewati. Mengabaikan batas percobaan cron, tetap lewat allowlist demo.
export async function resendNotification(db: AnyDb, staff: StaffPrincipal, id: number, opts: Omit<DispatchOptions, "ids" | "force">) {
  if (!can(staff, "pengaturan.kelola")) return { ok: false as const, message: "Kamu tidak punya izin." };
  const [row] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id)).limit(1);
  if (!row) return { ok: false as const, message: "Notifikasi tidak ditemukan." };
  if (row.channel !== "email") return { ok: false as const, message: "Kanal WhatsApp masih pratinjau, belum bisa dikirim." };
  if (row.status === "terkirim") return { ok: false as const, message: "Email ini sudah terkirim." };
  if (row.status === "dilewati") await db.update(schema.notifications).set({ status: "gagal" }).where(eq(schema.notifications.id, id));
  const r = await dispatchEmails(db, { ...opts, ids: [id], force: true });
  if (r.mode === "preview") {
    if (row.status === "dilewati") await db.update(schema.notifications).set({ status: "dilewati" }).where(eq(schema.notifications.id, id));
    return { ok: false as const, message: "Pengiriman email belum aktif (EMAIL_PROVIDER pratinjau)." };
  }
  const [after] = await db.select({ status: schema.notifications.status, lastError: schema.notifications.lastError }).from(schema.notifications).where(eq(schema.notifications.id, id));
  await writeAudit(db, { staff, action: "notifikasi.kirim_ulang", objectType: "notifikasi", objectId: id, summary: `Kirim ulang email "${row.subject}": ${OUTBOX_STATUS_LABELS[after.status]}`, before: { status: row.status, percobaan: row.attempts }, after: { status: after.status, error: after.lastError }, at: opts.now });
  return after.status === "terkirim" ? { ok: true as const, status: after.status } : { ok: false as const, message: after.lastError ?? `Status: ${OUTBOX_STATUS_LABELS[after.status]}` };
}
