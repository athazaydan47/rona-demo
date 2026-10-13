import { useId } from "react";
import { darken, lighten, readableOn } from "@/lib/color";
import { cn } from "@/lib/utils";

type Shade = { id: number; shadeName: string; hex: string };

// Lembar perbandingan beberapa shade berdampingan: olesan vertikal dengan nama, shade terpilih ditandai.
export function ShadeLineupArt({ shades, selectedId, className, title }: { shades: Shade[]; selectedId?: number; className?: string; title?: string }) {
  const id = `sl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const list = pickAround(shades, selectedId, 7);
  const w = 200;
  const h = 240;
  const gap = 6;
  const colW = (w - 24 - gap * (list.length - 1)) / Math.max(1, list.length);
  const label = title ?? `Perbandingan ${list.length} shade`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={cn("block h-auto w-full select-none", className)} style={{ aspectRatio: "5 / 6" }}>
      <title>{label}</title>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="30%" r="85%">
          <stop offset="0" stopColor="#FFFDFB" />
          <stop offset="1" stopColor="#F1E9E4" />
        </radialGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={w} height={h} rx="16" fill={`url(#${id}-bg)`} />
      {list.map((s, i) => {
        const x = 12 + i * (colW + gap);
        const selected = s.id === selectedId;
        const top = selected ? 40 : 56;
        const bottom = 176;
        const d = `M${x + 2} ${top + 8} Q${x + colW / 2} ${top - 6} ${x + colW - 2} ${top + 8} L${x + colW - 1} ${bottom - 10} Q${x + colW / 2} ${bottom + 8} ${x + 1} ${bottom - 10} Z`;
        return (
          <g key={s.id}>
            <path d={d} fill="#2A1F1D" opacity="0.18" transform="translate(1.5 4)" filter={`url(#${id}-blur)`} />
            <path d={d} fill={s.hex} />
            <path d={d} fill={`url(#${id}-sheen)`} />
            <path d={`M${x + colW * 0.28} ${top + 16} Q${x + colW * 0.3} ${(top + bottom) / 2} ${x + colW * 0.26} ${bottom - 18}`} stroke={lighten(s.hex, 0.4)} strokeWidth={Math.max(1.2, colW * 0.12)} strokeLinecap="round" fill="none" opacity="0.6" />
            {selected ? <path d={d} fill="none" stroke={darken(s.hex, 0.35)} strokeWidth="1.5" /> : null}
            {selected ? (
              <>
                <rect x={x + colW / 2 - 9} y={top - 22} width={18} height={12} rx={6} fill="#2A1F1D" />
                <path d={`M${x + colW / 2 - 4} ${top - 16} l3 3 l5 -5`} stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}
            <text x={x + colW / 2} y={bottom + 24} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize={list.length > 5 ? 5.6 : 6.4} fontWeight={selected ? 700 : 500} fill={selected ? "#2A1F1D" : "#6E615D"}>
              {shortName(s.shadeName, list.length > 5 ? 9 : 12)}
            </text>
          </g>
        );
      })}
      <text x={w / 2} y={h - 14} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize="6" letterSpacing="1.2" fill={readableOn("#F1E9E4", "#6E615D", "#FFFFFF")}>
        {`${shades.length} SHADE`}
      </text>
    </svg>
  );
}

function shortName(name: string, max: number) {
  const clean = name.replace(/^\d+[A-Z]?\s+/, "");
  return clean.length > max ? `${clean.slice(0, max - 1)}.` : clean;
}

// Ambil shade di sekitar shade terpilih supaya perbandingannya relevan.
function pickAround<T extends { id: number }>(all: T[], selectedId: number | undefined, count: number) {
  if (all.length <= count) return all;
  const idx = Math.max(0, all.findIndex((s) => s.id === selectedId));
  let start = Math.max(0, idx - Math.floor(count / 2));
  if (start + count > all.length) start = all.length - count;
  return all.slice(start, start + count);
}
