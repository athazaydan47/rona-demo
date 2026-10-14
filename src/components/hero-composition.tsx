import { ProductArtInline as ProductArt, ShadeSwatchArt } from "@/components/product-art/inline";
import { HERO_PACKSHOT, HERO_SWATCH } from "@/lib/content/visual";

// Komposisi still-life untuk hero desktop: 6 packshot berbagai ukuran di atas podium geometris.
// Kanvas 640 x 520 (rasio dijaga lewat aspect-ratio), semua posisi dalam persen supaya ikut menskala.
export function HeroComposition({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="relative w-full" style={{ aspectRatio: "640 / 520" }}>
        {/* Podium dan alas */}
        <div className="absolute rounded-[28px] bg-[#F1E4E2] shadow-[0_24px_60px_-30px_rgb(42_31_29/0.35)]" style={{ left: "6%", top: "48%", width: "52%", height: "46%" }} />
        <div className="absolute rounded-[28px] bg-[#EAD8D6]" style={{ left: "6%", top: "48%", width: "52%", height: "6%" }} />
        <div className="absolute rounded-[22px] bg-[#F7ECE9] shadow-[0_18px_50px_-28px_rgb(42_31_29/0.35)]" style={{ left: "48%", top: "30%", width: "46%", height: "64%" }} />
        <div className="absolute rounded-[22px] bg-[#EFDFDC]" style={{ left: "48%", top: "30%", width: "46%", height: "5%" }} />
        <div className="absolute rounded-full bg-[#F4DCDF]" style={{ left: "66%", top: "2%", width: "30%", aspectRatio: "1" }} />
        <div className="absolute rounded-full border border-[#E6C9CD]" style={{ left: "2%", top: "10%", width: "22%", aspectRatio: "1" }} />

        {/* Aksen swatch dan packshot dari src/lib/content/visual.ts */}
        {HERO_SWATCH.map((w) => (
          <div key={w.shade + w.left} className={`absolute ${w.putar}`} style={{ left: w.left, top: w.top, width: w.width }}>
            <ShadeSwatchArt shade={w.shade} texture={w.texture} background="none" />
          </div>
        ))}
        {HERO_PACKSHOT.map((p) => (
          <div key={p.packaging + p.left} className={`absolute ${p.bayangan}`} style={{ left: p.left, top: p.top, width: p.width }}>
            <ProductArt packaging={p.packaging} shade={p.shade} brandColor={p.brand} brandName={p.brandName} background="none" />
          </div>
        ))}
      </div>
    </div>
  );
}
