"use client";

import { useSyncExternalStore } from "react";

const KEY = "rona.wishlist";
const EVENT = "rona:wishlist";

export function readWishlist(): number[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function toggleWishlist(productId: number) {
  const list = readWishlist();
  const next = list.includes(productId) ? list.filter((id) => id !== productId) : [...list, productId];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // abaikan
  }
  window.dispatchEvent(new Event(EVENT));
  return next.includes(productId);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

let cache: { raw: string; list: number[] } = { raw: "", list: [] };
function snapshot() {
  let raw = "";
  try {
    raw = window.localStorage.getItem(KEY) ?? "";
  } catch {
    raw = "";
  }
  if (raw !== cache.raw) cache = { raw, list: readWishlist() };
  return cache.list;
}
const empty: number[] = [];

export function useWishlist() {
  return useSyncExternalStore(subscribe, snapshot, () => empty);
}
