"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ClipboardList, Loader2, Package, Search, User } from "lucide-react";
import { adminSearchAction } from "@/lib/admin/actions";
import type { SearchHit } from "@/lib/admin/search";
import { cn } from "@/lib/utils";
import { namaEvent } from "@/config/merek";

const EVENT = namaEvent("admin-cari");
let open = false;
const set = (v: boolean) => {
  open = v;
  window.dispatchEvent(new Event(EVENT));
};
export const openAdminSearch = () => set(true);
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

const ICON = { pesanan: ClipboardList, produk: Package, pelanggan: User };
const GROUP = { pesanan: "Pesanan", produk: "Produk", pelanggan: "Pelanggan" };

// Pencarian global (Cmd+K di desktop, ikon cari di HP). Hasil sudah dibatasi izin dan lokasi di server.
export function AdminSearch() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      if (term.length < 2) {
        if (my === seq.current) setHits([]);
        return;
      }
      setLoading(true);
      const r = await adminSearchAction(term).catch(() => []);
      if (my === seq.current) {
        setHits(r);
        setActive(0);
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  const go = (h: SearchHit | undefined) => {
    if (!h) return;
    set(false);
    setQ("");
    router.push(h.href);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={set}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-3 top-16 z-50 mx-auto max-w-xl overflow-hidden rounded-card bg-putih shadow-lift outline-none">
          <Dialog.Title className="sr-only">Cari di admin</Dialog.Title>
          <Dialog.Description className="sr-only">Cari pesanan, produk, atau pelanggan.</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-garis px-4">
            <Search className="size-4 text-abu-hangat" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(hits.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") go(hits[active]);
              }}
              placeholder="Nomor pesanan, nama pembeli, produk, SKU..."
              aria-label="Kata kunci"
              className="h-12 w-full bg-transparent text-base text-kopi outline-none"
            />
            {loading ? <Loader2 className="size-4 animate-spin text-abu-hangat" /> : null}
          </div>
          <ul className="max-h-[60dvh] overflow-y-auto p-2" role="listbox" aria-label="Hasil pencarian">
            {hits.map((h, i) => {
              const Icon = ICON[h.kind];
              const first = i === 0 || hits[i - 1].kind !== h.kind;
              return (
                <li key={`${h.kind}-${h.href}-${i}`}>
                  {first ? <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{GROUP[h.kind]}</p> : null}
                  <button type="button" role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left", i === active ? "bg-blush/60" : "")}>
                    <Icon className="size-4 shrink-0 text-aksen" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-kopi">{h.title}</span>
                      <span className="block truncate text-xs text-abu-hangat">{h.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {q.trim().length >= 2 && !loading && hits.length === 0 ? <li className="px-3 py-6 text-center text-sm text-abu-hangat">Tidak ada hasil untuk &quot;{q.trim()}&quot;.</li> : null}
            {q.trim().length < 2 ? <li className="px-3 py-4 text-center text-xs text-abu-hangat">Ketik minimal 2 huruf. Hasil hanya dari data yang boleh kamu lihat.</li> : null}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
