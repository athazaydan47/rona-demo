"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { orderStatusAction } from "@/lib/orders/actions";

// Memantau status pembayaran tiap 4 detik; pindah ke halaman sukses saat dibayar, muat ulang bila dibatalkan.
export function PaymentWatcher({ number, token, successHref }: { number: string; token: string; successHref: string }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const r = await orderStatusAction(number, token).catch(() => null);
      if (stopped || !r) return;
      if (r.status === "menunggu_pembayaran") return;
      stopped = true;
      if (r.status === "dibatalkan") router.refresh();
      else router.push(successHref);
    };
    const t = window.setInterval(tick, 4000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [number, token, successHref, router]);
  return null;
}
