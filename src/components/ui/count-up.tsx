"use client";

import { useEffect, useRef, useState } from "react";

// Angka yang naik bertahap ke nilai barunya (sekitar 600 ms, melambat di akhir). Server dan render pertama memakai
// nilai akhir supaya tidak ada lompatan saat hidrasi; animasi hanya berjalan saat nilai berubah dan gerak tidak dikurangi.
export function CountUp({ value, format, duration = 600, className, testId }: { value: number; format: (n: number) => string; duration?: number; className?: string; testId?: string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={className} data-testid={testId} data-nilai={value}>
      {format(shown)}
    </span>
  );
}
