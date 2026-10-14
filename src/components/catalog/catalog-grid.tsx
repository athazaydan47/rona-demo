"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard, ProductCardSkeleton, type CardBadge } from "@/components/product-card";
import type { ProductCardData } from "@/lib/catalog/catalog-queries";
import { PAGE_SIZE } from "@/lib/catalog/filters";
import { bertahap, lembut } from "@/lib/motion";

// Bernilai true setelah grid pertama terhidrasi: grid yang dipasang sesudahnya (navigasi klien, filter berganti) boleh
// memulai kartu dari transparan. Saat render server dan hidrasi pertama, kartu langsung terlihat supaya LCP tidak menunggu JS.
let sudahHidrasi = false;

type Props = {
  initial: ProductCardData[];
  total: number;
  hasMore: boolean;
  page: number;
  apiQuery: string; // cakupan + filter tanpa parameter hal
  hideBadges?: CardBadge[];
};

// Grid produk dengan "Tampilkan lebih banyak" dan infinite scroll. Kunci komponen diganti saat filter berubah.
export function CatalogGrid({ initial, total, hasMore: initialHasMore, page: initialPage, apiQuery, hideBadges }: Props) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const autoLoads = useRef(0);
  const reduce = useReducedMotion();
  // Kartu masuk bertahap: saat grid dipasang lewat navigasi klien (termasuk setiap filter berubah, karena kuncinya ikut
  // berubah) dan saat halaman berikutnya ditambahkan. Indeks relatif ke awal batch supaya jeda tidak menumpuk.
  const [batchStart, setBatchStart] = useState(0);
  const [animasiAwal] = useState(() => sudahHidrasi);
  useEffect(() => {
    sudahHidrasi = true;
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/katalog?${apiQuery}&hal=${page + 1}`);
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { products: ProductCardData[]; hasMore: boolean };
      setBatchStart(items.length);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.products.filter((p) => !seen.has(p.id))];
      });
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
    } catch {
      setError("Gagal memuat produk berikutnya. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [apiQuery, hasMore, loading, page, items.length]);

  // Infinite scroll: maksimal 3 kali otomatis, setelah itu tombol supaya footer tetap bisa dijangkau.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && autoLoads.current < 3 && !loading) {
          autoLoads.current += 1;
          void loadMore();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  const skeletonCount = Math.min(PAGE_SIZE, Math.max(0, total - items.length), 8);

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4" aria-live="polite" aria-busy={loading}>
        {items.map((p, i) => (
          <motion.li key={p.id} className="min-w-0" initial={reduce || (!animasiAwal && i < batchStart + 1 && batchStart === 0) ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={lembut(undefined, bertahap(i - batchStart))}>
            <ProductCard product={p} hideBadges={hideBadges} priority={batchStart === 0 && i < 4} />
          </motion.li>
        ))}
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <li key={`sk-${i}`}>
                <ProductCardSkeleton />
              </li>
            ))
          : null}
      </ul>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-sm text-abu-hangat tabular-nums">
          Menampilkan {items.length} dari {total} produk
        </p>
        {error ? <p className="text-sm text-bahaya">{error}</p> : null}
        {hasMore ? (
          <Button variant="outline" size="lg" onClick={() => void loadMore()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Tampilkan lebih banyak
          </Button>
        ) : null}
      </div>
    </div>
  );
}
