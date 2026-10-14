"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { depthLabels, undertoneGuide } from "@/lib/shade";
import { saveQuizAction } from "@/lib/skin/actions";
import { BUDGET_OPTIONS, CONCERN_OPTIONS, ROUTINE_OPTIONS, SENSITIVITY_OPTIONS, SKIN_TYPE_OPTIONS } from "@/lib/skin/options";
import type { QuizAnswers } from "@/lib/skin/profile";
import { cn } from "@/lib/utils";

// Ilustrasi SVG buatan sendiri (wajah sederhana, bukan foto orang).
function FaceArt({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 80 80" className="size-14" aria-hidden>
      <ellipse cx="40" cy="42" rx="24" ry="29" fill="#EBC6A6" />
      <path d="M17 34c3-16 13-24 23-24s20 8 23 24c-6-8-14-11-23-11s-17 3-23 11z" fill="#3B2A24" />
      <circle cx="31" cy="42" r="2.2" fill="#3B2A24" />
      <circle cx="49" cy="42" r="2.2" fill="#3B2A24" />
      <path d="M34 56q6 4 12 0" stroke="#B8475D" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {kind === "berminyak" ? (
        <g fill="#FFFFFF" opacity="0.9">
          <ellipse cx="40" cy="30" rx="5" ry="2" />
          <ellipse cx="26" cy="50" rx="3.5" ry="1.6" />
          <ellipse cx="54" cy="50" rx="3.5" ry="1.6" />
          <ellipse cx="40" cy="48" rx="2" ry="3" />
        </g>
      ) : null}
      {kind === "kering" ? (
        <g stroke="#A6714E" strokeWidth="1.2" fill="none" strokeLinecap="round">
          <path d="M23 50l3 2-2 3" />
          <path d="M55 49l-3 2 2 3" />
          <path d="M37 29l3 1 2-2" />
        </g>
      ) : null}
      {kind === "kombinasi" ? <path d="M33 25h14v6h-4v18h-6V31h-4z" fill="#FFFFFF" opacity="0.55" /> : null}
      {kind === "sensitif" ? (
        <g fill="#E07A7A" opacity="0.55">
          <circle cx="26" cy="51" r="6" />
          <circle cx="54" cy="51" r="6" />
        </g>
      ) : null}
      {kind === "normal" ? <path d="M58 22l2 4 4 1-4 2-2 4-2-4-4-2 4-1z" fill="#E7B95B" /> : null}
    </svg>
  );
}

function Option({ selected, onClick, children, testId }: { selected: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} data-testid={testId} className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-putih p-3 text-left text-sm transition-colors", selected ? "border-kopi" : "border-garis hover:border-kopi/30")}>
      {children}
      {selected ? <Check className="ml-auto size-4 shrink-0 text-rona" aria-hidden /> : null}
    </button>
  );
}

const STEPS = ["Jenis kulit", "Masalah kulit", "Sensitivitas", "Budget", "Warna kulit", "Rutinitas sekarang"];

