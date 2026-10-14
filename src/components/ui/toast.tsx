"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastInput = { title: string; description?: string; tone?: "sukses" | "info"; duration?: number };
type Toast = ToastInput & { id: number };

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: ToastInput) {
  const id = ++seq;
  const t: Toast = { tone: "sukses", duration: 2800, ...input, id };
  toasts = [...toasts, t].slice(-3);
  emit();
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Animasi masuk dan keluar dengan CSS (Fase 8B): Toaster ada di setiap halaman, jadi tidak memuat Motion.
function ToastItem({ t }: { t: Toast }) {
  const [keluar, setKeluar] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setKeluar(true), t.duration);
    return () => window.clearTimeout(timer);
  }, [t.id, t.duration]);
  useEffect(() => {
    if (!keluar) return;
    const timer = window.setTimeout(() => dismissToast(t.id), 180);
    return () => window.clearTimeout(timer);
  }, [keluar, t.id]);
  const Icon = t.tone === "info" ? Info : CheckCircle2;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-garis bg-putih p-3.5 pr-2 shadow-lift transition-[opacity,transform] duration-[180ms] ease-[var(--ease-soft)] animate-muncul",
        keluar && "translate-y-2 opacity-0",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", t.tone === "info" ? "text-aksen" : "text-sukses")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-kopi">{t.title}</p>
        {t.description ? <p className="mt-0.5 text-xs text-abu-hangat">{t.description}</p> : null}
      </div>
      <button type="button" onClick={() => setKeluar(true)} className="grid size-8 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup notifikasi">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end" aria-live="polite">
      {list.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
