"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { BrandSummary } from "@/lib/catalog/queries";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function BrandDirectory({ brands }: { brands: BrandSummary[] }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = brands.filter((b) => !term || b.name.toLowerCase().includes(term) || b.tagline.toLowerCase().includes(term));
    const map = new Map<string, BrandSummary[]>();
    for (const b of list) {
      const letter = b.name[0].toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), b]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [brands, q]);
  const available = new Set(groups.map(([l]) => l));

  return (
    <div className="mt-6">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-abu-hangat" aria-hidden />
        <label htmlFor="brand-search" className="sr-only">
          Cari merek
        </label>
        <input id="brand-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari merek" className="h-11 w-full rounded-pill border border-garis bg-putih pr-4 pl-11 text-sm outline-none focus-visible:border-rona focus-visible:shadow-ring" />
      </div>
      <nav aria-label="Lompat ke huruf" className="mt-5">
        <ul className="flex flex-wrap gap-1">
          {LETTERS.map((l) => (
            <li key={l}>
              {available.has(l) ? (
                <a href={`#merek-${l}`} className="grid size-8 place-items-center rounded-full text-sm font-semibold text-kopi hover:bg-blush">
                  {l}
                </a>
              ) : (
                <span className="grid size-8 place-items-center text-sm text-abu-hangat/40" aria-hidden>
                  {l}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      {groups.length === 0 ? <p className="mt-8 text-sm text-abu-hangat">Tidak ada merek yang cocok dengan &ldquo;{q}&rdquo;.</p> : null}
      <div className="mt-6 space-y-8">
        {groups.map(([letter, list]) => (
          <section key={letter} id={`merek-${letter}`} className="scroll-mt-32">
            <h2 className="mb-3 font-serif text-2xl text-rona">{letter}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((b) => (
                <li key={b.id} className="min-w-0">
                  <Link href={`/merek/${b.slug}`} className={cn("group flex min-w-0 items-center gap-4 overflow-hidden rounded-card border border-garis bg-putih p-4 shadow-soft transition-[transform,box-shadow] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift")}>
                    <span className="grid size-12 shrink-0 place-items-center rounded-full font-serif text-xl text-putih" style={{ backgroundColor: b.color }} aria-hidden>
                      {b.name[0]}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-lg text-kopi group-hover:text-rona-gelap">{b.name}</span>
                      <span className="block truncate text-xs text-abu-hangat">{b.tagline}</span>
                      <span className="block truncate text-xs text-abu-hangat tabular-nums">
                        {b.productCount} produk · {formatRupiah(b.priceMin)} sampai {formatRupiah(b.priceMax)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
