"use client";

import Link from "next/link";
import { NavigationMenu } from "radix-ui";
import { ChevronDown } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

type MegaMenuProps = {
  categories: CategoryNode[];
  // Panel kanan per kategori (ProductArt dirender di server lalu dikirim sebagai slot).
  featured: Record<string, React.ReactNode>;
};

// Tautan cepat; yang bertanda lgOnly disembunyikan di lebar tablet supaya baris menu muat.
const quickLinks = [
  { href: "/promo", label: "Promo", accent: true },
  { href: "/c/semua?urut=terbaru", label: "Baru", lgOnly: true },
  { href: "/c/semua?urut=terlaris", label: "Terlaris", lgOnly: true },
  { href: "/merek", label: "Merek", lgOnly: true },
  { href: "/jurnal", label: "Jurnal", lgOnly: true },
];

export function MegaMenu({ categories, featured }: MegaMenuProps) {
  return (
    <NavigationMenu.Root className="relative hidden md:block" aria-label="Navigasi utama">
      <NavigationMenu.List className="flex items-center gap-1">
        {categories.map((cat) => (
          <NavigationMenu.Item key={cat.id} value={cat.slug}>
            <NavigationMenu.Trigger
              className="group inline-flex h-10 items-center gap-1 rounded-pill px-2 text-xs font-medium whitespace-nowrap text-kopi lg:px-3 lg:text-sm transition-colors hover:bg-blush/60 data-[state=open]:bg-blush/60 data-[state=open]:text-rona-gelap"
            >
              {cat.name}
              <ChevronDown className="hidden size-3.5 text-abu-hangat transition-transform duration-200 group-data-[state=open]:rotate-180 lg:block" aria-hidden />
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className="absolute top-0 left-0 w-auto data-[motion=from-end]:animate-in data-[motion=from-start]:animate-in data-[motion=to-end]:animate-out data-[motion=to-start]:animate-out data-[motion=from-end]:fade-in-0 data-[motion=from-start]:fade-in-0 data-[motion=to-end]:fade-out-0 data-[motion=to-start]:fade-out-0">
              <div className="grid w-[720px] grid-cols-[1fr_260px] gap-8 p-7 lg:w-[820px] lg:grid-cols-[1fr_280px]">
                <div>
                  <div className="mb-4 flex items-baseline justify-between">
                    <h3 className="font-serif text-xl text-kopi">{cat.name}</h3>
                    <NavigationMenu.Link asChild>
                      <Link href={`/c/${cat.slug}`} className="text-sm font-semibold text-rona hover:underline">
                        Lihat semua {cat.name}
                      </Link>
                    </NavigationMenu.Link>
                  </div>
                  <p className="mb-5 max-w-md text-sm text-abu-hangat">{cat.description}</p>
                  <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {cat.children.map((sub) => (
                      <li key={sub.id}>
                        <NavigationMenu.Link asChild>
                          <Link
                            href={`/c/${cat.slug}/${sub.slug}`}
                            className="block rounded-lg px-2 py-2 text-sm text-kopi transition-colors hover:bg-porselen hover:text-rona-gelap"
                          >
                            {sub.name}
                          </Link>
                        </NavigationMenu.Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <NavigationMenu.Link asChild>
                  <Link
                    href={`/c/${cat.slug}`}
                    className="group/feat relative flex flex-col justify-end overflow-hidden rounded-card bg-porselen p-5"
                  >
                    <div className="absolute inset-x-6 top-2 transition-transform duration-300 ease-soft group-hover/feat:-translate-y-1">
                      {featured[cat.slug]}
                    </div>
                    <div className="relative mt-56 rounded-xl bg-putih/85 p-3 backdrop-blur-sm">
                      <p className="text-xs font-semibold tracking-wide text-rona uppercase">Pilihan editor</p>
                      <p className="mt-0.5 font-serif text-lg leading-tight text-kopi">Mulai dari {cat.name}</p>
                    </div>
                  </Link>
                </NavigationMenu.Link>
              </div>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
        {quickLinks.map((l) => (
          <NavigationMenu.Item key={l.href} className={l.lgOnly ? "hidden lg:block" : undefined}>
            <NavigationMenu.Link asChild>
              <Link
                href={l.href}
                className={cn(
                  "inline-flex h-10 items-center rounded-pill px-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-blush/60 lg:px-3 lg:text-sm",
                  l.accent ? "text-rona" : "text-kopi",
                )}
              >
                {l.label}
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        ))}
        <NavigationMenu.Indicator className="top-full z-10 flex h-2 items-end justify-center overflow-hidden transition-[width,transform] duration-200 data-[state=hidden]:animate-out data-[state=visible]:animate-in data-[state=hidden]:fade-out-0 data-[state=visible]:fade-in-0">
          <div className="relative top-[60%] size-3 rotate-45 rounded-tl-sm border-t border-l border-garis bg-putih" />
        </NavigationMenu.Indicator>
      </NavigationMenu.List>
      <div className="absolute top-full left-0 z-20 flex w-full justify-start pt-2">
        <NavigationMenu.Viewport className="relative h-[var(--radix-navigation-menu-viewport-height)] w-[var(--radix-navigation-menu-viewport-width)] origin-top overflow-hidden rounded-card border border-garis bg-putih shadow-lift transition-[width,height] duration-250 ease-soft data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " />
      </div>
    </NavigationMenu.Root>
  );
}
