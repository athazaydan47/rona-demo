"use server";

import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { getStoreSettings } from "@/lib/settings/load";
import { now } from "@/lib/clock";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";
import { resolveCart as currentCart } from "./current";
import { addItems, cartCount, importItems, removeItem, setCartVoucher, setItemQuantity, setItemSaved, viewCart, type CartView } from "./service";

async function freshView(cartId: number): Promise<CartView> {
  await ensureFlashSaleSlots(db);
  const customer = await currentCustomer();
  return viewCart(db, cartId, { now: now(), buyer: customer ? { customerId: customer.customerId, phone: customer.phone } : undefined, settings: await getStoreSettings() });
}

export type AddToCartResponse = { ok: boolean; count: number; message?: string };

const isItems = (items: unknown): items is { variantId: number; quantity: number }[] =>
  Array.isArray(items) && items.length <= 50 && items.every((i) => i && Number.isInteger(i.variantId) && Number.isInteger(i.quantity));

// Sumber item yang diakui (atribusi penjualan). Nilai lain dari browser diabaikan.
const SOURCES = ["advisor", "rutinitas", "padanan_shade", "cari_video"] as const;

export async function addToCartAction(items: { variantId: number; quantity: number }[], opts: { source?: string } = {}): Promise<AddToCartResponse> {
  if (!isItems(items)) return { ok: false, count: 0, message: "Data tidak valid." };
  const cart = await currentCart(true);
  const source = SOURCES.find((s) => s === opts?.source) ?? null;
  const r = await addItems(db, cart!.id, items, { source });
  return { ok: r.ok, count: await cartCount(db, cart!.id), message: r.message };
}

export async function cartCountAction(): Promise<number> {
  const cart = await currentCart(false);
  return cart ? cartCount(db, cart.id) : 0;
}

export async function getCartViewAction(): Promise<CartView | null> {
  const cart = await currentCart(false);
  return cart ? freshView(cart.id) : null;
}

export async function updateQuantityAction(itemId: number, quantity: number): Promise<CartView | null> {
  const cart = await currentCart(false);
  if (!cart || !Number.isInteger(itemId) || !Number.isFinite(quantity)) return null;
  await setItemQuantity(db, cart.id, itemId, quantity);
  return freshView(cart.id);
}

export async function removeItemAction(itemId: number): Promise<CartView | null> {
  const cart = await currentCart(false);
  if (!cart || !Number.isInteger(itemId)) return null;
  await removeItem(db, cart.id, itemId);
  return freshView(cart.id);
}

export async function saveForLaterAction(itemId: number, saved: boolean): Promise<CartView | null> {
  const cart = await currentCart(false);
  if (!cart || !Number.isInteger(itemId)) return null;
  await setItemSaved(db, cart.id, itemId, Boolean(saved));
  return freshView(cart.id);
}

export async function applyVoucherAction(code: string): Promise<CartView | null> {
  const cart = await currentCart(true);
  const clean = String(code ?? "").trim();
  await setCartVoucher(db, cart!.id, clean || null);
  return freshView(cart!.id);
}

export async function removeVoucherAction(): Promise<CartView | null> {
  const cart = await currentCart(false);
  if (!cart) return null;
  await setCartVoucher(db, cart.id, null);
  return freshView(cart.id);
}

// Pindahkan keranjang localStorage dari Fase 2 ke server, satu kali.
export async function importLocalCartAction(items: { variantId: number; quantity: number }[]): Promise<number> {
  if (!isItems(items) || items.length === 0) return cartCountAction();
  const cart = await currentCart(true);
  await importItems(db, cart!.id, items);
  return cartCount(db, cart!.id);
}
