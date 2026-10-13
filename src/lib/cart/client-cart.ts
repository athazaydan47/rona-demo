"use client";

// Keranjang sisi klien untuk Fase 2 dan 3: hanya menyimpan variantId dan jumlah di localStorage.
// Fase 4 memindahkannya ke server; antarmukanya (addToCart, useCartCount) dipertahankan.
import { useSyncExternalStore } from "react";

export type ClientCartItem = { variantId: number; quantity: number; addedAt: string };

const KEY = "rona.cart";
const COUNT_KEY = "rona.cart.count";
const EVENT = "rona:cart";

export function readCart(): ClientCartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as ClientCartItem[]).filter((i) => typeof i?.variantId === "number" && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeCart(items: ClientCartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.localStorage.setItem(COUNT_KEY, String(items.reduce((n, i) => n + i.quantity, 0)));
  } catch {
    // penyimpanan diblokir: badge tetap berubah lewat event di bawah
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(variantId: number, quantity = 1) {
  const items = readCart();
  const existing = items.find((i) => i.variantId === variantId);
  if (existing) existing.quantity += quantity;
  else items.push({ variantId, quantity, addedAt: new Date().toISOString() });
  writeCart(items);
  return items;
}

export function cartCount() {
  return readCart().reduce((n, i) => n + i.quantity, 0);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCartCount() {
  return useSyncExternalStore(subscribe, cartCount, () => 0);
}
