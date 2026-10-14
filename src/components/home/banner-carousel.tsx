"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BannerCard, type BannerView } from "./banner-card";

// Karusel banner: geser dengan jari (scroll-snap), tombol di desktop, berganti sendiri tiap 6 detik.
export function BannerCarousel({ banners }: { banners: (BannerView & { id: number })[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = (i + banners.length) % banners.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || paused || reduce) return;
    const t = window.setTimeout(() => go(index + 1), 6000);
    return () => window.clearTimeout(t);
  });

  return (
    <section className="container-rona pt-5 md:pt-8" aria-roledescription="karusel" aria-label="Promo pilihan" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} data-testid="banner-beranda">
      <div className="relative">
        <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {banners.map((b, i) => (
            <Link key={b.id} href={b.href} className="block aspect-[16/10] w-full shrink-0 snap-start sm:aspect-[21/8] md:aspect-[1200/360]" aria-label={`${b.title}. ${b.ctaLabel || "Lihat sekarang"}`} aria-roledescription="slide" tabIndex={i === index ? 0 : -1}>
              <BannerCard banner={b} priority={i === 0} />
            </Link>
          ))}
        </div>
        {banners.length > 1 ? (
          <>
            <button type="button" onClick={() => go(index - 1)} className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-putih/85 shadow-soft hover:bg-putih md:grid" aria-label="Banner sebelumnya">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(index + 1)} className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-putih/85 shadow-soft hover:bg-putih md:grid" aria-label="Banner berikutnya">
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>
      {banners.length > 1 ? (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button key={b.id} type="button" onClick={() => go(i)} className="grid h-9 min-w-7 place-items-center px-1" aria-label={`Banner ${i + 1} dari ${banners.length}`} aria-current={i === index}>
              <span className={cn("block h-1.5 rounded-full transition-all", i === index ? "w-5 bg-rona" : "w-1.5 bg-kopi/20")} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
