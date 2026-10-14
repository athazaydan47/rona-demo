"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellRing, ChevronRight, Heart, LayoutDashboard, MapPin, Package, Sparkles, SunMedium, UserRound } from "lucide-react";
import { useAccountBadge } from "@/components/layout/account-link";
import { cn } from "@/lib/utils";
import { fiturAktif } from "@/config/fitur";

const MENU = [
  { href: "/akun", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/akun/pesanan", label: "Pesanan", icon: Package },
  { href: "/akun/notifikasi", label: "Kotak Notifikasi", icon: Bell },
  { href: "/akun/wishlist", label: "Wishlist", icon: Heart },
  { href: "/akun/poin", label: "Poin", icon: Sparkles },
  { href: "/akun/alamat", label: "Alamat", icon: MapPin },
  { href: "/akun/profil-kulit", label: "Profil kulit", icon: SunMedium },
  { href: "/akun/kabari-aku", label: "Kabari aku", icon: BellRing },
  { href: "/akun/profil", label: "Profil dan keamanan", icon: UserRound },
] as const;

// Menu Poin tersembunyi bila fitur poin dimatikan (src/config/fitur.ts).
export const ACCOUNT_MENU = MENU.filter((m) => m.href !== "/akun/poin" || fiturAktif("poin"));

function Items({ pathname, variant }: { pathname: string | null; variant: "side" | "list" }) {
  const { unread } = useAccountBadge();
  const active = (href: string) => (pathname ? (href === "/akun" ? pathname === "/akun" : pathname.startsWith(href)) : false);
  return (
    <ul className={variant === "side" ? "space-y-0.5" : "divide-y divide-garis overflow-hidden rounded-card border border-garis bg-putih"}>
      {ACCOUNT_MENU.map((m) => {
        const isActive = variant === "side" && active(m.href);
        return (
          <li key={m.href}>
            <Link
              href={m.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 text-sm transition-colors",
                variant === "side" ? "rounded-xl px-3 py-2.5" : "px-4 py-3.5",
                isActive ? "bg-blush/70 font-semibold text-aksen-gelap" : "text-kopi hover:bg-porselen",
              )}
            >
              <m.icon className="size-4.5 shrink-0 text-aksen" aria-hidden />
              <span className="flex-1">{m.label}</span>
              {m.href === "/akun/notifikasi" && unread > 0 ? <span className="rounded-full bg-emas px-1.5 text-[11px] font-bold text-kopi tabular-nums">{unread}</span> : null}
              {variant === "list" ? <ChevronRight className="size-4 text-abu-hangat" aria-hidden /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WithPath({ variant }: { variant: "side" | "list" }) {
  return <Items pathname={usePathname()} variant={variant} />;
}

export function AccountNav({ variant }: { variant: "side" | "list" }) {
  return (
    <Suspense fallback={<Items pathname={null} variant={variant} />}>
      <WithPath variant={variant} />
    </Suspense>
  );
}
