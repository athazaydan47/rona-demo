"use client";

import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { Loader2, X } from "lucide-react";
import { Button } from "./button";
import { HelpText, Input, Label } from "./input";

// Dialog konfirmasi pengganti window.prompt/confirm. Bisa meminta isian (misal kata sandi atau kata RESET).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  input,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  input?: { label: string; type?: "text" | "password"; placeholder?: string; hint?: string; mustEqual?: string; minLength?: number };
  onConfirm: (value: string) => Promise<string | null | void>; // kembalikan pesan galat bila gagal
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = !input || (input.mustEqual ? value.trim().toUpperCase() === input.mustEqual : value.length >= (input.minLength ?? 1));
  const close = (o: boolean) => {
    if (!o) {
      setValue("");
      setError(null);
    }
    onOpenChange(o);
  };
  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
        <Dialog.Content className="fixed inset-x-3 top-[14dvh] z-50 mx-auto max-w-md rounded-card bg-putih p-5 shadow-lift outline-none">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-serif text-xl text-kopi">{title}</Dialog.Title>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description asChild>
            <div className="mt-1 text-sm text-abu-hangat">{description}</div>
          </Dialog.Description>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ready) return;
              start(async () => {
                setError(null);
                const r = await onConfirm(value);
                if (typeof r === "string" && r) setError(r);
                else close(false);
              });
            }}
          >
            {input ? (
              <div>
                <Label htmlFor="konfirmasi-isian">{input.label}</Label>
                <Input id="konfirmasi-isian" type={input.type ?? "text"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={input.placeholder} autoFocus autoComplete={input.type === "password" ? "new-password" : "off"} />
                {input.hint ? <HelpText>{input.hint}</HelpText> : null}
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-bahaya" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                Batal
              </Button>
              <Button type="submit" variant={danger ? "dark" : "primary"} disabled={!ready || pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} {confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
