"use client";

import { useSyncExternalStore } from "react";

// prefers-reduced-motion tanpa memuat Motion (Fase 8B), untuk komponen yang animasinya CSS atau scroll.
const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useKurangiGerak() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
