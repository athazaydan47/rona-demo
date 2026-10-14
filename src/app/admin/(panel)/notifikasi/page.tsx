import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { OutboxList } from "@/components/admin/outbox-list";
import { Denied, fieldClass, PageHead, Pager, Skeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { listOutbox, OUTBOX_STATUS_LABELS } from "@/lib/admin/outbox";
import { can } from "@/lib/admin/permissions";
import { emailConfig, emailReady } from "@/lib/email";
import { formatDateTimeWib, formatNumber, wibDate } from "@/lib/format";
import { absoluteLinks } from "@/lib/notifications/links";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Notifikasi keluar" };

type SP = { kanal?: string; status?: string; dari?: string; sampai?: string; hal?: string };
const parseDay = (v?: string) => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? wibDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const me = await requireStaff("/admin/notifikasi");
  if (!can(me, "pengaturan.kelola")) return <Denied />;
  const sp = await searchParams;
  const to = parseDay(sp.sampai);
  const channel = sp.kanal === "wa" || sp.kanal === "email" ? sp.kanal : null;
  const status = sp.status && sp.status in OUTBOX_STATUS_LABELS ? (sp.status as "antre" | "terkirim" | "gagal" | "dilewati") : null;
  const r = await listOutbox(db, { channel, status, from: parseDay(sp.dari), to: to ? new Date(to.getTime() + 86_400_000) : null, page: Number.parseInt(sp.hal ?? "1", 10) || 1 });
  const cfg = emailConfig();
  const href = (p: number) => `/admin/notifikasi?${new URLSearchParams(Object.entries({ ...sp, hal: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  const emailCount = (s: string) => r.byStatus.filter((b) => b.channel === "email" && b.status === s).reduce((t, b) => t + b.c, 0);
  return (
    <>
      <div className="mb-4 rounded-xl border border-garis bg-putih p-3 text-sm" data-testid="mode-email">
        {emailReady(cfg) ? (
          <p>
            Email dikirim lewat <strong>Resend</strong> dari {cfg.from}.{" "}
            {cfg.demoMode ? (cfg.allowlist.length ? `Mode demo: hanya ke ${cfg.allowlist.length} alamat di EMAIL_ALLOWLIST, alamat lain ditandai Dilewati.` : "Mode demo tanpa EMAIL_ALLOWLIST: semua email ditandai Dilewati.") : "Semua alamat dikirimi."}
          </p>
        ) : (
          <p>Mode pratinjau: email tidak dikirim ke mana pun dan berstatus Pratinjau, sama seperti WhatsApp. Isi EMAIL_PROVIDER=resend, RESEND_API_KEY, dan EMAIL_FROM untuk mengirim sungguhan.</p>
        )}
        <p className="mt-1 text-xs text-abu-hangat">
          Email: {formatNumber(emailCount("antre"))} {emailReady(cfg) ? "menunggu" : "pratinjau"}, {formatNumber(emailCount("terkirim"))} terkirim, {formatNumber(emailCount("gagal"))} gagal, {formatNumber(emailCount("dilewati"))} dilewati. WhatsApp selalu pratinjau di Kotak Notifikasi pembeli.
        </p>
      </div>
      <form method="get" className="mb-3 grid gap-2 rounded-xl border border-garis bg-putih p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]" aria-label="Filter notifikasi">
        <select name="kanal" defaultValue={channel ?? ""} className={fieldClass} aria-label="Kanal">
          <option value="">Semua kanal</option>
          <option value="email">Email</option>
          <option value="wa">WhatsApp</option>
        </select>
        <select name="status" defaultValue={status ?? ""} className={fieldClass} aria-label="Status">
          <option value="">Semua status</option>
          {Object.entries(OUTBOX_STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input type="date" name="dari" defaultValue={sp.dari ?? ""} className={fieldClass} aria-label="Dari tanggal" />
        <input type="date" name="sampai" defaultValue={sp.sampai ?? ""} className={fieldClass} aria-label="Sampai tanggal" />
        <Button type="submit" size="sm">
          Terapkan
        </Button>
      </form>
      <p className="mb-2 text-sm text-abu-hangat">{formatNumber(r.total)} notifikasi</p>
      <OutboxList
        rows={r.rows.map((n) => ({ id: n.id, channel: n.channel, kind: n.kind, recipient: n.recipient, subject: n.subject, body: absoluteLinks(n.body, siteUrl()), status: n.status, preview: n.channel === "wa" || (!emailReady(cfg) && n.status === "antre"), statusLabel: OUTBOX_STATUS_LABELS[n.status] ?? n.status, attempts: n.attempts, lastError: n.lastError, createdLabel: formatDateTimeWib(n.createdAt), sentLabel: n.sentAt && n.channel === "email" ? formatDateTimeWib(n.sentAt) : null }))}
      />
      <Pager page={r.page} pageCount={r.pageCount} href={href} />
    </>
  );
}

export default function OutboxPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <PageHead title="Notifikasi keluar" description="Semua pesan WhatsApp dan email yang dibuat sistem, dengan status pengirimannya." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
