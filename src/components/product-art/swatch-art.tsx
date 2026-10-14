import { useId } from "react";
import { alpha, darken, lighten } from "@/lib/color";
import { cn } from "@/lib/utils";
import { MEREK } from "@/config/merek";

export type SwatchTexture = "krim" | "cair" | "bubuk" | "satin";

export type ShadeSwatchArtProps = {
  shade: string;
  texture?: SwatchTexture;
  className?: string;
  title?: string;
  background?: "soft" | "none";
};

const KOPI = "#2A1F1D";

export const swatchTextureLabels: Record<SwatchTexture, string> = {
  krim: "Krim",
  cair: "Cair",
  bubuk: "Bubuk",
  satin: "Satin",
};

// Usapan tekstur produk berwarna shade, untuk galeri halaman produk. Kanvas 200 x 140.
export function ShadeSwatchArt({ shade, texture = "krim", className, title, background = "soft" }: ShadeSwatchArtProps) {
  const id = `sw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c = /^#[0-9a-fA-F]{6}$/.test(shade) ? shade : "#D9A98B";
  const label = title ?? `Swatch ${swatchTextureLabels[texture].toLowerCase()} warna ${c}`;
  // Olesan utama: ujung kiri tebal, ekor kanan menipis.
  const d =
    "M28 62 C34 40 60 34 82 44 C100 52 118 46 136 48 C156 50 174 60 176 74 C178 88 162 98 144 96 C120 94 104 102 84 98 C60 94 38 92 28 80 C24 74 24 68 28 62 Z";
  const grainy = texture === "bubuk";
  return (
    <svg viewBox="0 0 200 140" role="img" aria-label={label} className={cn("block h-auto w-full select-none", className)} style={{ aspectRatio: "10 / 7" }}>
      <title>{label}</title>
      <defs>
        <radialGradient id={`${id}-bg`} cx="40%" cy="30%" r="90%">
          <stop offset="0" stopColor="#FFFDFB" />
          <stop offset="1" stopColor="#F1E9E4" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(c, 0.08)} />
          <stop offset="0.6" stopColor={c} />
          <stop offset="1" stopColor={darken(c, 0.18)} />
        </linearGradient>
        <linearGradient id={`${id}-shadow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={KOPI} stopOpacity="0" />
          <stop offset="1" stopColor={KOPI} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${id}-blur-sm`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id={`${id}-grain`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" result="g" />
          <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
          <feBlend in="SourceGraphic" in2="gi" mode="overlay" />
        </filter>
        <filter id={`${id}-fuzzy`} x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`${id}-wobble`} x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="1" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <path d={d} />
        </clipPath>
      </defs>
      {background === "soft" ? <rect width="200" height="140" rx={MEREK.productArt.sudut} fill={`url(#${id}-bg)`} /> : null}
      {/* Bayangan jatuh */}
      <path d={d} fill={alpha(KOPI, 0.22)} transform="translate(2 5)" filter={`url(#${id}-blur)`} />
      {/* Badan olesan */}
      <g filter={grainy ? `url(#${id}-fuzzy)` : `url(#${id}-wobble)`}>
        <path d={d} fill={`url(#${id}-body)`} />
        {grainy ? <path d={d} fill={c} filter={`url(#${id}-grain)`} opacity={0.9} /> : null}
      </g>
      <g clipPath={`url(#${id}-clip)`}>
        <path d={d} fill={`url(#${id}-shadow)`} opacity={texture === "cair" ? 0.35 : 0.5} />
        {texture === "krim" ? (
          <g stroke={lighten(c, 0.38)} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.55}>
            <path d="M40 58 C70 42 110 54 150 56" />
            <path d="M44 74 C80 62 120 70 160 68" />
            <path d="M52 88 C84 80 120 86 150 82" strokeWidth={1.4} />
          </g>
        ) : null}
        {texture === "krim" ? (
          <g stroke={darken(c, 0.25)} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.4}>
            <path d="M42 66 C72 50 110 62 148 62" />
            <path d="M48 82 C82 70 120 78 156 74" />
          </g>
        ) : null}
        {texture === "cair" ? (
          <>
            <path d="M46 56 C76 42 112 50 150 54" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.85} />
            <path d="M60 70 C84 64 110 70 134 70" stroke="#FFFFFF" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
            <ellipse cx={60} cy={60} rx={10} ry={4} fill="#FFFFFF" opacity={0.5} filter={`url(#${id}-blur-sm)`} />
          </>
        ) : null}
        {texture === "satin" ? (
          <>
            <path d={d} fill={`url(#${id}-sheen)`} opacity={0.75} />
            <path d="M50 58 C80 46 120 54 158 56" stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.45} filter={`url(#${id}-blur-sm)`} />
          </>
        ) : null}
        {texture === "bubuk" ? (
          <>
            <path d={d} fill="#FFFFFF" opacity={0.08} />
            <ellipse cx={70} cy={62} rx={22} ry={9} fill="#FFFFFF" opacity={0.18} filter={`url(#${id}-blur)`} />
          </>
        ) : null}
      </g>
      {/* Tepi olesan: krim dan bubuk sedikit menebal di tepi */}
      {texture !== "cair" ? <path d={d} fill="none" stroke={darken(c, 0.2)} strokeOpacity={grainy ? 0.15 : 0.3} strokeWidth={grainy ? 2 : 1} filter={grainy ? `url(#${id}-fuzzy)` : undefined} /> : null}
      {texture === "cair" ? (
        <>
          <ellipse cx={182} cy={88} rx={4} ry={5} fill={c} />
          <ellipse cx={181} cy={86} rx={1.2} ry={1.8} fill="#FFFFFF" opacity={0.8} />
          <ellipse cx={40} cy={96} rx={3} ry={3.6} fill={c} />
        </>
      ) : null}
      {texture === "bubuk" ? (
        <g fill={c} opacity={0.6} filter={`url(#${id}-grain)`}>
          <circle cx={182} cy={84} r={2.4} />
          <circle cx={176} cy={100} r={1.6} />
          <circle cx={34} cy={98} r={2} />
          <circle cx={168} cy={44} r={1.4} />
        </g>
      ) : null}
    </svg>
  );
}
