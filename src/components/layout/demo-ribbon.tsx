"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

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

export function DemoRibbon() {
  // Server selalu merender pita; klien menyembunyikannya bila sudah ditutup di sesi ini.
  const closed = useSyncExternalStore(subscribe, readClosed, () => false);
  if (closed) return null;

  return (
    <div className="bg-kopi text-putih" role="note" aria-label="Pemberitahuan toko demo">
      <div className="container-rona flex h-9 items-center justify-between gap-3 text-xs sm:text-sm">
        <p className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-emas" aria-hidden />
          <span className="min-w-0 truncate">
            Ini toko demo. Produk, harga, dan pesanan fiktif.{" "}
            <Link href="/tentang-demo" className="font-semibold text-emas underline-offset-2 hover:underline">
              Tentang demo
            </Link>
          </span>
        </p>
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
