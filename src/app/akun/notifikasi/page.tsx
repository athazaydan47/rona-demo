import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Inbox } from "@/components/account/inbox";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { listInbox } from "@/lib/account/notifications";
import { formatDateWib, formatTimeWib } from "@/lib/format";

export const metadata: Metadata = { title: "Kotak Notifikasi" };

async function InboxContent() {
  await connection();
  const me = await requireCustomer("/akun/notifikasi");
  const rows = await listInbox(db, me.customerId, 60);
  return <Inbox rows={rows.map((r) => ({ id: r.id, channel: r.channel, subject: r.subject, body: r.body, timeLabel: formatTimeWib(r.createdAt), dayLabel: formatDateWib(r.createdAt), unread: r.readAt == null, orderNumber: r.orderNumber }))} />;
}

export default function NotifikasiPage() {
  return (
    <>
      <AccountPageHead title="Kotak Notifikasi" description="Pratinjau pesan WhatsApp dan email dari Rona. Di demo ini tidak ada pesan yang benar-benar terkirim." />
      <Suspense fallback={<AccountSkeleton />}>
        <InboxContent />
      </Suspense>
    </>
  );
}
