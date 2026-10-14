"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ListChecks, Sparkles, X } from "lucide-react";
import { bacaPanduan, BUKA_EVENT, simpanPanduan } from "@/lib/demo/panduan";

const KEY = "rona.demo-ribbon.closed";
const EVENT = "rona:demo-ribbon";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readClosed() {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Pita demo: kalimat jujur yang ringkas, tautan Tentang demo, dan tombol Panduan (daftar centang 5 menit).
export function DemoRibbon() {
  // Server selalu merender pita; klien menyembunyikannya bila sudah ditutup di sesi ini.
  const closed = useSyncExternalStore(subscribe, readClosed, () => false);
  if (closed) return null;

  const openGuide = () => {
    simpanPanduan({ ...bacaPanduan(), tutup: false, pernahDibuka: true });
    window.dispatchEvent(new Event(BUKA_EVENT));
  };

  return (
    <div className="bg-kopi text-putih" role="note" aria-label="Pemberitahuan toko demo">
      <div className="container-rona flex h-9 items-center justify-between gap-3 text-xs sm:text-sm">
        <p className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-emas" aria-hidden />
          <span className="min-w-0 truncate">
            Toko demo: produk, harga, dan pesanan fiktif, direset tiap malam.{" "}
            <Link href="/tentang-demo" className="font-semibold text-emas underline-offset-2 hover:underline">
              Tentang demo
            </Link>
          </span>
        </p>
        <button type="button" onClick={openGuide} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-pill bg-putih/10 px-2.5 text-xs font-semibold text-putih hover:bg-putih/20" data-testid="buka-panduan">
          <ListChecks className="size-3.5" aria-hidden /> Panduan
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              window.sessionStorage.setItem(KEY, "1");
            } catch {
              // abaikan bila penyimpanan sesi diblokir
            }
            window.dispatchEvent(new Event(EVENT));
          }}
          className="grid size-7 shrink-0 place-items-center rounded-full text-putih/80 hover:bg-putih/10 hover:text-putih"
          aria-label="Tutup pemberitahuan demo"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
