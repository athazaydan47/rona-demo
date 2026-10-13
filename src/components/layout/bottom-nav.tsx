"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartBadge } from "./cart-badge";
import { useMobileMenu } from "./mobile-menu";

const itemClass =
  "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-abu-hangat transition-colors";

export function BottomNav() {
  const pathname = usePathname();
  const { setOpen, open } = useMobileMenu();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-garis bg-putih/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Navigasi bawah"
    >
      <div className="container-rona flex h-16 items-stretch gap-1">
        <Link href="/" className={cn(itemClass, isActive("/") && "text-rona")} aria-current={isActive("/") ? "page" : undefined}>
          <Home className="size-5" />
          Beranda
        </Link>
        <button type="button" onClick={() => setOpen(true)} className={cn(itemClass, open && "text-rona")}>
          <LayoutGrid className="size-5" />
          Kategori
        </button>
        <Link href="/cari" className={cn(itemClass, isActive("/cari") && "text-rona")} aria-current={isActive("/cari") ? "page" : undefined}>
          <Search className="size-5" />
          Cari
        </Link>
        <Link href="/keranjang" className={cn(itemClass, isActive("/keranjang") && "text-rona")} aria-current={isActive("/keranjang") ? "page" : undefined}>
          <span className="relative">
            <ShoppingBag className="size-5" />
            <CartBadge className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-rona px-1 text-[10px] font-bold text-putih tabular-nums" />
          </span>
          Keranjang
        </Link>
        <Link href="/akun" className={cn(itemClass, isActive("/akun") && "text-rona")} aria-current={isActive("/akun") ? "page" : undefined}>
          <User className="size-5" />
          Akun
        </Link>
      </div>
    </nav>
  );
}
