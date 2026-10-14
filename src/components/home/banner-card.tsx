import { ArrowRight } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import type { Packaging } from "@/db/schema/enums";
import type { BannerArt } from "@/db/schema/content";
import { cn } from "@/lib/utils";

export type BannerView = { title: string; subtitle: string; ctaLabel: string; href: string; imageUrl: string | null; art: BannerArt | null };

// Isi banner hero. Tata letak memakai container query, jadi pratinjau 375 dan 1440 di admin sama persis dengan toko.
export function BannerCard({ banner, className, priority }: { banner: BannerView; className?: string; priority?: boolean }) {
  const items = banner.art?.items ?? [];
  return (
    <div className={cn("@container relative h-full w-full overflow-hidden rounded-card", className)} style={{ background: banner.art?.background ?? "#F4DCDF" }}>
      <div className="grid h-full grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center gap-2 p-5 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @2xl:gap-8 @2xl:p-12">
        <div className="relative z-10 min-w-0">
          <p className="font-serif text-[22px] leading-[1.1] font-medium text-balance text-kopi @2xl:text-5xl @2xl:leading-[1.05]">{banner.title}</p>
          {banner.subtitle ? <p className="mt-2 line-clamp-3 text-xs text-kopi/75 @2xl:mt-4 @2xl:max-w-md @2xl:text-lg">{banner.subtitle}</p> : null}
          <span className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-pill bg-kopi px-3.5 text-xs font-semibold text-putih @2xl:mt-7 @2xl:h-12 @2xl:px-6 @2xl:text-base">
            {banner.ctaLabel || "Lihat sekarang"} <ArrowRight className="size-3.5 @2xl:size-4" aria-hidden />
          </span>
        </div>
        <div className="relative h-full min-h-0" aria-hidden>
          {banner.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full rounded-xl object-cover" loading={priority ? "eager" : "lazy"} />
          ) : (
            <div className="absolute inset-0 flex items-end justify-center gap-1 @2xl:gap-4">
              {items.map((it, i) => (
                <div key={i} className={cn("w-[34%] drop-shadow-[0_14px_18px_rgb(42_31_29/0.2)] @2xl:w-[30%]", i === 1 ? "-translate-y-[12%]" : "")}>
                  <ProductArt packaging={it.packaging as Packaging} shade={it.shade} brandColor={it.brandColor} brandName={it.brandName} background="none" title="" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
