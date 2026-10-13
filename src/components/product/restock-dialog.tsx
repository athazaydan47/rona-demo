"use client";

import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { requestRestock } from "@/lib/product/actions";

export function RestockDialog({ variantId, productName, shadeName, trigger }: { variantId: number; productName: string; shadeName: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] bg-putih p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-lift outline-none md:inset-auto md:top-1/2 md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-serif text-2xl text-kopi">Kabari aku saat tersedia</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-abu-hangat">
                {productName}, {shadeName}. Kami kirim satu pesan saat stoknya masuk lagi. Di demo, pesan hanya masuk ke Kotak Notifikasi.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              start(async () => {
                const r = await requestRestock({ variantId, contact });
                if (!r.ok) {
                  setError(r.message);
                  return;
                }
                toast({ title: r.duplicate ? "Kamu sudah terdaftar" : "Siap, kami kabari", description: r.duplicate ? "Permintaan untuk shade ini sudah tercatat sebelumnya." : `Begitu ${shadeName} tersedia lagi.`, tone: r.duplicate ? "info" : "sukses" });
                setOpen(false);
                setContact("");
              });
            }}
          >
            <Label htmlFor="restock-contact">Nomor WhatsApp atau email</Label>
            <Input id="restock-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="08xx atau nama@email.com" autoComplete="tel" aria-invalid={error ? true : undefined} />
            {error ? <HelpText tone="error">{error}</HelpText> : <HelpText>Satu permintaan per kontak untuk tiap shade.</HelpText>}
            <Button type="submit" className="mt-4 w-full" disabled={pending}>
              <BellRing /> {pending ? "Menyimpan..." : "Kabari aku"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
