"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { trackOrderAction, type VerifyState } from "@/lib/orders/actions";
import { contohNomorPesanan } from "@/config/merek";

export function TrackForm({ number }: { number?: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(trackOrderAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="lacak-nomor">Nomor pesanan</Label>
        <Input id="lacak-nomor" name="nomor" defaultValue={number} readOnly={Boolean(number)} placeholder={contohNomorPesanan()} autoCapitalize="characters" required />
      </div>
      <div>
        <Label htmlFor="lacak-wa">Nomor WhatsApp saat memesan</Label>
        <Input id="lacak-wa" name="wa" inputMode="tel" placeholder="0812 3456 7890" autoComplete="tel" required aria-invalid={state.error ? true : undefined} />
        {state.error ? (
          <HelpText tone="error" role="alert">
            {state.error}
          </HelpText>
        ) : (
          <HelpText>Kami cocokkan dengan nomor yang tercatat di pesanan.</HelpText>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <Search /> {number ? "Buka pesanan" : "Lacak pesanan"}
      </Button>
    </form>
  );
}
