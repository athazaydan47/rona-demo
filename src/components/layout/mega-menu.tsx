"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { MegaMenuProps } from "./mega-menu-isi";

// Menu utama desktop (Fase 8B). Kerangka statis (tautan kategori dan tautan cepat dengan tampilan yang sama) dirender
// lebih dulu; versi interaktif Radix NavigationMenu dimuat hanya bila layar desktop. Di HP menu ini tersembunyi dan
// kodenya tidak pernah dimuat (HP memakai menu kategori di laci kiri).
const QUICK = [
  { href: "/promo", label: "Promo", accent: true },
  { href: "/c/semua?urut=terbaru", label: "Baru", lgOnly: true },
  { href: "/c/semua?urut=terlaris", label: "Terlaris", lgOnly: true },
  { href: "/merek", label: "Merek", lgOnly: true },
  { href: "/jurnal", label: "Jurnal", lgOnly: true },
];
const DESKTOP = "(min-width: 768px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function MenuStatis({ categories }: Pick<MegaMenuProps, "categories">) {
  return (
    <nav className="relative hidden md:block" aria-label="Navigasi utama">
      <ul className="flex items-center gap-1">
        {categories.map((cat) => (
          <li key={cat.id}>
            <Link href={`/c/${cat.slug}`} className="inline-flex h-10 items-center gap-1 rounded-pill px-2 text-xs font-medium whitespace-nowrap text-kopi transition-colors hover:bg-blush/60 lg:px-3 lg:text-sm">
              {cat.name}
              <span className="hidden size-3.5 lg:block" aria-hidden />
            </Link>
          </li>
        ))}
        {QUICK.map((l) => (
          <li key={l.href} className={l.lgOnly ? "hidden lg:block" : undefined}>
            <Link href={l.href} className={cn("inline-flex h-10 items-center rounded-pill px-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-blush/60 lg:px-3 lg:text-sm", l.accent ? "text-aksen" : "text-kopi")}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MegaMenu(props: MegaMenuProps) {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => false);
  const [Isi, setIsi] = useState<ComponentType<MegaMenuProps> | null>(null);
  useEffect(() => {
    if (!desktop || Isi) return;
    let alive = true;
    void import("./mega-menu-isi").then((m) => alive && setIsi(() => m.MegaMenuIsi));
    return () => {
      alive = false;
    };
  }, [desktop, Isi]);
  return desktop && Isi ? <Isi {...props} /> : <MenuStatis categories={props.categories} />;
}
