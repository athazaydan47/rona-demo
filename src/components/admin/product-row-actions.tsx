"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { duplicateProductAction } from "@/lib/admin/catalog-actions";

export function DuplicateProductButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await duplicateProductAction(id);
          if (r.ok) router.push(`/admin/produk/${r.id}?baru=salinan`);
        })
      }
      className="inline-flex items-center gap-1 text-xs font-semibold text-rona hover:underline"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />} Duplikat
    </button>
  );
}
