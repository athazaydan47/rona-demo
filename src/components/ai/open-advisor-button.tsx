"use client";

import { Sparkles } from "lucide-react";
import { openAdvisor } from "./advisor";

export function OpenAdvisorButton({ prompt }: { prompt: string }) {
  return (
    <button type="button" onClick={() => openAdvisor({ prompt })} className="inline-flex items-center gap-1.5 rounded-pill border border-garis bg-putih px-3.5 py-2 text-sm font-medium text-kopi hover:border-rona/40" data-testid="contoh-advisor">
      <Sparkles className="size-3.5 text-rona" aria-hidden /> {prompt}
    </button>
  );
}
