"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartOff, Loader2 } from "lucide-react";
import { toggleWishlist } from "@/lib/cart/wishlist";

export function WishlistRemoveButton({ productId, name }: { productId: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await toggleWishlist(productId);
          router.refresh();
        })
      }
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-abu-hangat hover:text-bahaya"
      aria-label={`Hapus ${name} dari wishlist`}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <HeartOff className="size-3.5" />} Hapus
    </button>
  );
}
