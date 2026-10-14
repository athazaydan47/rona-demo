"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateBriefAction } from "@/lib/admin/kabar-actions";

export function CopyForWa({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      data-testid="salin-wa"
    >
      {done ? <Check /> : <Copy />} {done ? "Tersalin" : "Salin untuk WA"}
    </Button>
  );
}

export function RegenerateBrief() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, run] = useTransition();
  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-abu-hangat">{msg}</span> : null}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await regenerateBriefAction();
            setMsg(r.ok ? "Kabar kemarin diperbarui." : r.message);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Buat ulang kabar kemarin
      </Button>
    </div>
  );
}
