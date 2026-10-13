"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronDown, ChevronUp, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllReadAction, markReadAction } from "@/lib/account/actions";
import { refreshAccountStatus } from "@/lib/auth/client-status";
import { cn } from "@/lib/utils";

export type InboxRow = { id: number; channel: "wa" | "email"; subject: string; body: string; timeLabel: string; dayLabel: string; unread: boolean; orderNumber: string | null };

const LONG = 160;

// Pratinjau beberapa baris; pesan panjang bisa dibuka dan ditutup.
function Body({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG || text.split("\n").length > 3;
  return (
    <div>
      <p className={cn("text-sm break-words whitespace-pre-line text-kopi", long && !open && "line-clamp-3")}>{text}</p>
      {long ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          aria-expanded={open}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rona hover:underline"
        >
          {open ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />} {open ? "Tutup" : "Buka pesan"}
        </button>
      ) : null}
    </div>
  );
}

function Item({ n, onOpen }: { n: InboxRow; onOpen: (id: number) => void }) {
  const marker = n.unread ? <span className="absolute top-3 -left-1.5 size-2.5 rounded-full bg-rona" aria-label="Belum dibaca" /> : null;
  if (n.channel === "wa") {
    return (
      <li className="relative pl-3" data-testid="notif" data-unread={n.unread ? "ya" : "tidak"} onClick={() => n.unread && onOpen(n.id)}>
        {marker}
        <div className="max-w-[min(100%,34rem)] rounded-2xl rounded-tl-sm bg-[#E3F1DD] px-4 py-2.5 shadow-[0_1px_1px_rgb(42_31_29/0.08)]">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#3C6B35]">
            <MessageCircle className="size-3.5" aria-hidden /> WhatsApp · Rona Beauty
          </p>
          <Body text={n.body} />
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-abu-hangat">
            {n.timeLabel} <CheckCheck className="size-3.5 text-[#4A90C2]" aria-hidden />
          </p>
        </div>
        {n.orderNumber ? (
          <Link href={`/pesanan/${n.orderNumber}`} className="mt-1 inline-block text-xs font-semibold text-rona hover:underline">
            Lihat pesanan {n.orderNumber}
          </Link>
        ) : null}
      </li>
    );
  }
  return (
    <li className="relative pl-3" data-testid="notif" data-unread={n.unread ? "ya" : "tidak"} onClick={() => n.unread && onOpen(n.id)}>
      {marker}
      <div className="max-w-[min(100%,34rem)] overflow-hidden rounded-card border border-garis bg-putih">
        <div className="flex items-center gap-2 border-b border-garis bg-porselen px-4 py-2 text-xs text-abu-hangat">
          <Mail className="size-3.5 text-rona" aria-hidden /> Email dari halo@rona.demo · {n.timeLabel}
        </div>
        <div className="px-4 py-3">
          <p className={cn("text-sm text-kopi", n.unread && "font-semibold")}>{n.subject || "Kabar dari Rona"}</p>
          <div className="mt-1">
            <Body text={n.body} />
          </div>
        </div>
      </div>
    </li>
  );
}

export function Inbox({ rows, page = 1, pageCount = 1, total, unreadTotal }: { rows: InboxRow[]; page?: number; pageCount?: number; total?: number; unreadTotal?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = unreadTotal ?? rows.filter((r) => r.unread).length;
  const days: { day: string; items: InboxRow[] }[] = [];
  for (const r of rows) {
    const last = days[days.length - 1];
    if (last && last.day === r.dayLabel) last.items.push(r);
    else days.push({ day: r.dayLabel, items: [r] });
  }
  const after = () => {
    void refreshAccountStatus(true);
    router.refresh();
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-abu-hangat" role="status">
          {unread ? `${unread} pesan belum dibaca` : "Semua pesan sudah dibaca"}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || unread === 0}
          onClick={() =>
            start(async () => {
              await markAllReadAction();
              after();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Tandai semua dibaca
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-garis bg-putih p-6 text-sm text-abu-hangat">Belum ada pesan. Kabar pesanan, kode masuk, dan info stok akan muncul di sini.</p>
      ) : (
        <div className="space-y-6 rounded-card bg-[#F4EEE6] p-4 md:p-6">
          {days.map((d) => (
            <section key={d.day} aria-label={d.day}>
              <p className="mx-auto mb-3 w-fit rounded-pill bg-putih/80 px-3 py-1 text-[11px] font-semibold text-abu-hangat">{d.day}</p>
              <ul className="space-y-3">
                {d.items.map((n) => (
                  <Item
                    key={n.id}
                    n={n}
                    onOpen={(id) =>
                      start(async () => {
                        await markReadAction(id);
                        after();
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {pageCount > 1 ? (
        <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Halaman notifikasi">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/akun/notifikasi${page - 1 > 1 ? `?hal=${page - 1}` : ""}`}>Lebih baru</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-abu-hangat tabular-nums">
            Halaman {page} dari {pageCount}
            {total != null ? ` · ${total} pesan` : ""}
          </span>
          {page < pageCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/akun/notifikasi?hal=${page + 1}`}>Lebih lama</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
