"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { countdownTo, pad2 } from "@/lib/flash";
import { DURASI, EASE_LEMBUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

type FlashCountdownProps = {
  target: string; // ISO
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  onZero?: () => void;
};

const sizes = {
  sm: "h-7 min-w-7 px-1 text-xs",
  md: "h-9 min-w-9 px-1.5 text-sm",
  lg: "h-12 min-w-12 px-2 text-lg",
};

// Hitung mundur yang berdetak di klien. Angka awal dari server supaya tidak melompat saat hidrasi.
// Satu kotak angka: nilai lama turun keluar, nilai baru masuk dari atas (flip halus), tanpa mengubah ukuran kotak.
function Digit({ value, size }: { value: string; size: keyof typeof sizes }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("relative grid place-items-center overflow-hidden rounded-lg bg-kopi font-semibold text-putih tabular-nums", sizes[size])} suppressHydrationWarning>
      <span className="invisible" aria-hidden>
        {value}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "70%", opacity: 0 }}
          transition={{ duration: DURASI.sedang, ease: [...EASE_LEMBUT] }}
          className="absolute inset-0 grid place-items-center"
          suppressHydrationWarning
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function FlashCountdown({ target, label, size = "md", className, onZero }: FlashCountdownProps) {
  const targetDate = new Date(target);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Mulai berdetak setelah hidrasi; angka pertama diisi lewat timer supaya tidak setState langsung di effect.
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, []);
  const c = countdownTo(targetDate, now ?? targetDate);
  useEffect(() => {
    if (now && c.total === 0) onZero?.();
  }, [now, c.total, onZero]);
  const hours = c.hours > 99 ? 99 : c.hours;
  const parts = [pad2(hours), pad2(c.minutes), pad2(c.seconds)];
  return (
    <div className={cn("flex items-center gap-2", className)} role="timer" aria-live="off" aria-label={`${label ?? "Sisa waktu"} ${hours} jam ${c.minutes} menit ${c.seconds} detik`}>
      {label ? <span className="text-sm text-abu-hangat">{label}</span> : null}
      <span className="flex items-center gap-1" suppressHydrationWarning>
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <Digit value={now ? p : "--"} size={size} />
            {i < 2 ? <span className="font-semibold text-kopi">:</span> : null}
          </span>
        ))}
      </span>
    </div>
  );
}
