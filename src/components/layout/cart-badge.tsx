"use client";

import { useEffect, useRef, useState } from "react";
import { useCartCount } from "@/lib/cart/client-cart";
import { cn } from "@/lib/utils";

export { useCartCount };

// Badge jumlah keranjang; berdenyut sekali saat jumlahnya bertambah (setelah animasi terbang mendarat).
export function CartBadge({ className }: { className?: string }) {
  const count = useCartCount();
  const prev = useRef(count);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (count > prev.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 500);
      prev.current = count;
      return () => window.clearTimeout(t);
    }
    prev.current = count;
  }, [count]);
  if (count <= 0) return null;
  return (
    <span className={cn(className, "transition-transform duration-[var(--durasi-lambat)] ease-[var(--ease-pegas)] motion-reduce:transition-none", pulse && "scale-[1.35]")} aria-label={`${count} item di keranjang`} data-denyut={pulse ? "1" : undefined}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
