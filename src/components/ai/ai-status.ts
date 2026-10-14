"use client";

import { useEffect, useState } from "react";

export type AiStatus = { tersedia: boolean; istirahat: boolean; pesanIstirahat?: string; profil: boolean };
const OFF: AiStatus = { tersedia: false, istirahat: false, profil: false };

// Status AI dibaca sekali per muat halaman dan dibagi ke semua komponen (tombol Advisor, ikon video di kolom cari,
// tombol tanya di halaman produk). Dicek saat jalan, bukan saat build, supaya env AI kosong langsung menyembunyikan UI.
let pending: Promise<AiStatus> | null = null;
function load(): Promise<AiStatus> {
  pending ??= fetch("/api/ai/advisor", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<AiStatus>) : OFF))
    .catch(() => OFF);
  return pending;
}

export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>(OFF);
  useEffect(() => {
    let alive = true;
    // Ditunda sampai browser senggang (Fase 8B) supaya tidak bersaing dengan muatan awal halaman.
    const jalankan = () =>
      void load().then((s) => {
        if (alive) setStatus(s);
      });
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(jalankan, { timeout: 2000 }) : null;
    const timer = idle == null ? window.setTimeout(jalankan, 300) : null;
    return () => {
      alive = false;
      if (idle != null) window.cancelIdleCallback(idle);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);
  return status;
}
