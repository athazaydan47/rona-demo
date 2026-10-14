import Link from "next/link";
import { Heart, Search, ShoppingBag } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/queries";
import { ProductArt } from "@/components/product-art";
import { AccountIconLink } from "./account-link";
import { CartBadge } from "./cart-badge";
import { MegaMenu } from "./mega-menu";
import { MobileMenuTrigger } from "./mobile-menu";
import { SearchBox } from "./search-box";
import { MEREK } from "@/config/merek";
import { ART_MEGAMENU, artKategori } from "@/lib/content/visual";

const iconLink =
  "relative grid size-11 place-items-center rounded-full text-kopi transition-colors hover:bg-blush/60 focus-visible:bg-blush/60";

export function Header({ categories }: { categories: CategoryNode[] }) {
  const featured = Object.fromEntries(
    categories.map((cat) => {
      const art = artKategori(cat.slug, ART_MEGAMENU);
      return [
        cat.slug,
        <ProductArt key={cat.slug} packaging={art.packaging} shade={art.shade} brandColor={art.brand} brandName={art.brandName} background="none" title={`Ilustrasi ${cat.name}`} />,
      ];
    }),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-garis bg-putih/92 backdrop-blur-md">
      <div className="container-toko">
        <div className="flex h-16 items-center gap-3 md:h-[72px]">
          <MobileMenuTrigger className="-ml-2 md:hidden" />
          <Link href="/" className="flex min-h-11 items-baseline gap-2 pr-2" aria-label={`${MEREK.namaLengkap}, ke beranda`}>
            <span className="font-serif text-[30px] leading-none font-medium tracking-[-0.02em] text-kopi md:text-[38px]">
              {MEREK.nama}
            </span>
            <span className="hidden translate-y-[-1px] text-[10px] font-bold tracking-[0.26em] text-aksen uppercase sm:inline md:text-[11px]">
              {MEREK.subLogo}
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
            <AccountIconLink
              className={`${iconLink} hidden md:grid`}
              badgeClassName="absolute top-1 right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-emas px-1 text-[10px] font-bold text-kopi tabular-nums"
            />
            <Link href="/keranjang" className={iconLink} aria-label="Keranjang" data-cart-icon>
              <ShoppingBag className="size-5" />
              <CartBadge className="absolute top-1 right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-aksen px-1 text-[10px] font-bold text-putih tabular-nums" />
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
