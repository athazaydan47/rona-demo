// Pengirim outbox email. Status per notifikasi: antre (Menunggu), terkirim, gagal, dilewati.
// Aman dijalankan bersamaan: setiap baris diklaim dulu (claimed_at) sebelum dikirim, dan penyedia menerima kunci
// idempoten per notifikasi, jadi satu notifikasi tidak pernah terkirim dua kali.
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { emailConfig, emailReady, MAX_EMAIL_ATTEMPTS, recipientAllowed, renderEmail, type EmailConfig, type EmailProvider } from "./index";
import { createResendProvider } from "./resend";

export const CLAIM_TIMEOUT_MS = 5 * 60_000;
export const notificationIdempotencyKey = (id: number) => `rona-notif-${id}`;

export type DispatchResult = { mode: "preview" | "kirim"; claimed: number; sent: number; failed: number; skipped: number };
export type DispatchOptions = {
  now?: Date;
  site: string;
  config?: EmailConfig;
  provider?: EmailProvider; // uji memakai adapter tiruan
  ids?: number[]; // hanya notifikasi ini (kirim setelah transaksi, atau kirim ulang dari admin)
  retry?: boolean; // ikutkan yang gagal dengan percobaan di bawah batas (cron harian)
  force?: boolean; // kirim ulang manual: abaikan batas percobaan
  limit?: number;
};

export function providerFor(cfg: EmailConfig): EmailProvider | null {
  if (!emailReady(cfg)) return null;
  return createResendProvider(cfg.apiKey, cfg.from);
}

export async function dispatchEmails(db: AnyDb, opts: DispatchOptions): Promise<DispatchResult> {
  const cfg = opts.config ?? emailConfig();
  const provider = opts.provider ?? providerFor(cfg);
  const out: DispatchResult = { mode: provider ? "kirim" : "preview", claimed: 0, sent: 0, failed: 0, skipped: 0 };
  // Mode pratinjau: tidak mengirim apa pun, email tetap Menunggu dan terlihat di Kotak Notifikasi.
  if (!provider) return out;
  const now = opts.now ?? new Date();
  const n = schema.notifications;
  const retryable = opts.force ? sql`true` : lt(n.attempts, MAX_EMAIL_ATTEMPTS);
  const statusCond = opts.retry || opts.force ? or(eq(n.status, "antre"), and(eq(n.status, "gagal"), retryable)) : and(eq(n.status, "antre"), eq(n.attempts, 0));
  const candidates = await db
    .select({ id: n.id })
    .from(n)
    .where(and(eq(n.channel, "email"), statusCond, opts.ids ? inArray(n.id, opts.ids.length ? opts.ids : [-1]) : undefined))
    .orderBy(asc(n.createdAt), asc(n.id))
    .limit(opts.limit ?? 50);

  for (const { id } of candidates) {
    // Klaim: hanya satu proses yang berhasil mengambil baris ini. Klaim lama (proses mati) kedaluwarsa setelah 5 menit.
    const [row] = await db
      .update(n)
      .set({ claimedAt: now })
      .where(and(eq(n.id, id), inArray(n.status, ["antre", "gagal"]), or(isNull(n.claimedAt), lt(n.claimedAt, new Date(now.getTime() - CLAIM_TIMEOUT_MS)))))
      .returning();
    if (!row) continue;
    out.claimed += 1;
    if (!recipientAllowed(row.recipient, cfg)) {
      await db.update(n).set({ status: "dilewati", lastError: "Mode demo: alamat di luar EMAIL_ALLOWLIST.", claimedAt: null }).where(eq(n.id, id));
      out.skipped += 1;
      continue;
    }
    const { html, text } = renderEmail({ subject: row.subject || "Kabar dari Rona Beauty", body: row.body, site: opts.site });
    const res = await provider.send({ to: row.recipient, subject: row.subject || "Kabar dari Rona Beauty", html, text, idempotencyKey: notificationIdempotencyKey(id) });
    if (res.ok) {
      await db.update(n).set({ status: "terkirim", sentAt: now, attempts: row.attempts + 1, providerId: res.id, lastError: null, claimedAt: null }).where(eq(n.id, id));
      out.sent += 1;
    } else {
      // Error yang tidak bisa dicoba lagi langsung menghabiskan jatah percobaan supaya cron tidak mengulang.
      await db
        .update(n)
        .set({ status: "gagal", attempts: res.retryable ? row.attempts + 1 : Math.max(MAX_EMAIL_ATTEMPTS, row.attempts + 1), lastError: res.error, claimedAt: null })
        .where(eq(n.id, id));
      out.failed += 1;
    }
  }
  return out;
}
