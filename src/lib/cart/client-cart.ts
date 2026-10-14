"use client";

// Jembatan klien ke keranjang server: jumlah item untuk badge, tambah ke keranjang, buka laci.
import { useSyncExternalStore } from "react";
import { addToCartAction, cartCountAction, importLocalCartAction } from "./actions";

const COUNT_EVENT = "rona:cart";
export const OPEN_EVENT = "rona:cart-open";
const LEGACY_KEY = "rona.cart";
const LEGACY_COUNT_KEY = "rona.cart.count";

let count = 0;

export function setCartCount(n: number) {
  count = Math.max(0, Math.trunc(n));
  window.dispatchEvent(new Event(COUNT_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(COUNT_EVENT, cb);
  return () => window.removeEventListener(COUNT_EVENT, cb);
}

export function useCartCount() {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}

export function openCartDrawer() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export type AddResult = { ok: boolean; message?: string };

export async function addToCart(variantId: number, quantity = 1, opts: { openDrawer?: boolean; source?: string } = {}): Promise<AddResult> {
  return addManyToCart([{ variantId, quantity }], opts);
}

// source: asal item untuk atribusi penjualan ("advisor", "rutinitas", "padanan_shade").
export async function addManyToCart(items: { variantId: number; quantity: number }[], opts: { openDrawer?: boolean; source?: string } = {}): Promise<AddResult> {
  try {
    const r = await addToCartAction(items, { source: opts.source });
    setCartCount(r.count);
    if (r.ok && opts.openDrawer !== false) openCartDrawer();
    return { ok: r.ok, message: r.message };
  } catch {
    return { ok: false, message: "Gagal menambah ke keranjang. Coba lagi." };
  }
}

let synced = false;

// Dipanggil sekali saat aplikasi dimuat: pindahkan keranjang lokal lama ke server lalu ambil jumlah item.
export async function syncCart() {
  if (synced) return;
  synced = true;
  let legacy: { variantId: number; quantity: number }[] = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) legacy = parsed.filter((i) => i && Number.isInteger(i.variantId) && Number.isInteger(i.quantity) && i.quantity > 0).map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
  } catch {
    legacy = [];
  }
  try {
    const n = legacy.length ? await importLocalCartAction(legacy) : await cartCountAction();
    if (legacy.length) {
      try {
        window.localStorage.removeItem(LEGACY_KEY);
        window.localStorage.removeItem(LEGACY_COUNT_KEY);
      } catch {
        // abaikan
      }
    }
    setCartCount(n);
  } catch {
    synced = false;
  }
}
