"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { BellRing, LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { requestRestockAction } from "@/lib/account/actions";
import { useAccountStatus } from "@/lib/auth/client-status";

// "Kabari aku": pembeli harus masuk dulu; setelah masuk kembali ke halaman produk ini.
export function RestockDialog({ variantId, productName, shadeName, trigger }: { variantId: number; productName: string; shadeName: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [pending, start] = useTransition();
  const status = useAccountStatus();
  const loggedOut = needLogin || status?.loggedIn === false;
  const back = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
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
                {productName}, {shadeName}. Kami kirim satu pesan WhatsApp saat stok online masuk lagi. Di demo, pesannya masuk ke Kotak Notifikasi.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full text-abu-hangat hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {loggedOut ? (
            <div className="mt-5">
              <p className="text-sm text-kopi">Masuk dulu dengan nomor WhatsApp supaya kami tahu ke mana harus mengabari.</p>
              <Button asChild className="mt-4 w-full">
                <Link href={`/masuk?kembali=${encodeURIComponent(back)}`}>
                  <LogIn /> Masuk untuk dikabari
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-5">
              {error ? (
                <p className="mb-3 text-sm text-bahaya" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={pending || !status}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await requestRestockAction(variantId);
                    if (!r.ok) {
                      if (r.needLogin) setNeedLogin(true);
                      else setError(r.message);
                      return;
                    }
                    toast({ title: r.duplicate ? "Kamu sudah terdaftar" : "Siap, kami kabari", description: r.duplicate ? "Permintaan untuk shade ini sudah tercatat." : `Begitu ${shadeName} tersedia lagi. Lihat daftarnya di Akun, Kabari aku.`, tone: r.duplicate ? "info" : "sukses" });
                    setOpen(false);
                  })
                }
              >
                <BellRing /> {pending ? "Menyimpan..." : "Kabari aku"}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
