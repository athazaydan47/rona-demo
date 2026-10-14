"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Clock, Search, TrendingUp, X } from "lucide-react";
import { useAiStatus } from "@/components/ai/ai-status";
import { ProductArt } from "@/components/product-art";
import { formatRupiah } from "@/lib/format";
import type { SearchSuggestions } from "@/lib/catalog/catalog-queries";
import { cn } from "@/lib/utils";

const RECENT_KEY = "rona.search.recent";
const POPULAR = ["cushion", "sunscreen", "lip tint", "serum niacinamide", "parfum"];

type Item = { kind: "produk" | "merek" | "kategori" | "riwayat" | "populer" | "cari"; label: string; href: string; meta?: string; art?: SearchSuggestions["products"][number] };

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(term: string) {
  const t = term.trim();
  if (!t) return;
  try {
    const next = [t, ...readRecent().filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // abaikan
  }
}

// Kotak pencarian dengan saran instan (debounce 200 ms), dikelompokkan, dan bisa dinavigasi keyboard.
export function SearchBox({ className, autoFocus = false, initialQuery = "" }: { className?: string; autoFocus?: boolean; initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const listId = useId();
  const ai = useAiStatus();

  // Debounce 200 ms; state hanya diubah dari callback (timer dan fetch), bukan langsung di badan effect.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const t = window.setTimeout(() => {
      fetch(`/api/cari/saran?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: SearchSuggestions) => {
          setSuggestions(data);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = q.trim();
  const items: Item[] = [];
  if (term.length >= 2 && suggestions) {
    for (const p of suggestions.products) items.push({ kind: "produk", label: p.name, href: `/p/${p.slug}`, meta: p.brandName, art: p });
    for (const b of suggestions.brands) items.push({ kind: "merek", label: b.name, href: `/merek/${b.slug}` });
    for (const c of suggestions.categories) items.push({ kind: "kategori", label: c.parentName ? `${c.name} di ${c.parentName}` : c.name, href: c.parentSlug ? `/c/${c.parentSlug}/${c.slug}` : `/c/${c.slug}` });
    items.push({ kind: "cari", label: `Cari semua untuk "${term}"`, href: `/cari?q=${encodeURIComponent(term)}` });
  } else if (term.length < 2) {
    for (const r of recent) items.push({ kind: "riwayat", label: r, href: `/cari?q=${encodeURIComponent(r)}` });
    for (const p of POPULAR) if (!recent.includes(p)) items.push({ kind: "populer", label: p, href: `/cari?q=${encodeURIComponent(p)}` });
  }

  const go = useCallback(
    (href: string, remember?: string) => {
      if (remember) rememberSearch(remember);
      setOpen(false);
      setActive(-1);
      router.push(href);
    },
    [router],
  );

  const submit = () => {
    if (active >= 0 && items[active]) {
      const it = items[active];
      go(it.href, it.kind === "produk" || it.kind === "merek" || it.kind === "kategori" ? undefined : it.label.replace(/^Cari semua untuk "|"$/g, ""));
      return;
    }
    go(term ? `/cari?q=${encodeURIComponent(term)}` : "/cari", term);
  };

  const groups: { key: Item["kind"]; title: string }[] =
    term.length >= 2
      ? [
          { key: "produk", title: "Produk" },
          { key: "merek", title: "Merek" },
          { key: "kategori", title: "Kategori" },
          { key: "cari", title: "" },
        ]
      : [
          { key: "riwayat", title: "Pencarian terakhir" },
          { key: "populer", title: "Populer" },
        ];

  const showPanel = open && (items.length > 0 || (term.length >= 2 && (loading || suggestions !== null)));

  return (
    <form
      ref={rootRef}
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
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
        onChange={(e) => {
          const value = e.target.value;
          setQ(value);
          setActive(-1);
          setOpen(true);
          if (value.trim().length < 2) {
            setSuggestions(null);
            setLoading(false);
          } else {
            setLoading(true);
          }
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (items.length ? (a + 1) % items.length : -1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (items.length ? (a - 1 + items.length) % items.length : -1));
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        placeholder="Cari cushion, serum, lip tint..."
        className="h-11 w-full rounded-pill border border-garis bg-porselen pr-10 pl-11 text-sm text-kopi outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-abu-hangat/80 hover:border-kopi/25 focus:border-rona focus:bg-putih focus:shadow-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {q ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setActive(-1);
          }}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-abu-hangat hover:bg-porselen"
          aria-label="Kosongkan pencarian"
        >
          <X className="size-4" />
        </button>
      ) : ai.tersedia ? (
        <Link
          href="/cari-dari-video"
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-abu-hangat hover:bg-porselen hover:text-rona"
          aria-label="Cari dari video atau screenshot (opsional)"
          title="Cari dari video atau screenshot"
          data-testid="ikon-cari-video"
        >
          <Clapperboard className="size-4" />
        </Link>
      ) : null}

      {showPanel ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-card border border-garis bg-putih shadow-lift">
          <ul id={listId} role="listbox" aria-label="Saran pencarian" className="max-h-[70vh] overflow-y-auto py-2">
            {term.length >= 2 && loading && !suggestions ? <li className="px-4 py-2 text-sm text-abu-hangat">Mencari...</li> : null}
            {groups.map((g) => {
              const groupItems = items.map((it, idx) => ({ it, idx })).filter(({ it }) => it.kind === g.key);
              if (groupItems.length === 0) return null;
              return (
                <li key={g.key} role="presentation">
                  {g.title ? <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{g.title}</p> : null}
                  <ul role="group" aria-label={g.title || undefined}>
                    {groupItems.map(({ it, idx }) => {
                      const selected = idx === active;
                      return (
                        <li key={`${it.kind}-${it.href}`} id={`${listId}-${idx}`} role="option" aria-selected={selected}>
                          <Link
                            href={it.href}
                            onMouseEnter={() => setActive(idx)}
                            onClick={(e) => {
                              e.preventDefault();
                              go(it.href, it.kind === "riwayat" || it.kind === "populer" ? it.label : it.kind === "cari" ? term : undefined);
                            }}
                            className={cn("flex items-center gap-3 px-4 py-2 text-sm text-kopi", selected ? "bg-blush/60" : "hover:bg-porselen", it.kind === "cari" && "mt-1 border-t border-garis pt-3 font-semibold text-rona")}
                            tabIndex={-1}
                          >
                            {it.kind === "produk" && it.art ? (
                              <span className="w-10 shrink-0 overflow-hidden rounded-lg">
                                <ProductArt packaging={it.art.packaging} shade={it.art.hex} brandColor={it.art.brandColor} brandName={it.art.brandName} title="" />
                              </span>
                            ) : null}
                            {it.kind === "riwayat" ? <Clock className="size-4 shrink-0 text-abu-hangat" aria-hidden /> : null}
                            {it.kind === "populer" ? <TrendingUp className="size-4 shrink-0 text-abu-hangat" aria-hidden /> : null}
                            {it.kind === "merek" || it.kind === "kategori" || it.kind === "cari" ? <Search className="size-4 shrink-0 text-abu-hangat" aria-hidden /> : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{it.label}</span>
                              {it.meta ? <span className="block truncate text-xs text-abu-hangat">{it.meta}</span> : null}
                            </span>
                            {it.art ? <span className="shrink-0 text-xs font-semibold tabular-nums">{formatRupiah(it.art.price)}</span> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
            {term.length >= 2 && !loading && suggestions && suggestions.products.length === 0 && suggestions.brands.length === 0 && suggestions.categories.length === 0 ? (
              <li className="px-4 py-2 text-sm text-abu-hangat">Belum ada yang cocok. Tekan Enter untuk mencari semua.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
