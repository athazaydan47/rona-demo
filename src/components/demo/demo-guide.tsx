"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ListChecks, X } from "lucide-react";
import { bacaPanduan, BUKA_EVENT, LANGKAH, langkahDariUrl, PANDUAN_EVENT, simpanPanduan, tandaiLangkah, type LangkahId, type PanduanState } from "@/lib/demo/panduan";
import { cn } from "@/lib/utils";
import { MEREK } from "@/config/merek";

const EMPTY: PanduanState = { selesai: [], tutup: false, pernahDibuka: false };
let cache: PanduanState | null = null;
function subscribe(cb: () => void) {
  const on = () => {
    cache = null;
    cb();
  };
  window.addEventListener(PANDUAN_EVENT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(PANDUAN_EVENT, on);
    window.removeEventListener("storage", on);
  };
}
const read = () => (cache ??= bacaPanduan());

// Panel panduan demo: dibuka dari pita demo, daftar centang mengikuti skenario 5 menit, tercentang otomatis saat
// halamannya dibuka atau aksinya dilakukan, bisa ditutup kapan saja. Hanya dirender saat DEMO_MODE.
export function DemoGuide() {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(BUKA_EVENT, onOpen);
    return () => window.removeEventListener(BUKA_EVENT, onOpen);
  }, []);

  // Centang otomatis dari alamat halaman (hanya setelah panduan pernah dibuka, supaya tidak mencatat diam-diam).
  const searchStr = search.toString();
  useEffect(() => {
    if (!read().pernahDibuka) return;
    for (const id of langkahDariUrl(pathname, searchStr)) tandaiLangkah(id);
  }, [pathname, searchStr]);

  if (!open) return null;
  const done = new Set(state.selesai);
  const toggle = (id: LangkahId) => {
    const cur = bacaPanduan();
    const selesai = cur.selesai.includes(id) ? cur.selesai.filter((x) => x !== id) : [...cur.selesai, id];
    simpanPanduan({ ...cur, selesai, pernahDibuka: true });
  };
  const close = () => {
    simpanPanduan({ ...bacaPanduan(), tutup: true, pernahDibuka: true });
    setOpen(false);
  };
  return (
    <aside className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[55] max-h-[70dvh] overflow-y-auto rounded-card border border-garis bg-putih p-4 shadow-lift animate-muncul md:inset-x-auto md:right-6 md:bottom-6 md:w-96" aria-label="Panduan demo" data-testid="panduan-demo" data-tanda-demo>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-aksen uppercase">
            <ListChecks className="size-3.5" aria-hidden /> Panduan demo 5 menit
          </p>
          <p className="mt-1 text-sm text-abu-hangat">
            {done.size} dari {LANGKAH.length} langkah. Tercentang sendiri saat kamu melakukannya.
          </p>
        </div>
        <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup panduan demo">
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {LANGKAH.map((l, i) => {
          const ok = done.has(l.id);
          return (
            <li key={l.id} className={cn("flex items-start gap-2.5 rounded-lg px-2 py-1.5", ok && "bg-[#EEF7F1]")}>
              <button type="button" role="checkbox" aria-checked={ok} onClick={() => toggle(l.id)} aria-label={`${ok ? "Batal tandai" : "Tandai"} langkah ${i + 1}: ${l.judul}`} className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors", ok ? "border-sukses bg-sukses text-putih" : "border-garis bg-putih")}>
                {ok ? <Check className="size-3.5" aria-hidden /> : null}
              </button>
              <div className="min-w-0 text-sm">
                <p className={cn("font-medium text-kopi", ok && "line-through decoration-sukses/60")}>
                  {i + 1}. {l.href ? (
                    <Link href={l.href} className="hover:underline">
                      {l.judul}
                    </Link>
                  ) : (
                    l.judul
                  )}
                </p>
                <p className="text-xs text-abu-hangat">{l.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {done.size === LANGKAH.length ? <p className="mt-3 rounded-lg bg-blush px-3 py-2 text-sm font-semibold text-aksen-gelap">Semua langkah selesai. Terima kasih sudah mencoba {MEREK.nama}.</p> : null}
    </aside>
  );
}
