import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import type { Packaging } from "@/db/schema/enums";
import type { CategoryNode } from "@/lib/catalog/queries";
import { ProductArt } from "@/components/product-art";
import { CartBadge } from "./cart-badge";
import { MegaMenu } from "./mega-menu";
import { MobileMenuTrigger } from "./mobile-menu";
import { SearchBox } from "./search-box";

// Contoh kemasan dan warna untuk panel kanan MegaMenu per kategori.
const featuredArt: Record<string, { packaging: Packaging; shade: string; brand: string; brandName: string }> = {
  skincare: { packaging: "serum_dropper", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab" },
  "makeup-wajah": { packaging: "cushion", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam" },
  "makeup-mata": { packaging: "eyeshadow_palette", shade: "#C5714F", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
  bibir: { packaging: "lipstick", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi" },
  "sun-care": { packaging: "sunscreen_tube", shade: "#FBE7B8", brand: "#E0A227", brandName: "Surya Shield" },
  "body-dan-hair": { packaging: "lotion_pump", shade: "#F3ECE4", brand: "#D98E8E", brandName: "Mekar" },
  fragrance: { packaging: "perfume_bottle", shade: "#E8F0DE", brand: "#7A4E8C", brandName: "Arunika" },
  pria: { packaging: "cream_jar", shade: "#C9B07A", brand: "#2E4057", brandName: "Nara Men" },
};

const iconLink =
  "relative grid size-11 place-items-center rounded-full text-kopi transition-colors hover:bg-blush/60 focus-visible:bg-blush/60";

export function Header({ categories }: { categories: CategoryNode[] }) {
  const featured = Object.fromEntries(
    categories.map((cat) => {
      const art = featuredArt[cat.slug] ?? featuredArt.skincare;
      return [
        cat.slug,
        <ProductArt key={cat.slug} packaging={art.packaging} shade={art.shade} brandColor={art.brand} brandName={art.brandName} background="none" title={`Ilustrasi ${cat.name}`} />,
      ];
    }),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-garis bg-putih/92 backdrop-blur-md">
      <div className="container-rona">
        <div className="flex h-16 items-center gap-3 md:h-[72px]">
          <MobileMenuTrigger className="-ml-2 md:hidden" />
          <Link href="/" className="flex items-baseline gap-1.5 pr-2" aria-label="Rona Beauty, ke beranda">
            <span className="font-serif text-[28px] leading-none font-medium tracking-tight text-kopi md:text-[32px]">
              Rona
            </span>
            <span className="hidden text-[11px] font-semibold tracking-[0.18em] text-rona uppercase sm:inline">
              Beauty
            </span>
          </Link>
          <SearchBox className="mx-auto hidden w-full max-w-xl md:block" />
          <nav className="ml-auto flex items-center gap-0.5" aria-label="Akun dan keranjang">
            <Link href="/cari" className={`${iconLink} md:hidden`} aria-label="Cari">
              <Search className="size-5" />
            </Link>
            <Link href="/akun/wishlist" className={`${iconLink} hidden sm:grid`} aria-label="Wishlist">
              <Heart className="size-5" />
            </Link>
            <Link href="/akun" className={`${iconLink} hidden md:grid`} aria-label="Akun">
              <User className="size-5" />
            </Link>
            <Link href="/keranjang" className={iconLink} aria-label="Keranjang">
              <ShoppingBag className="size-5" />
              <CartBadge className="absolute top-1 right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-rona px-1 text-[10px] font-bold text-putih tabular-nums" />
            </Link>
          </nav>
        </div>
        <div className="hidden h-12 items-center md:flex">
          <MegaMenu categories={categories} featured={featured} />
        </div>
      </div>
    </header>
  );
}
