"use client";

import { useEffect, useState } from "react";

export function PromoBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), 4500);
    return () => window.clearInterval(t);
  }, [messages.length]);

  if (messages.length === 0) return null;
  const current = messages[index] ?? messages[0];

  return (
    <div className="bg-blush text-aksen-gelap">
      <div className="container-toko relative flex h-8 items-center justify-center overflow-hidden text-xs font-medium sm:text-sm" aria-live="polite">
        {/* Pesan baru masuk dengan geser halus (CSS, Fase 8B: tanpa Motion di semua halaman). */}
        <p key={index} className={index > 0 ? "truncate animate-muncul" : "truncate"}>
          {current}
        </p>
      </div>
    </div>
  );
}
