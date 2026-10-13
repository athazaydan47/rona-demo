"use client";

import { useCallback, useState, useTransition } from "react";
import { applyVoucherAction, removeItemAction, removeVoucherAction, saveForLaterAction, updateQuantityAction } from "@/lib/cart/actions";
import { setCartCount } from "@/lib/cart/client-cart";
import type { CartView } from "@/lib/cart/service";

// State keranjang di klien; setiap perubahan lewat server action yang mengembalikan tampilan terbaru.
export function useCart(initial: CartView | null) {
  const [view, setView] = useState<CartView | null>(initial);
  const [pending, start] = useTransition();
  const [busyItem, setBusyItem] = useState<number | null>(null);

  const run = useCallback((fn: () => Promise<CartView | null>, itemId: number | null = null) => {
    setBusyItem(itemId);
    start(async () => {
      const next = await fn();
      if (next) {
        setView(next);
        setCartCount(next.count);
      }
      setBusyItem(null);
    });
  }, []);

  return {
    view,
    setView,
    pending,
    busyItem,
    setQuantity: (itemId: number, qty: number) => run(() => updateQuantityAction(itemId, qty), itemId),
    remove: (itemId: number) => run(() => removeItemAction(itemId), itemId),
    saveForLater: (itemId: number, saved: boolean) => run(() => saveForLaterAction(itemId, saved), itemId),
    applyVoucher: (code: string) => run(() => applyVoucherAction(code)),
    removeVoucher: () => run(() => removeVoucherAction()),
  };
}
