"use client";

import { useId, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { ProductCardData } from "@/lib/catalog/catalog-queries";
import { skinTypeLabels } from "@/lib/catalog/filters";
import { cn } from "@/lib/utils";
import { ScrollRow } from "@/components/ui/scroll-row";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SkinTypeTabs({ data }: { data: Record<string, ProductCardData[]> }) {
  const keys = Object.keys(data).filter((k) => data[k].length > 0);
  const [active, setActive] = useState(keys[0] ?? "normal");
  const id = useId();
  const products = data[active] ?? [];
  return (
    <div>
      <div role="tablist" aria-label="Jenis kulit" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        {keys.map((k) => (
          <button
            key={k}
            role="tab"
            id={`${id}-tab-${k}`}
            aria-selected={active === k}
            aria-controls={`${id}-panel`}
            tabIndex={active === k ? 0 : -1}
            onClick={() => setActive(k)}
            onKeyDown={(e) => {
              const i = keys.indexOf(k);
              if (e.key === "ArrowRight") setActive(keys[(i + 1) % keys.length]);
              if (e.key === "ArrowLeft") setActive(keys[(i - 1 + keys.length) % keys.length]);
            }}
            className={cn(
              "h-9 shrink-0 rounded-pill border px-4 text-sm font-medium transition-colors",
              active === k ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih text-kopi hover:border-kopi/30",
            )}
          >
            {skinTypeLabels[k] ?? k}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="mt-4">
        <ScrollRow ariaLabel={`Produk untuk kulit ${skinTypeLabels[active] ?? active}`} desktop="md:grid-cols-4">
          {products.map((p) => (
            <li key={p.id} className="min-w-0">
              <ProductCard product={p} />
            </li>
          ))}
        </ScrollRow>
        <Link href={`/c/semua?kulit=${active}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
          Semua produk untuk kulit {(skinTypeLabels[active] ?? active).toLowerCase()} <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
