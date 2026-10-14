"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshReviewSummaryAction } from "@/lib/admin/catalog-actions";

// Tombol "Perbarui ringkasan" ulasan AI di admin produk. Hanya membuat ulang bila daftar ulasan berubah.
export function SummaryRefresh({ productId, info }: { productId: number; info: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, run] = useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-garis bg-putih px-3 py-2 text-sm" data-testid="ringkasan-admin">
      <Sparkles className="size-4 text-rona" aria-hidden />
      <span className="text-abu-hangat">{msg ?? info}</span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await refreshReviewSummaryAction(productId);
            setMsg(r.message);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Perbarui ringkasan
      </Button>
    </div>
  );
}
