import { alpha, darken, lighten, mix } from "@/lib/color";
import { KOPI, type ArtCtx } from "./context";
import { MEREK } from "@/config/merek";

export const FONT = "var(--font-teks), ui-sans-serif, system-ui, sans-serif";
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
  // Gaya latar packshot dari konfigurasi merek (MEREK.productArt), dicampur dengan warna shade.
  const bgTop = mix(mix(ctx.shade, MEREK.productArt.latarAtas, 0.84), "#FFFFFF", 0.35);
  const bgBottom = mix(mix(ctx.shade, MEREK.productArt.latarBawah, 0.76), ctx.brand, 0.07);
  return (
    <defs>
      <radialGradient id={`${id}-bg`} cx="50%" cy="28%" r="80%">
        <stop offset="0" stopColor={bgTop} />
        <stop offset="1" stopColor={bgBottom} />
      </radialGradient>
      <CylGradient id={`${id}-cyl-shade`} color={ctx.shade} />
      <CylGradient id={`${id}-cyl-brand`} color={ctx.brand} />
      <CylGradient id={`${id}-cyl-brandDark`} color={ctx.brandDark} />
      <CylGradient id={`${id}-cyl-tube`} color={ctx.tubeDark} />
      <CylGradient id={`${id}-cyl-ink`} color={ctx.ink} />
      <CylGradient id={`${id}-cyl-gold`} color={ctx.gold} />
      <CylGradient id={`${id}-cyl-white`} color="#F7F3EF" />
      <CylGradient id={`${id}-cyl-silver`} color="#C9C5C2" />
      {/* Cairan: lebih terang di atas, pekat di bawah */}
      <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={lighten(ctx.shade, 0.26)} />
        <stop offset="0.22" stopColor={lighten(ctx.shade, 0.06)} />
        <stop offset="1" stopColor={darken(ctx.shade, 0.18)} />
      </linearGradient>
      {/* Cairan horizontal untuk pembiasan dinding kaca */}
      <linearGradient id={`${id}-liquid-h`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={darken(ctx.shade, 0.3)} />
        <stop offset="0.2" stopColor={ctx.shade} />
        <stop offset="0.4" stopColor={lighten(ctx.shade, 0.18)} />
        <stop offset="0.75" stopColor={ctx.shade} />
        <stop offset="1" stopColor={darken(ctx.shade, 0.32)} />
      </linearGradient>
      {/* Lapisan kaca: tepi kiri terang, tepi kanan gelap, tengah hampir transparan */}
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
        <stop offset="0.16" stopColor="#FFFFFF" stopOpacity="0.1" />
        <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.03" />
        <stop offset="0.84" stopColor="#FFFFFF" stopOpacity="0.16" />
        <stop offset="1" stopColor={KOPI} stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-sheen-diag`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-mirror`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.45" stopColor="#E4E8EC" />
        <stop offset="0.5" stopColor="#F8F9FA" />
        <stop offset="1" stopColor="#D3D8DD" />
      </linearGradient>
      <linearGradient id={`${id}-fade-bottom`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={KOPI} stopOpacity="0" />
        <stop offset="1" stopColor={KOPI} stopOpacity="0.24" />
      </linearGradient>
      <radialGradient id={`${id}-cream`} cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor={lighten(ctx.shade, 0.3)} />
        <stop offset="0.7" stopColor={ctx.shade} />
        <stop offset="1" stopColor={darken(ctx.shade, 0.2)} />
      </radialGradient>
      <filter id={`${id}-blur`} x="-50%" y="-200%" width="200%" height="500%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <filter id={`${id}-blur-sm`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
      <filter id={`${id}-grain`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0" result="g" />
        <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
        <feBlend in="SourceGraphic" in2="gi" mode="overlay" />
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

export type Grad = "shade" | "brand" | "brandDark" | "tube" | "ink" | "gold" | "white" | "silver";

type CylProps = {
  ctx: ArtCtx;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  grad: Grad;
  top?: boolean;
  topColor?: string;
  spec?: boolean;
  opacity?: number;
};

export function gradColor(ctx: ArtCtx, grad: Grad) {
  switch (grad) {
    case "shade":
      return ctx.shade;
    case "brand":
      return ctx.brand;
    case "brandDark":
      return ctx.brandDark;
    case "tube":
      return ctx.tubeDark;
    case "ink":
      return ctx.ink;
    case "gold":
      return ctx.gold;
    case "silver":
      return "#C9C5C2";
    default:
      return "#F7F3EF";
  }
}

// Silinder: badan dengan gradien, highlight spekular, rim light kanan, opsional permukaan atas.
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

type GlassProps = {
  ctx: ArtCtx;
  d: string; // path badan kaca
  box: { x: number; y: number; w: number; h: number };
  liquidTop: number; // y permukaan cairan; lebih besar dari box.h + y berarti kosong
  wall?: number; // ketebalan dinding kaca terlihat (0 sampai 1 relatif lebar)
  tintOpacity?: number; // isi botol buram (frosted) bila > 0
  meniscus?: boolean;
  keyName: string; // id unik untuk clipPath di dalam satu packshot
};

// Botol kaca bening: cairan shade di dalam, dinding kaca, highlight, dan dasar tebal.
export function GlassBody({ ctx, d, box, liquidTop, wall = 0.08, tintOpacity = 0, meniscus = true, keyName }: GlassProps) {
  const clip = `${ctx.id}-clip-${keyName}`;
  const { x, y, w, h } = box;
  const bottom = y + h;
  const liquidH = Math.max(0, bottom - liquidTop);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      {/* Isi botol kosong terlihat sedikit keabuan karena kaca */}
      <path d={d} fill={mix("#FFFFFF", ctx.shade, 0.08)} opacity={0.7} />
      {tintOpacity > 0 ? <path d={d} fill={ctx.shade} opacity={tintOpacity} /> : null}
      <g clipPath={`url(#${clip})`}>
        {liquidH > 0 ? (
          <>
            <rect x={x} y={liquidTop} width={w} height={liquidH} fill={`url(#${ctx.id}-liquid-h)`} />
            <rect x={x} y={liquidTop} width={w} height={liquidH} fill={`url(#${ctx.id}-liquid)`} opacity={0.55} />
            {meniscus ? (
              <>
                <ellipse cx={x + w / 2} cy={liquidTop} rx={w / 2} ry={Math.min(5, w / 10)} fill={lighten(ctx.shade, 0.3)} opacity={0.9} />
                <ellipse cx={x + w / 2} cy={liquidTop} rx={w / 2 - 2} ry={Math.min(4, w / 12)} fill={`url(#${ctx.id}-sheen)`} opacity={0.5} />
              </>
            ) : null}
          </>
        ) : null}
        {/* Dasar kaca tebal */}
        <rect x={x} y={bottom - Math.max(6, h * 0.07)} width={w} height={Math.max(6, h * 0.07)} fill={KOPI} opacity={0.14} />
        <rect x={x} y={bottom - Math.max(6, h * 0.07)} width={w} height={1.2} fill="#FFFFFF" opacity={0.35} />
      </g>
      <path d={d} fill={`url(#${ctx.id}-glass)`} />
      <g clipPath={`url(#${clip})`}>
        <rect x={x + w * 0.12} y={y + 8} width={w * wall} height={h - 16} rx={w * wall * 0.5} fill="#FFFFFF" opacity={0.55} filter={`url(#${ctx.id}-blur-sm)`} />
        <rect x={x + w - w * 0.09} y={y + 10} width={1.6} height={h - 20} rx={0.8} fill="#FFFFFF" opacity={0.45} />
      </g>
      <path d={d} fill="none" stroke={KOPI} strokeOpacity={0.12} strokeWidth={0.8} />
    </g>
  );
}

// Tetesan cairan.
export function Drop({ ctx, x, y, size = 10, color }: { ctx: ArtCtx; x: number; y: number; size?: number; color?: string }) {
  const c = color ?? ctx.shade;
  const s = size;
  return (
    <g>
      <path d={`M${x} ${y - s * 1.4} Q${x + s * 0.9} ${y - s * 0.2} ${x + s * 0.6} ${y + s * 0.35} A${s * 0.6} ${s * 0.6} 0 0 1 ${x - s * 0.6} ${y + s * 0.35} Q${x - s * 0.9} ${y - s * 0.2} ${x} ${y - s * 1.4} Z`} fill={`url(#${ctx.id}-cream)`} style={{ fill: c }} />
      <path d={`M${x} ${y - s * 1.4} Q${x + s * 0.9} ${y - s * 0.2} ${x + s * 0.6} ${y + s * 0.35} A${s * 0.6} ${s * 0.6} 0 0 1 ${x - s * 0.6} ${y + s * 0.35} Q${x - s * 0.9} ${y - s * 0.2} ${x} ${y - s * 1.4} Z`} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.6} />
      <ellipse cx={x - s * 0.22} cy={y + s * 0.05} rx={s * 0.16} ry={s * 0.3} fill="#FFFFFF" opacity={0.75} />
    </g>
  );
}

// Olesan isi produk (dipakai di tampilan detail). Lihat juga ShadeSwatchArt untuk versi mandiri.
export function Smear({
  ctx,
  x,
  y,
  w,
  h,
  color,
  texture = "krim",
  rotate = 0,
}: {
  ctx: ArtCtx;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  texture?: "krim" | "cair" | "bubuk" | "satin";
  rotate?: number;
}) {
  const c = color ?? ctx.shade;
  const d = `M${x} ${y + h * 0.55} C${x + w * 0.05} ${y + h * 0.05} ${x + w * 0.3} ${y} ${x + w * 0.45} ${y + h * 0.18} S${x + w * 0.8} ${y - h * 0.05} ${x + w} ${y + h * 0.4} C${x + w * 1.02} ${y + h * 0.75} ${x + w * 0.8} ${y + h} ${x + w * 0.55} ${y + h * 0.9} S${x + w * 0.18} ${y + h * 1.05} ${x} ${y + h * 0.55} Z`;
  const t = rotate ? `rotate(${rotate} ${x + w / 2} ${y + h / 2})` : undefined;
  const grainy = texture === "bubuk";
  return (
    <g transform={t}>
      <path d={d} fill={alpha(KOPI, 0.18)} transform="translate(1.5 3)" filter={`url(#${ctx.id}-blur-sm)`} />
      <path d={d} fill={c} filter={grainy ? `url(#${ctx.id}-grain)` : undefined} opacity={grainy ? 0.92 : 1} />
      <path d={d} fill={`url(#${ctx.id}-fade-bottom)`} opacity={texture === "cair" ? 0.25 : 0.45} />
      {texture === "krim" ? (
        <g opacity={0.5} stroke={lighten(c, 0.35)} strokeWidth={1.2} fill="none" strokeLinecap="round">
          <path d={`M${x + w * 0.12} ${y + h * 0.45} Q${x + w * 0.4} ${y + h * 0.2} ${x + w * 0.78} ${y + h * 0.42}`} />
          <path d={`M${x + w * 0.18} ${y + h * 0.65} Q${x + w * 0.45} ${y + h * 0.42} ${x + w * 0.72} ${y + h * 0.62}`} />
        </g>
      ) : null}
      {texture === "cair" || texture === "satin" ? (
        <path d={`M${x + w * 0.14} ${y + h * 0.42} Q${x + w * 0.42} ${y + h * 0.12} ${x + w * 0.74} ${y + h * 0.3}`} stroke="#FFFFFF" strokeOpacity={texture === "cair" ? 0.8 : 0.55} strokeWidth={texture === "cair" ? 2.2 : 4} fill="none" strokeLinecap="round" filter={texture === "satin" ? `url(#${ctx.id}-blur-sm)` : undefined} />
      ) : null}
      {texture === "cair" ? <ellipse cx={x + w * 0.9} cy={y + h * 0.8} rx={w * 0.05} ry={h * 0.09} fill={c} /> : null}
    </g>
  );
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

// Label kertas putih dengan nama merek dan baris teks.
export function PaperLabel({ ctx, x, y, w, h, textColor }: { ctx: ArtCtx; x: number; y: number; w: number; h: number; textColor?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2.5} fill="#FBF8F4" opacity={0.96} />
      <rect x={x} y={y} width={w} height={h} rx={2.5} fill={`url(#${ctx.id}-glass)`} opacity={0.35} />
      <BrandText ctx={ctx} x={x + w / 2} y={y + h * 0.45} fill={textColor ?? ctx.brandDark} size={Math.min(6.2, w / 9)} maxWidth={w - 10} />
      <LabelLines x={x + w * 0.2} y={y + h * 0.6} w={w * 0.6} color={KOPI} rows={h > 30 ? 3 : 2} />
    </g>
  );
}
