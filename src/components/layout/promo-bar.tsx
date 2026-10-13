"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function PromoBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), 4500);
    return () => window.clearInterval(t);
  }, [messages.length]);

  if (messages.length === 0) return null;
  const current = messages[index] ?? messages[0];

  return (
    <div className="bg-blush text-rona-gelap">
      <div className="container-rona relative flex h-8 items-center justify-center overflow-hidden text-xs font-medium sm:text-sm" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="truncate"
          >
            {current}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