export function SkinQuiz({ initial }: { initial: QuizAnswers }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const set = (patch: Partial<QuizAnswers>) => setA((x) => ({ ...x, ...patch }));
  const ready = [Boolean(a.skinType), true, Boolean(a.sensitivity), Boolean(a.budget), Boolean(a.depth && a.undertone), Boolean(a.routine)][step];

  return (
    <div className="rounded-card border border-garis bg-porselen p-4 sm:p-6" data-testid="kuis-kulit">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-wide text-rona uppercase">
          Langkah {step + 1} dari {STEPS.length}
        </p>
        <h2 className="mt-1 font-serif text-2xl text-kopi">{["Jenis kulitmu yang mana?", "Apa yang ingin kamu perbaiki?", "Seberapa sering kulitmu bereaksi?", "Budget per produk?", "Warna kulitmu", "Rutinitasmu sekarang"][step]}</h2>
        <div className="mt-3 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-rona" : "bg-garis")} />
          ))}
        </div>
      </div>

      {step === 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {SKIN_TYPE_OPTIONS.map((o) => (
            <Option key={o.value} selected={a.skinType === o.value} onClick={() => set({ skinType: o.value })} testId={`kulit-${o.value}`}>
              <FaceArt kind={o.value} />
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-xs text-abu-hangat">{o.hint}</span>
              </span>
            </Option>
          ))}
        </div>
      ) : null}
      {step === 1 ? (
        <div>
          <p className="mb-2 text-sm text-abu-hangat">Pilih sampai 3, atau lewati bila tidak ada.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CONCERN_OPTIONS.map((o) => {
              const on = a.concerns?.includes(o.value) ?? false;
              return (
                <Option key={o.value} selected={on} onClick={() => set({ concerns: on ? (a.concerns ?? []).filter((x) => x !== o.value) : [...(a.concerns ?? []), o.value].slice(0, 3) })} testId={`masalah-${o.value}`}>
                  <span className="font-semibold">{o.label}</span>
                </Option>
              );
            })}
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="grid gap-2">
          {SENSITIVITY_OPTIONS.map((o) => (
            <Option key={o.value} selected={a.sensitivity === o.value} onClick={() => set({ sensitivity: o.value })} testId={`sensitif-${o.value}`}>
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-xs text-abu-hangat">{o.hint}</span>
              </span>
            </Option>
          ))}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {BUDGET_OPTIONS.map((o) => (
            <Option key={o.value} selected={a.budget === o.value} onClick={() => set({ budget: o.value })} testId={`budget-${o.value}`}>
              <span className="font-semibold">{o.label}</span>
            </Option>
          ))}
        </div>
      ) : null}
      {step === 4 ? (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Kedalaman (lihat rahang di cahaya alami)</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {depthLabels.map((d) => (
                <button key={d.depth} type="button" onClick={() => set({ depth: d.depth })} aria-pressed={a.depth === d.depth} data-testid={`kedalaman-${d.depth}`} className={cn("rounded-xl border-2 bg-putih p-2 text-center text-xs", a.depth === d.depth ? "border-kopi" : "border-garis")}>
                  <span className="mx-auto mb-1 block size-9 rounded-full border border-garis" style={{ background: d.hex }} aria-hidden />
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Undertone</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {undertoneGuide.map((u) => (
                <Option key={u.value} selected={a.undertone === u.value} onClick={() => set({ undertone: u.value })} testId={`undertone-${u.value}`}>
                  <span className="size-6 shrink-0 rounded-full border border-garis" style={{ background: u.hex }} aria-hidden />
                  <span>
                    <span className="block font-semibold">{u.label}</span>
                    <span className="block text-xs text-abu-hangat">{u.hint}</span>
                  </span>
                </Option>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {step === 5 ? (
        <div className="grid gap-2">
          {ROUTINE_OPTIONS.map((o) => (
            <Option key={o.value} selected={a.routine === o.value} onClick={() => set({ routine: o.value })} testId={`rutin-${o.value}`}>
              <span className="font-semibold">{o.label}</span>
            </Option>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft /> Kembali
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!ready}>
            {step === 1 && !(a.concerns ?? []).length ? "Lewati" : "Lanjut"} <ArrowRight />
          </Button>
        ) : (
          <Button
            disabled={!ready || pending}
            onClick={() =>
              run(async () => {
                setError(null);
                const r = await saveQuizAction(a);
                if (!r.ok) return setError(r.message ?? "Gagal menyimpan.");
                router.push("/rutinitas");
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null} Lihat rutinitasku
          </Button>
        )}
      </div>
      <p className="mt-3 text-[11px] text-abu-hangat">Hasil kuis dipakai untuk saran produk, bukan diagnosis. Untuk keluhan kulit serius, periksa ke dokter kulit.</p>
    </div>
  );
}
