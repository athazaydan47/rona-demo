"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-pill border border-garis bg-putih px-3 text-xs font-semibold text-kopi hover:border-kopi/30", className)}
      aria-label={`Salin ${label}`}
    >
      {done ? <Check className="size-3.5 text-sukses" /> : <Copy className="size-3.5" />} {done ? "Tersalin" : "Salin"}
    </button>
  );
}
