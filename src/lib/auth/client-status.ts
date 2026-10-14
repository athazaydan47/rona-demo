"use client";

// Status akun di header (masuk atau belum, jumlah notifikasi belum dibaca). Diperbarui saat pindah halaman.
import { useSyncExternalStore } from "react";
import { accountStatusAction, type AccountStatus } from "./actions";
import { namaEvent } from "@/config/merek";

const EVENT = namaEvent("akun");
let status: AccountStatus | null = null;
let inflight: Promise<void> | null = null;
let lastAt = 0;

export function refreshAccountStatus(force = false) {
  if (inflight) return inflight;
  if (!force && Date.now() - lastAt < 4000) return Promise.resolve();
  inflight = accountStatusAction()
    .then((s) => {
      status = s;
      lastAt = Date.now();
      window.dispatchEvent(new Event(EVENT));
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(cb: () => void) {
  void refreshAccountStatus();
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useAccountStatus() {
  return useSyncExternalStore(subscribe, () => status, () => null);
}
