"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";

const initial = ["Kulit berminyak", "Di bawah Rp 100.000", "Tersedia di cabang terdekat"];

export function ChipDemo() {
  const [active, setActive] = useState(initial);
  const [sub, setSub] = useState("Cushion");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["Semua", "Cushion", "Foundation", "Bedak", "Concealer"].map((s) => (
          <Chip key={s} selected={sub === s} onClick={() => setSub(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active.map((f) => (
          <Chip key={f} selected onRemove={() => setActive((a) => a.filter((x) => x !== f))}>
            {f}
          </Chip>
        ))}
        {active.length < initial.length ? (
          <button type="button" className="text-sm font-semibold text-aksen hover:underline" onClick={() => setActive(initial)}>
            Pulihkan filter
          </button>
        ) : null}
      </div>
    </div>
  );
}
