"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { updateProfileAction } from "@/lib/account/actions";
import { requestPhoneChangeOtpAction, verifyPhoneChangeAction } from "@/lib/auth/actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [v, setV] = useState({ name, email });
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="rounded-card border border-garis bg-putih p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfileAction(v);
          setMsg(r.ok ? { ok: true, text: "Profil tersimpan." } : { ok: false, text: r.message, field: r.field });
          if (r.ok) router.refresh();
        });
      }}
    >
      <h2 className="font-serif text-xl text-kopi">Data diri</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pf-nama">Nama</Label>
          <Input id="pf-nama" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" aria-invalid={msg?.field === "name" ? true : undefined} />
          {msg?.field === "name" ? <HelpText tone="error">{msg.text}</HelpText> : null}
        </div>
        <div>
          <Label htmlFor="pf-email">Email (opsional)</Label>
          <Input id="pf-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" aria-invalid={msg?.field === "email" ? true : undefined} />
          {msg?.field === "email" ? <HelpText tone="error">{msg.text}</HelpText> : <HelpText>Untuk salinan kabar pesanan lewat email.</HelpText>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Simpan
        </Button>
        {msg && !msg.field ? (
          <span className={msg.ok ? "text-sm text-sukses" : "text-sm text-bahaya"} role="status">
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

// Ganti nomor WA: OTP dikirim ke nomor baru; akun berubah setelah kode benar.
export function PhoneChange({ current }: { current: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ phone: string; masked: string; demoCode: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-card border border-garis bg-putih p-5">
      <h2 className="font-serif text-xl text-kopi">Nomor WhatsApp</h2>
      <p className="mt-1 text-sm text-abu-hangat">
        Sekarang: <span className="font-semibold text-kopi tabular-nums">{current}</span>. Untuk mengganti, kami kirim kode ke nomor baru.
      </p>
      {!sent ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await requestPhoneChangeOtpAction({ phone });
              if (!r.ok) setMsg({ ok: false, text: r.message });
              else setSent({ phone: r.phone, masked: r.masked, demoCode: r.demoCode });
            });
          }}
        >
          <label htmlFor="pf-wa-baru" className="sr-only">
            Nomor WhatsApp baru
          </label>
          <Input id="pf-wa-baru" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Nomor WhatsApp baru" />
          <Button type="submit" variant="outline" disabled={pending || phone.trim().length < 8}>
            {pending ? <Loader2 className="animate-spin" /> : null} Kirim kode
          </Button>
        </form>
      ) : (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await verifyPhoneChangeAction({ phone: sent.phone, code });
              if (!r.ok) setMsg({ ok: false, text: r.message ?? "Kode salah." });
              else {
                setMsg({ ok: true, text: "Nomor WhatsApp berhasil diganti." });
                setSent(null);
                setPhone("");
                setCode("");
                router.refresh();
              }
            });
          }}
        >
          <p className="text-sm text-kopi">Kode dikirim ke {sent.masked}.</p>
          {sent.demoCode ? (
            <p className="rounded-xl bg-[#FBF4E6] px-3 py-2 text-sm text-kopi">
              Mode demo: kode OTP <span className="font-mono font-bold tracking-widest">{sent.demoCode}</span>
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="pf-kode" className="sr-only">
              Kode OTP
            </label>
            <Input id="pf-kode" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Kode 6 angka" />
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending ? <Loader2 className="animate-spin" /> : null} Ganti nomor
            </Button>
          </div>
          <button type="button" className="text-xs font-semibold text-rona hover:underline" onClick={() => setSent(null)}>
            Batal
          </button>
        </form>
      )}
      {msg ? (
        <p className={msg.ok ? "mt-2 text-sm text-sukses" : "mt-2 text-sm text-bahaya"} role="status">
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
