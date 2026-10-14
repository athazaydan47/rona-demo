"use client";

import { createContext, useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const MobileMenuContext = createContext<Ctx | null>(null);

export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileMenuContext.Provider value={{ open, setOpen }}>{children}</MobileMenuContext.Provider>;
}

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) throw new Error("useMobileMenu harus dipakai di dalam MobileMenuProvider");
  return ctx;
}

export function MobileMenuTrigger({ className }: { className?: string }) {
  const { setOpen } = useMobileMenu();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      onPointerDown={muatMenuHp}
      className={cn("grid size-11 place-items-center rounded-full text-kopi hover:bg-blush/60", className)}
      aria-label="Buka menu kategori"
    >
      <Menu className="size-5" />
    </button>
  );
}

const SheetIsi = dynamic(() => import("./mobile-menu-sheet").then((m) => m.MobileMenuSheetIsi), { ssr: false });
export const muatMenuHp = () => void import("./mobile-menu-sheet");

// Sheet dirender setelah pertama dibuka dan tetap terpasang supaya animasi tutup berjalan.
export function MobileMenuSheet({ categories }: { categories: CategoryNode[] }) {
  const { open } = useMobileMenu();
  const [pernah, setPernah] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setPernah(true);
  }, [open]);
  return open || pernah ? <SheetIsi categories={categories} /> : null;
}
