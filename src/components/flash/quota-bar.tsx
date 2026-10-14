import { quotaLeft, quotaUsedPercent } from "@/lib/flash";
import { cn } from "@/lib/utils";

export function QuotaBar({ quota, sold, className, size = "sm" }: { quota: number; sold: number; className?: string; size?: "sm" | "md" }) {
  const left = quotaLeft({ quota, sold });
  const used = quotaUsedPercent({ quota, sold });
  const label = left === 0 ? "Habis" : `Sisa ${left}`;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("relative flex-1 overflow-hidden rounded-pill bg-blush", size === "sm" ? "h-2" : "h-2.5")} role="progressbar" aria-valuemin={0} aria-valuemax={quota} aria-valuenow={sold} aria-label={`Terjual ${sold} dari ${quota}`}>
        <div className={cn("h-full rounded-pill transition-[width] duration-[var(--durasi-lambat)] ease-[var(--ease-soft)]", used >= 85 ? "bg-bahaya" : "bg-aksen")} style={{ width: `${Math.max(4, used)}%` }} />
      </div>
      <span className={cn("shrink-0 font-semibold tabular-nums", size === "sm" ? "text-xs" : "text-sm", left === 0 ? "text-bahaya" : left <= 5 ? "text-peringatan-teks" : "text-kopi")}>{label}</span>
    </div>
  );
}
