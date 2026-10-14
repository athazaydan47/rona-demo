"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

// Tutup bottom sheet dengan usapan ke bawah dari pegangan atau kepala sheet (HP). Elemen mengikuti jari lewat
// transform, lalu kembali dengan pegas CSS bila usapan kurang dari ambang. Tidak aktif saat kurangi gerakan.
export function useSwipeDown(onClose: () => void, threshold = 72) {
  const start = useRef<number | null>(null);
  const el = useRef<HTMLElement | null>(null);
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reset = (animate: boolean) => {
    const n = el.current;
    if (!n) return;
    n.style.transition = animate && !reduce() ? "transform var(--durasi-lambat) var(--ease-pegas)" : "";
    n.style.transform = "";
    window.setTimeout(() => {
      if (n) n.style.transition = "";
    }, 450);
  };
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") return;
      start.current = e.clientY;
      el.current = (e.currentTarget.closest("[data-sheet]") as HTMLElement | null) ?? e.currentTarget;
      el.current.style.transition = "";
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (start.current == null || !el.current) return;
      const dy = Math.max(0, e.clientY - start.current);
      if (!reduce()) el.current.style.transform = `translateY(${dy}px)`;
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      if (start.current == null) return;
      const dy = e.clientY - start.current;
      start.current = null;
      if (dy > threshold) {
        reset(false);
        onClose();
      } else reset(true);
    },
    onPointerCancel: () => {
      start.current = null;
      reset(true);
    },
  };
}
