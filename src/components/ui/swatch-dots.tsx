import { cn } from "@/lib/utils";

type SwatchDotsProps = {
  hexes: string[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

// Titik warna shade di kartu produk: maksimal 5, sisanya "+7".
export function SwatchDots({ hexes, max = 5, size = "sm", className }: SwatchDotsProps) {
  if (hexes.length <= 1) return null;
  const shown = hexes.slice(0, max);
  const rest = hexes.length - shown.length;
  const dot = size === "sm" ? "size-3.5" : "size-5";
  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={`${hexes.length} shade`}>
      {shown.map((hex, i) => (
        <span
          key={`${hex}-${i}`}
          className={cn(dot, "rounded-full border border-kopi/10 shadow-[inset_0_-1px_2px_rgb(0_0_0/0.12)]")}
          style={{ backgroundColor: hex }}
        />
      ))}
      {rest > 0 ? <span className="ml-0.5 text-xs text-abu-hangat tabular-nums">+{rest}</span> : null}
    </div>
  );
}
