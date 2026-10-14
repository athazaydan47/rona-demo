"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { changeOrderStatusAction } from "@/lib/admin/actions";
import type { MovePlan } from "@/lib/admin/kanban";
import type { OrderStatus } from "@/lib/orders/status";

export type PendingChange = { number: string; from: OrderStatus; to: OrderStatus; plan: Extract<MovePlan, { ok: true }>; courier?: string | null };

const COURIERS = ["JNE", "J&T Express", "SiCepat", "Kurir Instan", "AnterAja", "Pos Indonesia"];

// Jalankan perubahan status. Transisi yang butuh isian (resi atau alasan) membuka dialog dulu.
export function useStatusChange(onDone?: (ok: boolean, message?: string) => void) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (c: PendingChange, extra: { reason?: string; trackingNumber?: string; courierName?: string } = {}) =>
    start(async () => {
      setError(null);
      const r = await changeOrderStatusAction({ number: c.number, from: c.from, to: c.to, ...extra });
      if (!r.ok) {
        setError(r.message);
        onDone?.(false, r.message);
        // Status sudah diubah staf lain: muat ulang supaya tampilan sesuai database.
        if ("code" in r && r.code === "tabrakan") {
          setPending(null);
          router.refresh();
        }
        return;
      }
      setPending(null);
      onDone?.(true);
      router.refresh();
    });

  const request = (c: PendingChange) => {
    setError(null);
    if (c.plan.needs) setPending(c);
    else run(c);
  };

  const dialog = <StatusDialog change={pending} busy={busy} error={error} onClose={() => setPending(null)} onSubmit={(extra) => pending && run(pending, extra)} />;
  return { request, busy, error, dialog, clearError: () => setError(null) };
}

function StatusDialog({ change, busy, error, onClose, onSubmit }: { change: PendingChange | null; busy: boolean; error: string | null; onClose: () => void; onSubmit: (extra: { reason?: string; trackingNumber?: string; courierName?: string }) => void }) {
  const [reason, setReason] = useState("");
  const [resi, setResi] = useState("");
  const [courier, setCourier] = useState("");
  const courierValue = courier || change?.courier || "JNE";
  return (
    <Dialog.Root open={change != null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
        <Dialog.Content className="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-md rounded-card bg-putih p-5 shadow-lift outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-serif text-xl text-kopi">{change?.plan.label}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-abu-hangat">Pesanan {change?.number}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (change?.plan.needs === "resi") onSubmit({ trackingNumber: resi, courierName: courierValue });
              else onSubmit({ reason });
            }}
          >
            {change?.plan.needs === "resi" ? (
              <>
                <div>
                  <Label htmlFor="kirim-kurir">Kurir</Label>
                  <select id="kirim-kurir" value={courierValue} onChange={(e) => setCourier(e.target.value)} className="h-11 w-full rounded-pill border border-garis bg-putih px-4 text-base text-kopi">
                    {[...new Set([change.courier ?? "", ...COURIERS].filter(Boolean))].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="kirim-resi">Nomor resi</Label>
                  <Input id="kirim-resi" value={resi} onChange={(e) => setResi(e.target.value.toUpperCase())} placeholder="Misal JNE1234567890" autoFocus />
                  <HelpText>Pembeli melihat resi ini di halaman pesanan dan di pesan WhatsApp.</HelpText>
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="ubah-alasan">Alasan</Label>
                <textarea id="ubah-alasan" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={3} autoFocus placeholder="Misal: pembeli minta batal lewat WhatsApp" className="w-full rounded-[14px] border border-garis bg-putih px-4 py-3 text-base text-kopi outline-none focus-visible:border-aksen" />
                <HelpText>{change?.to === "dibatalkan" ? "Stok, kuota flash sale, voucher, dan poin dikembalikan otomatis. Pembeli dikabari." : "Dicatat di riwayat pesanan."}</HelpText>
              </div>
            )}
            {error ? (
              <p className="text-sm text-bahaya" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" variant={change?.to === "dibatalkan" ? "dark" : "primary"} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} {change?.plan.label}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
