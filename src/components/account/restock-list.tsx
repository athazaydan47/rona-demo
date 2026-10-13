"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelRestockAction } from "@/lib/account/actions";

export type RestockRow = { id: number; status: "menunggu" | "terkirim"; createdLabel: string; notifiedLabel: string | null; productName: string; productSlug: string; shadeName: string; hex: string; packaging: Parameters<typeof ProductArt>[0]["packaging"]; brandName: string; brandColor: string };

function CancelButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await cancelRestockAction(id);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />} Batalkan
    </Button>
  );
}

export function RestockList({ rows }: { rows: RestockRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-card border border-garis bg-putih p-3">
          <Link href={`/p/${r.productSlug}`} className="w-14 shrink-0 overflow-hidden rounded-lg">
            <ProductArt packaging={r.packaging} shade={r.hex} brandColor={r.brandColor} brandName={r.brandName} title={r.productName} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/p/${r.productSlug}`} className="line-clamp-1 text-sm font-medium text-kopi hover:underline">
              {r.productName}
            </Link>
            <p className="text-xs text-abu-hangat">{r.shadeName}</p>
            <p className="mt-0.5 text-xs text-abu-hangat">{r.status === "menunggu" ? `Didaftarkan ${r.createdLabel}` : `Dikabari ${r.notifiedLabel}`}</p>
          </div>
          {r.status === "menunggu" ? <CancelButton id={r.id} /> : <Badge variant="sukses">Sudah dikabari</Badge>}
        </li>
      ))}
    </ul>
  );
}
