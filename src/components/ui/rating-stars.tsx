import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type RatingStarsProps = {
  value: number; // 0 sampai 5
  count?: number; // jumlah ulasan; bila 0 komponen disembunyikan
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  showCount?: boolean;
  force?: boolean; // tampilkan walau count 0 (untuk halaman /design)
  className?: string;
};

const sizeMap = { sm: "size-3.5", md: "size-4", lg: "size-5" };
const textMap = { sm: "text-xs", md: "text-sm", lg: "text-base" };

export function RatingStars({
  value,
  count,
  size = "md",
  showValue = true,
  showCount = true,
  force = false,
  className,
}: RatingStarsProps) {
  if (!force && (!count || count <= 0)) return null;
  const clamped = Math.max(0, Math.min(5, value));
  const label = `${clamped.toFixed(1).replace(".", ",")} dari 5${count ? `, ${count} ulasan` : ""}`;
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} role="img" aria-label={label}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, clamped - (i - 1)));
          return (
            <span key={i} className={cn("relative inline-block", sizeMap[size])}>
              <Star className={cn("absolute inset-0 text-garis", sizeMap[size])} fill="currentColor" strokeWidth={0} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn("text-emas", sizeMap[size])} fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue ? <span className={cn("font-semibold tabular-nums text-kopi", textMap[size])}>{clamped.toFixed(1).replace(".", ",")}</span> : null}
      {showCount && count ? <span className={cn("text-abu-hangat tabular-nums", textMap[size])}>({count})</span> : null}
    </div>
  );
}
