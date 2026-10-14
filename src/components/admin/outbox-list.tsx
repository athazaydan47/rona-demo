"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resendNotificationAction } from "@/lib/admin/moderation-actions";
import { cn } from "@/lib/utils";

export type OutboxRow = { id: number; channel: "wa" | "email"; kind: string; recipient: string; subject: string; body: string; status: string; statusLabel: string; attempts: number; lastError: string | null; createdLabel: string; sentLabel: string | null };

const TONE: Record<string, "sukses" | "netral" | "habis" | "menipis"> = { terkirim: "sukses", antre: "netral", gagal: "habis", dilewati: "menipis" };

export function OutboxList({ rows }: { rows: OutboxRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [, run] = useTransition();
  return (
    <div className="space-y-2">
      {notice ? (
        <p className={cn("rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      ) : null}
      <ul className="divide-y divide-garis rounded-xl border border-garis bg-putih" data-testid="daftar-outbox">
        {rows.map((r) => (
          <li key={r.id} className="p-3">
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-12 shrink-0 text-xs font-semibold text-abu-hangat uppercase">{r.channel}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.subject || "(tanpa judul)"}</p>
                <p className="truncate text-xs text-abu-hangat">
                  {r.recipient} · {r.kind || "umum"} · {r.createdLabel}
                  {r.sentLabel ? ` · terkirim ${r.sentLabel}` : ""}
                </p>
                {r.lastError ? <p className="mt-0.5 text-xs text-bahaya">Error terakhir: {r.lastError}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={r.channel === "wa" ? "netral" : (TONE[r.status] ?? "netral")}>{r.channel === "wa" ? "Pratinjau" : r.statusLabel}</Badge>
                {r.channel === "email" ? <span className="text-[11px] text-abu-hangat tabular-nums">{r.attempts}x</span> : null}
                {r.channel === "email" && (r.status === "gagal" || r.status === "dilewati") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() =>
                      run(async () => {
                        setBusy(r.id);
                        const res = await resendNotificationAction(r.id);
                        setBusy(null);
                        setNotice(res.ok ? { ok: true, text: "Email terkirim ulang." } : { ok: false, text: res.message });
                        router.refresh();
                      })
                    }
                  >
                    {busy === r.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Kirim ulang
                  </Button>
                ) : null}
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-expanded={open === r.id} aria-label={`Pratinjau isi ${r.subject}`}>
                  <ChevronDown className={cn("size-4 transition-transform", open === r.id && "rotate-180")} />
                </button>
              </div>
            </div>
            {open === r.id ? <pre className="mt-2 ml-14 rounded-lg bg-porselen p-3 text-xs whitespace-pre-wrap text-kopi" data-testid="pratinjau-outbox">{r.body}</pre> : null}
          </li>
        ))}
        {!rows.length ? <li className="p-8 text-center text-sm text-abu-hangat">Tidak ada notifikasi yang cocok.</li> : null}
      </ul>
    </div>
  );
}
