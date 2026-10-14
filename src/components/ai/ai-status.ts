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
    void load().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
