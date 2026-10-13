"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

function ToastItem({ t }: { t: Toast }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(t.id), t.duration);
    return () => window.clearTimeout(timer);
  }, [t.id, t.duration]);
  const Icon = t.tone === "info" ? Info : CheckCircle2;
  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-garis bg-putih p-3.5 pr-2 shadow-lift"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", t.tone === "info" ? "text-rona" : "text-sukses")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-kopi">{t.title}</p>
        {t.description ? <p className="mt-0.5 text-xs text-abu-hangat">{t.description}</p> : null}
      </div>
      <button type="button" onClick={() => dismissToast(t.id)} className="grid size-8 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup notifikasi">
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
