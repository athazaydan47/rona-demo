"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoLoginAction } from "@/lib/auth/actions";
import { clearLocalWishlist, readLocalWishlist } from "@/lib/cart/wishlist";

// Masuk sebagai Pembeli Demo tanpa OTP. Hanya dirender saat DEMO_MODE=true; aksinya juga menolak di luar demo.
export function DemoLoginButton({ kembali = "/akun", variant = "secondary", className }: { kembali?: string; variant?: "secondary" | "outline" | "dark"; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={className}>
      <Button
        variant={variant}
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await demoLoginAction({ kembali, guestWishlist: readLocalWishlist() });
            if (!r.ok) {
              setError(r.message);
              return;
            }
            clearLocalWishlist();
            // Muat ulang penuh supaya header, keranjang, dan wishlist membaca sesi baru.
            window.location.assign(r.redirectTo);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <FlaskConical />} Masuk sebagai Pembeli Demo
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
