import { formatRupiah } from "@/lib/format";
import { discountPercent } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type PriceTagProps = {
  price: number;
  normalPrice?: number;
  size?: "sm" | "md" | "lg";
  prefix?: string; // misalnya "Mulai"
  className?: string;
};

const sizes = {
  sm: { price: "text-sm", normal: "text-xs", badge: "text-[11px] px-1.5" },
  md: { price: "text-base", normal: "text-sm", badge: "text-xs px-2" },
  lg: { price: "text-2xl", normal: "text-base", badge: "text-sm px-2" },
};

export function PriceTag({ price, normalPrice, size = "md", prefix, className }: PriceTagProps) {
  const percent = normalPrice ? discountPercent(normalPrice, price) : 0;
  const s = sizes[size];
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums", className)}>
      {prefix ? <span className={cn("text-abu-hangat", s.normal)}>{prefix}</span> : null}
      <span className={cn("font-semibold text-kopi", s.price)}>{formatRupiah(price)}</span>
      {percent > 0 && normalPrice ? (
        <>
          <s className={cn("text-abu-hangat decoration-abu-hangat/60", s.normal)}>{formatRupiah(normalPrice)}</s>
          <span className={cn("rounded-md bg-blush py-0.5 font-semibold text-rona-gelap", s.badge)}>{percent}%</span>
        </>
      ) : null}
    </div>
  );
}
