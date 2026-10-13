"use client";

import { useCartCount } from "@/lib/cart/client-cart";

export { useCartCount };

export function CartBadge({ className }: { className?: string }) {
  const count = useCartCount();
  if (count <= 0) return null;
  return (
    <span className={className} aria-label={`${count} item di keranjang`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
