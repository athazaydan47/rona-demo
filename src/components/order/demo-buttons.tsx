"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tombol simulasi khusus DEMO_MODE. Route-nya sendiri juga menolak bila DEMO_MODE tidak aktif.
export function DemoActionButton({ endpoint, number, token, label, next }: { endpoint: "simulasi-bayar" | "simulasi-staf"; number: string; token: string; label: string; next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-card border border-dashed border-emas/70 bg-[#FBF4E6] p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#7A5A1E] uppercase">
        <FlaskConical className="size-3.5" aria-hidden /> Mode demo
      </p>
      <Button
        className="mt-2 w-full"
        variant="dark"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/demo/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomor: number, token }) });
            const data = (await res.json()) as { ok: boolean; message?: string };
            if (!data.ok) setError(data.message ?? "Simulasi gagal.");
            else if (next) router.push(next);
            else router.refresh();
          } catch {
            setError("Simulasi gagal. Coba lagi.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : null} {label}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
