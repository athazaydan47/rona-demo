import { ProductArtInline as ProductArt, ShadeSwatchArt } from "@/components/product-art";

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

        {/* Aksen swatch */}
        <div className="absolute rotate-[-8deg]" style={{ left: "12%", top: "22%", width: "26%" }}>
          <ShadeSwatchArt shade="#B8475D" texture="krim" background="none" />
        </div>
        <div className="absolute rotate-[10deg]" style={{ left: "70%", top: "78%", width: "22%" }}>
          <ShadeSwatchArt shade="#DAB085" texture="satin" background="none" />
        </div>

        {/* Baris belakang */}
        <div className="absolute drop-shadow-[0_18px_22px_rgb(42_31_29/0.18)]" style={{ left: "26%", top: "6%", width: "30%" }}>
          <ProductArt packaging="lotion_pump" shade="#F3ECE4" brandColor="#D98E8E" brandName="Mekar" background="none" />
        </div>
        <div className="absolute drop-shadow-[0_18px_22px_rgb(42_31_29/0.18)]" style={{ left: "58%", top: "0%", width: "32%" }}>
          <ProductArt packaging="perfume_bottle" shade="#E8F0DE" brandColor="#7A4E8C" brandName="Arunika" background="none" />
        </div>

        {/* Baris tengah */}
        <div className="absolute drop-shadow-[0_22px_26px_rgb(42_31_29/0.22)]" style={{ left: "8%", top: "34%", width: "28%" }}>
          <ProductArt packaging="serum_dropper" shade="#D9EBE7" brandColor="#2F5D62" brandName="Kirana Lab" background="none" />
        </div>
        <div className="absolute drop-shadow-[0_26px_30px_rgb(42_31_29/0.24)]" style={{ left: "44%", top: "26%", width: "40%" }}>
          <ProductArt packaging="cushion" shade="#DAB085" brandColor="#B98A6A" brandName="Pualam" background="none" />
        </div>

        {/* Baris depan */}
        <div className="absolute drop-shadow-[0_26px_28px_rgb(42_31_29/0.26)]" style={{ left: "30%", top: "50%", width: "22%" }}>
          <ProductArt packaging="lipstick" shade="#B8475D" brandColor="#C2416B" brandName="Lumi" background="none" />
        </div>
        <div className="absolute drop-shadow-[0_22px_26px_rgb(42_31_29/0.22)]" style={{ left: "60%", top: "54%", width: "20%" }}>
          <ProductArt packaging="lip_tint" shade="#E2654A" brandColor="#C2416B" brandName="Lumi" background="none" />
        </div>
      </div>
    </div>
  );
}
