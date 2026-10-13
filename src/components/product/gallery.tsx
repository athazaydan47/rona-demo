"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type GalleryImage = { key: string; label: string; node: React.ReactNode };

type Props = {
  images: GalleryImage[];
  variantKey: string; // berubah saat shade berganti supaya gambar utama crossfade
  mainRef?: React.RefObject<HTMLDivElement | null>;
};

// Desktop: gambar utama dengan thumbnail di kiri. HP: baris geser dengan indikator titik.
export function ProductGallery({ images, variantKey, mainRef }: Props) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const current = images[Math.min(active, images.length - 1)];

  // HP: ikuti slide yang sedang terlihat.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const slides = [...el.querySelectorAll<HTMLElement>("[data-slide]")];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.slide));
      },
      { root: el, threshold: 0.6 },
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [images.length]);

  const scrollTo = (i: number) => {
    setActive(i);
    const el = scrollerRef.current;
    const slide = el?.querySelector<HTMLElement>(`[data-slide="${i}"]`);
    if (el && slide) el.scrollTo({ left: slide.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div>
      {/* Desktop */}
      <div className="hidden gap-3 md:flex">
        <ul className="flex w-20 shrink-0 flex-col gap-2" aria-label="Pilih tampilan gambar">
          {images.map((img, i) => (
            <li key={img.key}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                aria-label={img.label}
                className={cn("block w-full overflow-hidden rounded-xl border-2 transition-colors", i === active ? "border-kopi" : "border-transparent hover:border-garis")}
              >
                {img.node}
              </button>
            </li>
          ))}
        </ul>
        <div ref={mainRef} className="relative min-w-0 flex-1 overflow-hidden rounded-card bg-porselen" style={{ aspectRatio: "5 / 6" }}>
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={`${current.key}-${variantKey}`}
              initial={reduce ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              {current.node}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* HP */}
      <div className="md:hidden">
        <div ref={scrollerRef} className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scrollbar-none" aria-label="Galeri produk" role="region">
          {images.map((img, i) => (
            <div key={img.key} data-slide={i} className="w-full shrink-0 snap-center px-4">
              <div className="overflow-hidden rounded-card bg-porselen" style={{ aspectRatio: "5 / 6" }} ref={i === 0 ? (mainRef as React.RefObject<HTMLDivElement>) : undefined}>
                <AnimatePresence initial={false} mode="sync">
                  <motion.div key={`${img.key}-${variantKey}`} initial={reduce ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    {img.node}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Indikator galeri">
          {images.map((img, i) => (
            <button
              key={img.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={img.label}
              onClick={() => scrollTo(i)}
              className={cn("h-2 rounded-full transition-[width,background-color] duration-200", i === active ? "w-6 bg-kopi" : "w-2 bg-garis")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
