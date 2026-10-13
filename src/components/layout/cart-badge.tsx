"use client";

import { useSyncExternalStore } from "react";

const KEY = "rona.cart.count";
const EVENT = "rona:cart";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readCount() {
  try {
    const n = Number.parseInt(window.localStorage.getItem(KEY) ?? "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Jumlah item keranjang dari penyimpanan lokal. Fase 4 menggantinya dengan data server.
export function useCartCount() {
  return useSyncExternalStore(subscribe, readCount, () => 0);
}

export function CartBadge({ className }: { className?: string }) {
  const count = useCartCount();
  if (count <= 0) return null;
  return (
    <span className={className} aria-label={`${count} item di keranjang`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
