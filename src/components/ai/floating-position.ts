"use client";

import { useEffect, useState, type RefObject } from "react";

// Aturan global tombol melayang (Tanya Rona):
// 1. Selalu naik di atas bilah bawah yang menempel. Bilah ditandai atribut data-bilah-bawah (menu bawah, bilah beli
//    di HP, bilah Tambah semua di rutinitas). Tinggi bilah diukur langsung, jadi bilah baru cukup diberi atribut.
// 2. Tidak pernah menutupi tombol aksi utama (atribut data-aksi-utama) yang ikut bergulir di halaman: selama
//    bertumpuk, tombol melayang disembunyikan sementara dan muncul lagi setelah halaman digulir.
export const FLOAT_GAP = 12;

type Rect = { top: number; bottom: number; left: number; right: number };
const overlaps = (a: Rect, b: Rect, pad = 4) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return null;
  return r;
}

export function useFloatingPosition(ref: RefObject<HTMLElement | null>, enabled: boolean, baseBottom: { mobile: number; desktop: number }) {
  const [pos, setPos] = useState<{ bottom: number; covered: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const own = el.getBoundingClientRect();
      let bottom = window.innerWidth >= 768 ? baseBottom.desktop : baseBottom.mobile;
      const bars = [...document.querySelectorAll<HTMLElement>("[data-bilah-bawah]")];
      for (const bar of bars) {
        // Bilah yang sedang disembunyikan (misal bilah beli sebelum tombol utama terlewati) tidak dihitung.
        if (bar.getAttribute("aria-hidden") === "true") continue;
        const r = visible(bar);
        // Hanya bilah yang menempel di bagian bawah layar dan sejajar dengan kolom tombol.
        if (!r || r.top >= vh || r.bottom < vh - 160) continue;
        if (r.right < own.left - 4 || r.left > own.right + 4) continue;
        bottom = Math.max(bottom, Math.ceil(vh - r.top + FLOAT_GAP));
      }
      const next: Rect = { left: own.left, right: own.right, bottom: vh - bottom, top: vh - bottom - own.height };
      const covered = [...document.querySelectorAll<HTMLElement>("[data-aksi-utama]")].some((a) => {
        if (a.closest("[data-bilah-bawah]")) return false;
        const r = visible(a);
        return Boolean(r && r.bottom > 0 && r.top < vh && overlaps(r, next));
      });
      setPos((p) => (p && p.bottom === bottom && p.covered === covered ? p : { bottom, covered }));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("transitionend", schedule, true);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    // Bilah yang muncul dengan animasi atau data yang tiba belakangan: ukur ulang berkala dengan ringan.
    const timer = window.setInterval(schedule, 500);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("transitionend", schedule, true);
      mo.disconnect();
      ro.disconnect();
      window.clearInterval(timer);
    };
  }, [ref, enabled, baseBottom.mobile, baseBottom.desktop]);
  return pos;
}

// Tombol melayang menyingkir saat halaman digulir ke bawah (membaca) dan muncul lagi saat digulir ke atas.
export function useHideOnScroll(enabled: boolean, threshold = 120) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) < 8) return;
        setHidden(delta > 0 && y > threshold);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, threshold]);
  return enabled && hidden;
}
