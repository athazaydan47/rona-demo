"use client";

// Wishlist hibrida: tersimpan di perangkat (localStorage) selama belum masuk, dan di server setelah masuk.
// Saat masuk, daftar perangkat digabung ke akun lalu dihapus dari perangkat.
import { useSyncExternalStore } from "react";
import { setWishlistAction, wishlistStateAction } from "@/lib/account/actions";

const KEY = "rona.wishlist";
const EVENT = "rona:wishlist";

export function readLocalWishlist(): number[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeLocal(list: number[]) {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
  } catch {
    // abaikan
  }
}

export function clearLocalWishlist() {
  writeLocal([]);
}

type State = { mode: "memuat" | "lokal" | "akun"; ids: number[] };
let state: State = { mode: "memuat", ids: [] };
let loading: Promise<void> | null = null;

function emit(next: State) {
  state = next;
  window.dispatchEvent(new Event(EVENT));
}

function load() {
  if (loading) return loading;
  loading = wishlistStateAction()
    .then((r) => emit(r.loggedIn ? { mode: "akun", ids: r.ids } : { mode: "lokal", ids: readLocalWishlist() }))
    .catch(() => emit({ mode: "lokal", ids: readLocalWishlist() }));
  return loading;
}

function subscribe(cb: () => void) {
  void load();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && state.mode === "lokal") emit({ mode: "lokal", ids: readLocalWishlist() });
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

const empty: number[] = [];

export function useWishlist() {
  return useSyncExternalStore(subscribe, () => state.ids, () => empty);
}

export function useWishlistMode() {
  return useSyncExternalStore(subscribe, () => state.mode, () => "memuat" as const);
}

// Mengembalikan status baru dan di mana tersimpan.
export async function toggleWishlist(productId: number): Promise<{ wished: boolean; mode: "lokal" | "akun"; message?: string }> {
  await load();
  const on = !state.ids.includes(productId);
  if (state.mode === "akun") {
    const prev = state.ids;
    emit({ mode: "akun", ids: on ? [productId, ...prev] : prev.filter((id) => id !== productId) });
    const r = await setWishlistAction(productId, on).catch(() => ({ ok: false, wished: !on, message: "Gagal menyimpan. Coba lagi." }));
    if (!r.ok) {
      emit({ mode: "akun", ids: prev });
      return { wished: !on, mode: "akun", message: r.message };
    }
    return { wished: r.wished, mode: "akun" };
  }
  const next = on ? [...readLocalWishlist().filter((id) => id !== productId), productId] : readLocalWishlist().filter((id) => id !== productId);
  writeLocal(next);
  emit({ mode: "lokal", ids: next });
  return { wished: on, mode: "lokal" };
}
