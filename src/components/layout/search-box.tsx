"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Tampilan dulu: saran instan hadir di fase 2.
export function SearchBox({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/cari?q=${encodeURIComponent(term)}` : "/cari");
      }}
    >
      <label htmlFor="search-box" className="sr-only">
        Cari produk, merek, atau kategori
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-abu-hangat" aria-hidden />
      <input
        id="search-box"
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Cari cushion, serum, lip tint..."
        className="h-11 w-full rounded-pill border border-garis bg-porselen pr-4 pl-11 text-sm text-kopi outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-abu-hangat/80 hover:border-kopi/25 focus:border-rona focus:bg-putih focus:shadow-ring"
      />
    </form>
  );
}
