// Token gerak toko (Fase 8A). Satu sumber untuk Motion dan CSS (lihat globals.css: --durasi-* dan --ease-*).
// Durasi: cepat untuk umpan balik sentuhan (hover, tekan, badge), sedang untuk pergantian isi (crossfade, kartu masuk),
// lambat untuk elemen besar (laci, sheet, angka naik). Pegas "tenang" tidak memantul; "kenyal" memantul sedikit.
import type { Transition } from "motion/react";

export const DURASI = { cepat: 0.15, sedang: 0.25, lambat: 0.4 } as const; // detik
export const EASE_LEMBUT = [0.22, 1, 0.36, 1] as const;
export const PEGAS = {
  tenang: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } satisfies Transition,
  kenyal: { type: "spring", stiffness: 420, damping: 22, mass: 0.8 } satisfies Transition,
} as const;

export const lembut = (durasi: number = DURASI.sedang, delay = 0): Transition => ({ duration: durasi, ease: [...EASE_LEMBUT], delay });

// Jeda bertahap untuk daftar kartu: maksimal 8 langkah supaya halaman panjang tidak terasa lambat.
export const bertahap = (index: number, langkah = 0.04, maks = 8) => Math.min(index, maks) * langkah;

export const reduksiGerak = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
