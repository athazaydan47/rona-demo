"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { requestLoginOtpAction, setNameAction, verifyLoginOtpAction } from "@/lib/auth/actions";
import { clearLocalWishlist, readLocalWishlist } from "@/lib/cart/wishlist";
import { DemoLoginButton } from "./demo-login-button";

type Step = "nomor" | "kode" | "nama";

function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export function LoginFlow({ kembali, demo, initialStep = "nomor" }: { kembali: string; demo: boolean; initialStep?: Step }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ phone: string; masked: string; demoCode: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState(kembali);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);
  const wait = useCountdown(resendAt);

  const finish = (to: string) => {
    clearLocalWishlist();
    window.location.assign(to);
  };

  const send = () =>
    start(async () => {
      setError(null);
      const r = await requestLoginOtpAction({ phone: sent?.phone ?? phone });
      if (!r.ok) {
        setError(r.message);
        if (r.retryAfterSec) setResendAt(Date.now() + r.retryAfterSec * 1000);
        return;
      }
      setSent({ phone: r.phone, masked: r.masked, demoCode: r.demoCode });
      setResendAt(new Date(r.resendAt).getTime());
      setCode("");
      setStep("kode");
      window.setTimeout(() => codeRef.current?.focus(), 50);
    });

  const verify = (value: string) =>
    start(async () => {
      if (!sent) return;
      setError(null);
      const r = await verifyLoginOtpAction({ phone: sent.phone, code: value, kembali, guestWishlist: readLocalWishlist() });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (r.needsName) {
        clearLocalWishlist();
        setRedirectTo(r.redirectTo);
        setStep("nama");
        return;
      }
      finish(r.redirectTo);
    });

  const saveName = () =>
    start(async () => {
      setError(null);
      const r = await setNameAction({ name });
      if (!r.ok) setError(r.message ?? "Nama belum valid.");
      else finish(redirectTo);
    });

  return (
    <div className="rounded-card border border-garis bg-putih p-6 shadow-soft md:p-8">
      {step === "nomor" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <h1 className="font-serif text-3xl text-kopi">Masuk atau daftar</h1>
          <p className="mt-1 text-sm text-abu-hangat">Pakai nomor WhatsApp. Kami kirim kode 6 angka, tanpa kata sandi.</p>
          <div className="mt-6">
            <Label htmlFor="masuk-wa">Nomor WhatsApp</Label>
            <Input id="masuk-wa" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" aria-invalid={error ? true : undefined} aria-describedby={error ? "masuk-error" : undefined} />
            {error ? (
              <HelpText tone="error" id="masuk-error" role="alert">
                {error}
              </HelpText>
            ) : null}
          </div>
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending || phone.trim().length < 8}>
            {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />} Kirim kode lewat WhatsApp
          </Button>
          {demo ? (
            <div className="mt-6 border-t border-garis pt-6">
              <p className="mb-3 text-center text-xs text-abu-hangat">Mau langsung coba? Akun demo sudah berisi pesanan, poin, dan wishlist.</p>
              <DemoLoginButton kembali={kembali} />
            </div>
          ) : null}
        </form>
      ) : null}

      {step === "kode" && sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(code);
          }}
        >
          <button type="button" onClick={() => setStep("nomor")} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
            <ArrowLeft className="size-4" /> Ganti nomor
          </button>
          <h1 className="font-serif text-3xl text-kopi">Masukkan kode</h1>
          <p className="mt-1 text-sm text-abu-hangat">Kode 6 angka sudah dikirim ke WhatsApp {sent.masked}. Berlaku 5 menit.</p>
          {sent.demoCode ? (
            <div className="mt-4 rounded-card border border-dashed border-emas/70 bg-[#FBF4E6] p-4" role="status">
              <p className="text-xs font-semibold tracking-wide text-[#7A5A1E] uppercase">Mode demo: WhatsApp disimulasikan</p>
              <p className="mt-1 text-sm text-kopi">
                Kode OTP kamu{" "}
                <button type="button" className="font-mono text-lg font-bold tracking-[0.3em] text-kopi underline decoration-dotted" onClick={() => setCode(sent.demoCode!)} data-testid="otp-demo">
                  {sent.demoCode}
                </button>
              </p>
              <p className="mt-1 text-xs text-abu-hangat">Pesan yang sama juga masuk ke Kotak Notifikasi akunmu.</p>
            </div>
          ) : null}
          <div className="mt-5">
            <Label htmlFor="masuk-kode">Kode OTP</Label>
            <Input
              ref={codeRef}
              id="masuk-kode"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6 && !pending) verify(v);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              className="text-center font-mono text-xl tracking-[0.5em]"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "kode-error" : undefined}
            />
            {error ? (
              <HelpText tone="error" id="kode-error" role="alert">
                {error}
              </HelpText>
            ) : null}
          </div>
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending || code.length !== 6}>
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Masuk
          </Button>
          <p className="mt-4 text-center text-sm text-abu-hangat">
            Belum dapat kode?{" "}
            {wait > 0 ? (
              <span className="tabular-nums">Kirim ulang dalam {wait} detik</span>
            ) : (
              <button type="button" onClick={send} disabled={pending} className="font-semibold text-rona hover:underline">
                Kirim ulang
              </button>
            )}
          </p>
        </form>
      ) : null}

      {step === "nama" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <h1 className="font-serif text-3xl text-kopi">Senang kenalan!</h1>
          <p className="mt-1 text-sm text-abu-hangat">Akunmu sudah jadi. Kami panggil kamu siapa?</p>
          <div className="mt-6">
            <Label htmlFor="masuk-nama">Nama</Label>
            <Input id="masuk-nama" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus aria-invalid={error ? true : undefined} />
            {error ? (
              <HelpText tone="error" role="alert">
                {error}
              </HelpText>
            ) : null}
          </div>
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending || name.trim().length < 2}>
            {pending ? <Loader2 className="animate-spin" /> : null} Simpan dan lanjut
          </Button>
        </form>
      ) : null}
    </div>
  );
}
