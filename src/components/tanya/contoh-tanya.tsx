"use client";

// Contoh kalimat siap tekan untuk mencoba chat asisten (panduan demo dan halaman Tentang demo, Fase 8C).
import { Sparkles } from "lucide-react";
import { openAdvisor } from "@/components/ai/advisor";
import { useAiStatus } from "@/components/ai/ai-status";
import { CONTOH_TANYA } from "@/lib/content/demo";
import { cn } from "@/lib/utils";

export function ContohTanya({ className, ringkas }: { className?: string; ringkas?: boolean }) {
  const { tersedia, aiFoto } = useAiStatus();
  if (!tersedia) return null;
  const list = CONTOH_TANYA.filter((c) => aiFoto || !/tiktok\.com/.test(c.kalimat));
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} data-testid="contoh-tanya">
      {list.map((c) => (
        <button key={c.label} type="button" onClick={() => openAdvisor({ prompt: c.kalimat, kirim: true })} title={c.kalimat} className="inline-flex items-center gap-1 rounded-pill border border-garis bg-porselen px-2.5 py-1 text-xs font-medium text-kopi hover:border-aksen/40">
          <Sparkles className="size-3 text-aksen" aria-hidden /> {ringkas ? c.label : c.kalimat.length > 48 ? `${c.kalimat.slice(0, 46)}...` : c.kalimat}
        </button>
      ))}
    </div>
  );
}
