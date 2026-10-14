"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { OPEN_EVENT, syncCart } from "@/lib/cart/client-cart";

// Laci keranjang dari kanan, terbuka setelah menambah produk. Bagian ini kecil: sinkronisasi awal keranjang dan
// pendengar event buka. Isi laci (Dialog, baris keranjang, ringkasan) dimuat terpisah (Fase 8B), lebih awal saat
// browser senggang supaya laci tetap terbuka cepat saat produk pertama ditambahkan.
const Panel = dynamic(() => import("./cart-drawer-panel").then((m) => m.CartDrawerPanel), { ssr: false });

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [bukaKe, setBukaKe] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    void syncCart();
    const onOpen = () => {
      setBukaKe((n) => n + 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    const muat = () => void import("./cart-drawer-panel");
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(muat, { timeout: 4000 }) : null;
    const timer = idle == null ? window.setTimeout(muat, 2500) : null;
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      if (idle != null) window.cancelIdleCallback(idle);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return bukaKe > 0 ? <Panel open={open} setOpen={setOpen} bukaKe={bukaKe} /> : null;
}
