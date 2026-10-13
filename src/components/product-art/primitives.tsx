import { alpha, darken, lighten, mix } from "@/lib/color";
import { KOPI, type ArtCtx } from "./context";

export const FONT = "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif";
export const FLOOR_Y = 208;

// Gradien silinder horizontal: gelap di tepi, terang di sisi cahaya (kiri-tengah).
export function CylGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor={darken(color, 0.32)} />
      <stop offset="0.12" stopColor={darken(color, 0.1)} />
      <stop offset="0.3" stopColor={lighten(color, 0.2)} />
      <stop offset="0.46" stopColor={lighten(color, 0.05)} />
      <stop offset="0.72" stopColor={color} />
      <stop offset="0.9" stopColor={darken(color, 0.14)} />
      <stop offset="1" stopColor={darken(color, 0.34)} />
    </linearGradient>
  );
}

export function Defs({ ctx }: { ctx: ArtCtx }) {
  const { id } = ctx;
  const bgTop = mix(mix(ctx.shade, "#FAF7F5", 0.82), "#FFFFFF", 0.35);
  const bgBottom = mix(mix(ctx.shade, "#EFE6E1", 0.74), ctx.brand, 0.06);
  return (
    <defs>
      <radialGradient id={`${id}-bg`} cx="50%" cy="28%" r="80%">
        <stop offset="0" stopColor={bgTop} />
        <stop offset="1" stopColor={bgBottom} />
      </radialGradient>
      <CylGradient id={`${id}-cyl-shade`} color={ctx.shade} />
      <CylGradient id={`${id}-cyl-pastel`} color={ctx.pastel} />
      <CylGradient id={`${id}-cyl-brand`} color={ctx.brand} />
      <CylGradient id={`${id}-cyl-brandDark`} color={ctx.brandDark} />
      <CylGradient id={`${id}-cyl-ink`} color={ctx.ink} />
      <CylGradient id={`${id}-cyl-gold`} color={ctx.gold} />
      <CylGradient id={`${id}-cyl-white`} color="#F7F3EF" />
      <CylGradient id={`${id}-cyl-silver`} color="#C8C4C1" />
      <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={lighten(ctx.shade, 0.28)} />
        <stop offset="0.25" stopColor={lighten(ctx.shade, 0.06)} />
        <stop offset="1" stopColor={darken(ctx.shade, 0.16)} />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="0.18" stopColor="#FFFFFF" stopOpacity="0.08" />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.02" />
        <stop offset="0.85" stopColor="#FFFFFF" stopOpacity="0.14" />
        <stop offset="1" stopColor={KOPI} stopOpacity="0.14" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-mirror`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.45" stopColor="#E6E9EC" />
        <stop offset="0.5" stopColor="#F8F9FA" />
        <stop offset="1" stopColor="#D5D9DD" />
      </linearGradient>
      <linearGradient id={`${id}-fade-bottom`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={KOPI} stopOpacity="0" />
        <stop offset="1" stopColor={KOPI} stopOpacity="0.22" />
      </linearGradient>
      <filter id={`${id}-blur`} x="-50%" y="-200%" width="200%" height="500%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <filter id={`${id}-blur-sm`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
    </defs>
  );
}

// Bayangan jatuh lembut dan bayangan kontak di lantai.
export function Floor({ ctx, rx = 46, y = FLOOR_Y, offset = 0 }: { ctx: ArtCtx; rx?: number; y?: number; offset?: number }) {
  return (
    <g>
      <ellipse cx={100 + offset} cy={y + 6} rx={rx} ry={8} fill={alpha(KOPI, 0.2)} filter={`url(#${ctx.id}-blur)`} />
      <ellipse cx={100 + offset} cy={y + 2} rx={rx * 0.62} ry={3.2} fill={alpha(KOPI, 0.26)} filter={`url(#${ctx.id}-blur-sm)`} />
    </g>
  );
}

type CylProps = {
  ctx: ArtCtx;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  grad: "shade" | "pastel" | "brand" | "brandDark" | "ink" | "gold" | "white" | "silver";
  top?: boolean; // ellipse di bagian atas (kamera sedikit dari atas)
  topColor?: string;
  spec?: boolean;
  opacity?: number;
};

// Silinder: badan dengan gradien, highlight spekular, dan rim light di sisi kanan.
export function Cyl({ ctx, x, y, w, h, rx = 8, grad, top = false, topColor, spec = true, opacity }: CylProps) {
  const ry = Math.min(w / 6.5, 10);
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#${ctx.id}-cyl-${grad})`} />
      {spec ? (
        <rect
          x={x + w * 0.2}
          y={y + Math.max(rx * 0.7, 3)}
          width={Math.max(2.2, w * 0.08)}
          height={Math.max(4, h - rx * 1.4 - 3)}
          rx={Math.max(1, w * 0.04)}
          fill="#FFFFFF"
          opacity={0.4}
          filter={`url(#${ctx.id}-blur-sm)`}
        />
      ) : null}
      <rect x={x + w - 2.6} y={y + rx * 0.6} width={1.4} height={Math.max(2, h - rx * 1.2)} fill="#FFFFFF" opacity={0.2} />
      {top ? (
        <>
          <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={ry} fill={topColor ?? lighten(gradColor(ctx, grad), 0.3)} />
          <ellipse cx={x + w / 2} cy={y} rx={w / 2 - 1.5} ry={ry - 1} fill={`url(#${ctx.id}-sheen)`} opacity={0.5} />
        </>
      ) : null}
    </g>
  );
}

function gradColor(ctx: ArtCtx, grad: CylProps["grad"]) {
  switch (grad) {
    case "shade":
      return ctx.shade;
    case "pastel":
      return ctx.pastel;
    case "brand":
      return ctx.brand;
    case "brandDark":
      return ctx.brandDark;
    case "ink":
      return ctx.ink;
    case "gold":
      return ctx.gold;
    case "silver":
      return "#C8C4C1";
    default:
      return "#F7F3EF";
  }
}

// Nama merek kecil dengan huruf kapital berjarak.
export function BrandText({
  ctx,
  x = 100,
  y,
  fill,
  size,
  rotate,
  anchor = "middle",
  maxWidth,
}: {
  ctx: ArtCtx;
  x?: number;
  y: number;
  fill: string;
  size?: number;
  rotate?: number;
  anchor?: "middle" | "start";
  maxWidth?: number;
}) {
  const name = ctx.brandName.toUpperCase();
  const fs = size ?? (name.length > 11 ? 5.4 : name.length > 7 ? 6.4 : 7.4);
  const est = name.length * fs * 0.78;
  const textLength = maxWidth && est > maxWidth ? maxWidth : undefined;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={FONT}
      fontSize={fs}
      fontWeight={700}
      letterSpacing={fs * 0.22}
      fill={fill}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      textLength={textLength}
      lengthAdjust={textLength ? "spacingAndGlyphs" : undefined}
    >
      {name}
    </text>
  );
}

// Garis-garis tipis pelengkap label (seolah teks kecil).
export function LabelLines({ x, y, w, color, rows = 2 }: { x: number; y: number; w: number; color: string; rows?: number }) {
  return (
    <g opacity={0.5}>
      {Array.from({ length: rows }).map((_, i) => (
        <rect key={i} x={x + (i % 2 === 0 ? 0 : w * 0.12)} y={y + i * 4} width={w * (i % 2 === 0 ? 1 : 0.76)} height={1.3} rx={0.6} fill={color} />
      ))}
    </g>
  );
}
