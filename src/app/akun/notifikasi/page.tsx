import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Inbox } from "@/components/account/inbox";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { listInboxPage, unreadCount } from "@/lib/account/notifications";
import { formatDateWib, formatTimeWib } from "@/lib/format";
import { absoluteLinks } from "@/lib/notifications/links";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Kotak Notifikasi" };

type Props = { searchParams: Promise<{ hal?: string }> };

async function InboxContent({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireCustomer("/akun/notifikasi");
  const r = await listInboxPage(db, me.customerId, Number.parseInt(sp.hal ?? "1", 10) || 1);
  const site = siteUrl();
  return (
    <Inbox
      page={r.page}
      pageCount={r.pageCount}
      total={r.total}
      unreadTotal={await unreadCount(db, me.customerId)}
      rows={r.rows.map((n) => ({ id: n.id, channel: n.channel, subject: n.subject, body: absoluteLinks(n.body, site), timeLabel: formatTimeWib(n.createdAt), dayLabel: formatDateWib(n.createdAt), unread: n.readAt == null, orderNumber: n.orderNumber }))}
    />
  );
}

export default function NotifikasiPage(props: Props) {
  return (
    <>
      <AccountPageHead title="Kotak Notifikasi" description="Pratinjau pesan WhatsApp dan email dari Rona. Di demo ini tidak ada pesan yang benar-benar terkirim." />
      <Suspense fallback={<AccountSkeleton />}>
        <InboxContent {...props} />
      </Suspense>
    </>
  );
}
