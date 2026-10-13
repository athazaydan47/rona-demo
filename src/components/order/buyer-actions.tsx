"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmReceivedAction } from "@/lib/account/actions";

// "Pesanan diterima": Dikirim menjadi Selesai lewat state machine (hanya pemilik, dicek di server).
export function ConfirmReceivedButton({ number }: { number: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await confirmReceivedAction(number);
            if (!r.ok) setError(r.message);
            else router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <PackageCheck />} Pesanan diterima
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
