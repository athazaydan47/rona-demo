"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SkinProfile } from "@/db/schema/customers";
import { saveSkinProfileAction } from "@/lib/account/actions";
import { cn } from "@/lib/utils";

const GROUPS = {
  skinType: { label: "Jenis kulit", multi: false, options: [["normal", "Normal"], ["kering", "Kering"], ["berminyak", "Berminyak"], ["kombinasi", "Kombinasi"], ["sensitif", "Sensitif"]] },
  concerns: { label: "Masalah kulit (boleh lebih dari satu)", multi: true, options: [["jerawat", "Jerawat"], ["kusam", "Kusam"], ["pori", "Pori besar"], ["penuaan", "Garis halus"], ["dehidrasi", "Dehidrasi"]] },
  sensitivity: { label: "Seberapa sensitif kulitmu?", multi: false, options: [["rendah", "Jarang iritasi"], ["sedang", "Kadang"], ["tinggi", "Mudah iritasi"]] },
  undertone: { label: "Undertone", multi: false, options: [["warm", "Warm (kekuningan)"], ["neutral", "Neutral"], ["cool", "Cool (kemerahan)"]] },
  finish: { label: "Preferensi finish", multi: false, options: [["matte", "Matte"], ["satin", "Satin"], ["glowy", "Glowy"]] },
} as const;

type Key = keyof typeof GROUPS;

export function SkinProfileForm({ initial }: { initial: SkinProfile | null }) {
  const [v, setV] = useState<Record<Key, string | string[] | undefined>>({
    skinType: initial?.skinType,
    concerns: initial?.concerns ?? [],
    sensitivity: initial?.sensitivity,
    undertone: initial?.undertone,
    finish: initial?.finish,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (k: Key, value: string) => {
    setSaved(false);
    setV((cur) => {
      if (GROUPS[k].multi) {
        const list = (cur[k] as string[] | undefined) ?? [];
        return { ...cur, [k]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] };
      }
      return { ...cur, [k]: cur[k] === value ? undefined : value };
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await saveSkinProfileAction(v);
          if (!r.ok) setError(r.message);
          else setSaved(true);
        });
      }}
    >
      {(Object.keys(GROUPS) as Key[]).map((k) => {
        const g = GROUPS[k];
        return (
          <fieldset key={k} className="rounded-card border border-garis bg-putih p-5">
            <legend className="px-1 text-sm font-semibold text-kopi">{g.label}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.options.map(([value, label]) => {
                const on = g.multi ? ((v[k] as string[] | undefined) ?? []).includes(value) : v[k] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role={g.multi ? "checkbox" : "radio"}
                    aria-checked={on}
                    onClick={() => toggle(k, value)}
                    className={cn("inline-flex h-10 items-center gap-1.5 rounded-pill border px-4 text-sm transition-colors", on ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih text-kopi hover:border-kopi/30")}
                  >
                    {on ? <Check className="size-3.5" aria-hidden /> : null} {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {error ? (
        <p className="text-sm text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Simpan profil kulit
        </Button>
        {saved ? (
          <span className="text-sm text-sukses" role="status">
            Tersimpan. Rekomendasi dan ulasanmu akan memakai profil ini.
          </span>
        ) : null}
      </div>
    </form>
  );
}
