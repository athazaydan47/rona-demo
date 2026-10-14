"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adjustPointsAction } from "@/lib/admin/moderation-actions";
import { formatNumber } from "@/lib/format";
import { fieldClass } from "./ui";

// Penyesuaian poin manual (izin pelanggan.poin). Saldo tidak boleh negatif; alasan wajib.
export function PointsAdjust({ customerId, balance }: { customerId: number; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const n = Number(amount);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (setOpen(o), setError(null))}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline">
          Sesuaikan poin
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
        <Dialog.Content className="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-md rounded-card bg-putih p-5 shadow-lift outline-none">
          <div className="flex items-start justify-between">
            <Dialog.Title className="font-serif text-xl">Sesuaikan poin</Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-abu-hangat">Saldo sekarang {formatNumber(balance)} poin. Isi angka negatif untuk mengurangi. Perubahan tercatat di buku poin dan log aktivitas.</Dialog.Description>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Jumlah poin</span>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, ""))} className={fieldClass} placeholder="Misal 500 atau -200" aria-label="Jumlah poin" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Alasan</span>
              <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} className={fieldClass} placeholder="Misal: kompensasi paket terlambat" aria-label="Alasan penyesuaian" />
            </label>
            {Number.isInteger(n) && n !== 0 ? <p className="text-sm text-abu-hangat">Saldo setelahnya: {formatNumber(balance + n)} poin</p> : null}
            {error ? (
              <p className="text-sm text-bahaya" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await adjustPointsAction(customerId, n, reason);
                  if (!r.ok) return setError(r.message);
                  setOpen(false);
                  setAmount("");
                  setReason("");
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Simpan
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
