"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { serializeCatalogParams, type CatalogFilters } from "@/lib/catalog/filters";

// Semua state filter hidup di URL: push supaya tombol Back berfungsi, halaman direset ke 1.
export function useCatalogUrl(basePath?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const path = basePath ?? pathname;
  const hrefFor = useCallback(
    (next: CatalogFilters) => {
      const qs = serializeCatalogParams({ ...next, page: 1 });
      return qs ? `${path}?${qs}` : path;
    },
    [path],
  );
  const apply = useCallback(
    (next: CatalogFilters) => {
      startTransition(() => {
        router.push(hrefFor(next), { scroll: false });
      });
    },
    [router, hrefFor],
  );
  return { apply, hrefFor, pending };
}
