"use client";

// Isi menu kategori HP (Fase 8B): dimuat terpisah saat menu pertama kali dibuka, supaya Dialog dan Accordion Radix
// tidak ikut bundel awal setiap halaman.
import Link from "next/link";
import { Accordion, Dialog } from "radix-ui";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/queries";
import { HELP_LINKS } from "@/lib/content/bantuan";
import { fiturAktif } from "@/config/fitur";
import { useMobileMenu } from "./mobile-menu";

const quickLinks = [
  { href: "/promo", label: "Promo" },
  ...(fiturAktif("flashSale") ? [{ href: "/flash-sale", label: "Flash Sale" }] : []),
  { href: "/c/semua?urut=terbaru", label: "Baru Datang" },
  { href: "/c/semua?urut=terlaris", label: "Terlaris" },
  { href: "/merek", label: "Semua Merek" },
  { href: "/jurnal", label: "Jurnal" },
  ...(fiturAktif("multiCabang") ? [{ href: "/toko", label: "Toko Kami" }] : []),
];

export function MobileMenuSheetIsi({ categories }: { categories: CategoryNode[] }) {
  const { open, setOpen } = useMobileMenu();
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col bg-putih shadow-lift outline-none transition-transform duration-250 ease-soft data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
          aria-describedby={undefined}
        >
          <div className="flex h-14 items-center justify-between border-b border-garis px-4">
            <Dialog.Title className="font-serif text-xl">Kategori</Dialog.Title>
            <Dialog.Close
              className="grid size-10 place-items-center rounded-full text-kopi hover:bg-blush/60"
              aria-label="Tutup menu"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Kategori produk">
            <Accordion.Root type="multiple" className="divide-y divide-garis">
              {categories.map((cat) => (
                <Accordion.Item key={cat.id} value={cat.slug}>
                  <div className="flex items-center">
                    <Link
                      href={`/c/${cat.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex-1 px-3 py-3.5 text-base font-semibold text-kopi"
                    >
                      {cat.name}
                    </Link>
                    <Accordion.Trigger
                      className="group grid size-11 place-items-center rounded-full text-abu-hangat hover:bg-blush/60"
                      aria-label={`Buka sub kategori ${cat.name}`}
                    >
                      <ChevronDown className="size-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </div>
                  <Accordion.Content className="overflow-hidden pb-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                    <ul className="space-y-0.5 pl-3">
                      {cat.children.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/c/${cat.slug}/${sub.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-kopi hover:bg-porselen"
                          >
                            {sub.name}
                            <ChevronRight className="size-4 text-abu-hangat" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
            <ul className="mt-4 space-y-0.5 border-t border-garis pt-3">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-aksen-gelap hover:bg-blush/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-garis p-4 text-xs text-abu-hangat">
            <p className="mb-2 font-semibold tracking-wide text-kopi uppercase">Bantuan</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {HELP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="text-sm text-kopi hover:text-aksen-gelap">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3">Chat kami lewat WhatsApp, Senin sampai Sabtu 09.00 sampai 21.00 WIB.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
