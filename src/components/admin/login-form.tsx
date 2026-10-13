"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { demoStaffLoginAction, staffLoginAction } from "@/lib/admin/actions";

export function StaffLoginForm({ kembali }: { kembali: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await staffLoginAction({ email, password, kembali });
          if (!r.ok) setError(r.message);
          else window.location.assign(r.redirectTo);
        });
      }}
    >
      <div>
        <Label htmlFor="staf-email">Email</Label>
        <Input id="staf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <Label htmlFor="staf-sandi">Kata sandi</Label>
        <Input id="staf-sandi" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required aria-invalid={error ? true : undefined} />
        {error ? (
          <HelpText tone="error" role="alert">
            {error}
          </HelpText>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Masuk
      </Button>
    </form>
  );
}

// Tombol masuk cepat akun staf demo. Hanya dirender saat DEMO_MODE=true; aksinya juga menolak di luar demo.
export function DemoStaffButtons({ accounts, kembali = "/admin", compact = false }: { accounts: { email: string; label: string }[]; kembali?: string; compact?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className={compact ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-2"}>
        {accounts.map((a) => (
          <Button
            key={a.email}
            type="button"
            variant="outline"
            size={compact ? "md" : "md"}
            disabled={pending != null}
            onClick={async () => {
              setPending(a.email);
              setError(null);
              const r = await demoStaffLoginAction({ email: a.email, kembali });
              if (!r.ok) {
                setError(r.message);
                setPending(null);
              } else window.location.assign(r.redirectTo);
            }}
          >
            {pending === a.email ? <Loader2 className="animate-spin" /> : <FlaskConical />} {a.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
