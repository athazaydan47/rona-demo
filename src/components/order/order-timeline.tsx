import { Check, Circle, X } from "lucide-react";
import { formatDateTimeWib } from "@/lib/format";
import { expectedFlow, statusLabels, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

type Props = {
  method: "kirim" | "ambil";
  status: OrderStatus;
  history: { toStatus: string; actor: string; reason: string | null; at: Date }[];
};

// Lini masa: langkah yang sudah terjadi (dari riwayat) lalu langkah yang masih akan datang.
export function OrderTimeline({ method, status, history }: Props) {
  const done = new Map(history.map((h) => [h.toStatus, h]));
  const flow = expectedFlow(method);
  const cancelled = status === "dibatalkan" || status === "diretur";
  const steps: { status: OrderStatus; at?: Date; actor?: string; reason?: string | null; state: "done" | "current" | "next" | "cancel" }[] = [];
  for (const s of flow) {
    const h = done.get(s);
    if (h) steps.push({ status: s, at: h.at, actor: h.actor, reason: h.reason, state: s === status ? "current" : "done" });
    else if (!cancelled) steps.push({ status: s, state: "next" });
  }
  if (cancelled) {
    const h = done.get(status);
    steps.push({ status, at: h?.at, actor: h?.actor, reason: h?.reason, state: "cancel" });
  }
  return (
    <ol className="relative space-y-0" aria-label="Lini masa pesanan">
      {steps.map((s, i) => (
        <li key={`${s.status}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 ? <span className={cn("absolute top-7 left-[13px] h-[calc(100%-24px)] w-0.5", s.state === "next" ? "bg-garis" : "bg-sukses/50")} aria-hidden /> : null}
          <span
            className={cn(
              "relative z-10 grid size-7 shrink-0 place-items-center rounded-full",
              s.state === "done" && "bg-sukses text-putih",
              s.state === "current" && "bg-kopi text-putih ring-4 ring-blush",
              s.state === "next" && "border-2 border-garis bg-putih text-garis",
              s.state === "cancel" && "bg-bahaya text-putih",
            )}
          >
            {s.state === "cancel" ? <X className="size-3.5" /> : s.state === "next" ? <Circle className="size-2.5" /> : <Check className="size-3.5" />}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-sm font-semibold", s.state === "next" ? "text-abu-hangat" : "text-kopi")}>{statusLabels[s.status]}</p>
            {s.at ? (
              <p className="text-xs text-abu-hangat">
                {formatDateTimeWib(s.at)}
                {s.actor ? ` · oleh ${s.actor}` : ""}
              </p>
            ) : null}
            {s.reason ? <p className="text-xs text-abu-hangat">{s.reason}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
