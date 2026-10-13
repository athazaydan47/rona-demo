import type { Packaging } from "@/db/schema/enums";
import { alpha, darken, lighten, mix, shiftHue } from "@/lib/color";
import { KOPI, type ArtCtx } from "./context";
import { BrandText, Cyl, Drop, FLOOR_Y, Floor, GlassBody, LabelLines, PaperLabel, Smear } from "./primitives";

type Shape = (ctx: ArtCtx) => React.ReactNode;

// Kanvas 200 x 240, lantai di y = 208, objek berpusat di x = 100.
// Aturan warna: badan kemasan memakai warna merek; shade hanya mewarnai isi yang terlihat.

const roundedBottle = (x: number, y: number, w: number, h: number, shoulder: number, rb = 10) =>
  `M${x} ${y + shoulder} Q${x} ${y} ${x + shoulder} ${y} L${x + w - shoulder} ${y} Q${x + w} ${y} ${x + w} ${y + shoulder} L${x + w} ${y + h - rb} Q${x + w} ${y + h} ${x + w - rb} ${y + h} L${x + rb} ${y + h} Q${x} ${y + h} ${x} ${y + h - rb} Z`;

// Tabung rebah (silinder horizontal) dengan gradien vertikal.
function LyingTube({ ctx, x, y, w, h, color, capW = 0, capColor }: { ctx: ArtCtx; x: number; y: number; w: number; h: number; color: string; capW?: number; capColor?: string }) {
  const gid = `${ctx.id}-lying-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={darken(color, 0.25)} />
          <stop offset="0.25" stopColor={lighten(color, 0.2)} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={darken(color, 0.35)} />
        </linearGradient>
        {capColor ? (
          <linearGradient id={`${gid}-cap`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={darken(capColor, 0.25)} />
            <stop offset="0.25" stopColor={lighten(capColor, 0.2)} />
            <stop offset="0.5" stopColor={capColor} />
            <stop offset="1" stopColor={darken(capColor, 0.35)} />
          </linearGradient>
        ) : null}
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={h / 2.2} fill={`url(#${gid})`} />
      {capW > 0 ? <rect x={x + w - capW} y={y - 1} width={capW} height={h + 2} rx={h / 2.2} fill={`url(#${gid}-cap)`} /> : null}
      <rect x={x + 6} y={y + h * 0.22} width={w - 12 - capW} height={h * 0.1} rx={h * 0.05} fill="#FFFFFF" opacity={0.4} filter={`url(#${ctx.id}-blur-sm)`} />
      <ellipse cx={x} cy={y + h / 2} rx={h * 0.12} ry={h / 2} fill={lighten(color, 0.15)} />
    </g>
  );
}

const lipstick: Shape = (ctx) => {
  const bullet = (bx: number, by: number) => (
    <g>
      <path d={`M${bx} ${by + 40} L${bx} ${by} Q${bx} ${by - 10} ${bx + 8} ${by - 12} L${bx + 22} ${by - 20} Q${bx + 24} ${by - 21} ${bx + 24} ${by - 18} L${bx + 24} ${by + 40} Z`} fill={`url(#${ctx.id}-cyl-shade)`} />
      <path d={`M${bx + 8} ${by - 12} L${bx + 22} ${by - 20} Q${bx + 24} ${by - 21} ${bx + 24} ${by - 18} L${bx + 24} ${by - 11} Z`} fill={lighten(ctx.shade, 0.22)} />
      <rect x={bx + 4} y={by - 2} width={3.5} height={34} rx={1.6} fill="#FFFFFF" opacity={0.38} filter={`url(#${ctx.id}-blur-sm)`} />
    </g>
  );
  if (ctx.view === "detail") {
    return (
      <g>
        <Floor ctx={ctx} rx={62} />
        {/* Tutup rebah di lantai */}
        <LyingTube ctx={ctx} x={22} y={176} w={82} h={30} color={ctx.brand} />
        <ellipse cx={104} cy={191} rx={4} ry={15} fill={darken(ctx.brand, 0.45)} />
        <ellipse cx={104} cy={191} rx={2.4} ry={12} fill={darken(ctx.brand, 0.7)} />
        {/* Badan berdiri tanpa tutup, peluru keluar penuh */}
        <Cyl ctx={ctx} x={118} y={128} w={34} h={80} rx={5} grad="brand" />
        <Cyl ctx={ctx} x={120} y={112} w={30} h={18} rx={3} grad="gold" top topColor={lighten(ctx.gold, 0.4)} />
        {bullet(123, 74)}
        <BrandText ctx={ctx} x={135} y={170} fill={alpha(ctx.textOnBrand, 0.8)} size={5} rotate={-90} maxWidth={60} />
      </g>
    );
  }
  return (
    <g>
      <Floor ctx={ctx} rx={44} />
      {/* Tutup berdiri di belakang kiri */}
      <Cyl ctx={ctx} x={44} y={88} w={30} h={120} rx={6} grad="brand" top topColor={ctx.brandLight} />
      <rect x={44} y={198} width={30} height={10} rx={2} fill={alpha("#000", 0.16)} />
      {/* Badan bawah dan kerah logam */}
      <Cyl ctx={ctx} x={100} y={138} w={34} h={70} rx={5} grad="brand" />
      <rect x={100} y={198} width={34} height={10} rx={2} fill={alpha("#000", 0.16)} />
      <Cyl ctx={ctx} x={102} y={120} w={30} h={20} rx={3} grad="gold" top topColor={lighten(ctx.gold, 0.4)} />
      {bullet(105, 82)}
      <BrandText ctx={ctx} x={117} y={176} fill={alpha(ctx.textOnBrand, 0.8)} size={5} rotate={-90} maxWidth={52} />
    </g>
  );
};

// Aplikator doe-foot: batang + ujung busa berisi shade.
function DoeFoot({ ctx, x, y, len = 70, tilt = 0, drip = false }: { ctx: ArtCtx; x: number; y: number; len?: number; tilt?: number; drip?: boolean }) {
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}>
      <rect x={x - 2} y={y} width={4} height={len} rx={2} fill={`url(#${ctx.id}-cyl-ink)`} />
      <path d={`M${x - 4.5} ${y + len} Q${x - 5.5} ${y + len + 14} ${x} ${y + len + 24} Q${x + 5.5} ${y + len + 14} ${x + 4.5} ${y + len} Z`} fill={darken(ctx.shade, 0.12)} />
      <path d={`M${x - 3} ${y + len + 2} Q${x - 2.5} ${y + len + 12} ${x} ${y + len + 20}`} stroke={lighten(ctx.shade, 0.3)} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
      {drip ? <Drop ctx={ctx} x={x + 1} y={y + len + 34} size={5} /> : null}
    </g>
  );
}

const lipTint: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bx = detail ? 50 : 76;
  const bw = 48;
  const d = roundedBottle(bx, 108, bw, 100, 10, 9);
  return (
    <g>
      <Floor ctx={ctx} rx={detail ? 56 : 30} offset={detail ? 6 : 0} />
      <GlassBody ctx={ctx} d={d} box={{ x: bx, y: 108, w: bw, h: 100 }} liquidTop={122} keyName="tint" />
      {!detail ? (
        <>
          <rect x={98.5} y={110} width={3} height={78} rx={1.5} fill={darken(ctx.shade, 0.3)} opacity={0.6} />
          <ellipse cx={100} cy={190} rx={4.5} ry={8} fill={darken(ctx.shade, 0.3)} opacity={0.75} />
          <Cyl ctx={ctx} x={82} y={56} w={36} h={54} rx={5} grad="tube" top topColor={lighten(ctx.tubeDark, 0.25)} />
          <BrandText ctx={ctx} y={162} fill={alpha("#FFFFFF", 0.9)} size={5.4} maxWidth={40} />
        </>
      ) : (
        <>
          {/* Botol terbuka dengan kerah, aplikator dicabut di samping */}
          <Cyl ctx={ctx} x={bx + 10} y={100} w={28} h={10} rx={2} grad="ink" />
          <Cyl ctx={ctx} x={120} y={52} w={36} h={52} rx={5} grad="tube" top topColor={lighten(ctx.tubeDark, 0.25)} />
          <DoeFoot ctx={ctx} x={138} y={104} len={62} drip />
          <BrandText ctx={ctx} x={bx + bw / 2} y={162} fill={alpha("#FFFFFF", 0.9)} size={5.4} maxWidth={40} />
        </>
      )}
    </g>
  );
};

const lipCream: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bx = detail ? 56 : 80;
  const bw = 40;
  const d = roundedBottle(bx, 118, bw, 90, 8, 8);
  return (
    <g>
      <Floor ctx={ctx} rx={detail ? 52 : 26} offset={detail ? 8 : 0} />
      {/* Tabung bening pendek-lebar, isi shade terlihat */}
      <GlassBody ctx={ctx} d={d} box={{ x: bx, y: 118, w: bw, h: 90 }} liquidTop={128} keyName="cream" tintOpacity={0.12} />
      {!detail ? (
        <>
          <rect x={98.5} y={120} width={3} height={68} rx={1.5} fill={darken(ctx.shade, 0.3)} opacity={0.5} />
          {/* Tutup pendek warna merek */}
          <Cyl ctx={ctx} x={bx - 1} y={88} w={bw + 2} h={32} rx={6} grad="brand" top topColor={ctx.brandLight} spec={false} />
          <rect x={bx - 1} y={116} width={bw + 2} height={2} fill={alpha("#000", 0.2)} />
          <BrandText ctx={ctx} y={104} fill={ctx.textOnBrand} size={5.2} maxWidth={32} />
        </>
      ) : (
        <>
          <Cyl ctx={ctx} x={bx + 8} y={110} w={24} h={10} rx={2} grad="ink" />
          <Cyl ctx={ctx} x={116} y={76} w={42} h={32} rx={6} grad="brand" top topColor={ctx.brandLight} spec={false} />
          <BrandText ctx={ctx} x={137} y={92} fill={ctx.textOnBrand} size={5.2} maxWidth={32} />
          <DoeFoot ctx={ctx} x={137} y={108} len={60} drip />
        </>
      )}
    </g>
  );
};

const cushion: Shape = (ctx) => {
  if (ctx.view === "detail") {
    // Tertutup, dilihat dari atas: lingkaran merek dengan logo.
    return (
      <g>
        <ellipse cx={100} cy={200} rx={70} ry={10} fill={alpha(KOPI, 0.22)} filter={`url(#${ctx.id}-blur)`} />
        <circle cx={100} cy={130} r={70} fill={ctx.brandDark} />
        <circle cx={100} cy={127} r={70} fill={`url(#${ctx.id}-cyl-brand)`} />
        <circle cx={100} cy={127} r={62} fill="none" stroke={alpha("#FFFFFF", 0.25)} strokeWidth={1} />
        <path d="M44 100 A62 62 0 0 1 128 72 L112 92 A42 42 0 0 0 60 112 Z" fill="#FFFFFF" opacity={0.22} />
        <BrandText ctx={ctx} y={129} fill={ctx.textOnBrand} size={9.5} maxWidth={110} />
        <rect x={82} y={137} width={36} height={1.2} rx={0.6} fill={alpha(ctx.textOnBrand, 0.5)} />
        <text x={100} y={150} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize={5.5} letterSpacing={1.4} fill={alpha(ctx.textOnBrand, 0.75)}>
          CUSHION
        </text>
      </g>
    );
  }
  return (
    <g>
      <Floor ctx={ctx} rx={60} />
      <rect x={46} y={58} width={108} height={92} rx={16} fill={`url(#${ctx.id}-cyl-brand)`} />
      <rect x={46} y={58} width={108} height={92} rx={16} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.5} />
      <rect x={55} y={67} width={90} height={74} rx={11} fill={`url(#${ctx.id}-mirror)`} />
      <path d="M62 136 L118 70 L132 70 L76 136 Z" fill="#FFFFFF" opacity={0.35} />
      <rect x={38} y={166} width={124} height={42} rx={10} fill={`url(#${ctx.id}-cyl-brandDark)`} />
      <rect x={38} y={196} width={124} height={12} rx={6} fill={alpha("#000", 0.14)} />
      <ellipse cx={100} cy={166} rx={62} ry={14} fill={ctx.brand} />
      <ellipse cx={100} cy={166} rx={62} ry={14} fill={`url(#${ctx.id}-sheen)`} opacity={0.35} />
      <ellipse cx={100} cy={166} rx={50} ry={10.5} fill={darken(ctx.shade, 0.08)} />
      <ellipse cx={100} cy={165} rx={50} ry={10} fill={`url(#${ctx.id}-liquid)`} />
      <ellipse cx={82} cy={163} rx={16} ry={3.5} fill="#FFFFFF" opacity={0.25} filter={`url(#${ctx.id}-blur-sm)`} />
      <ellipse cx={134} cy={160} rx={22} ry={9} fill="#F6F0EB" />
      <ellipse cx={134} cy={158.5} rx={22} ry={8.5} fill="#FBF8F5" />
      <path d="M118 159 Q134 152 150 159" stroke={alpha(KOPI, 0.18)} strokeWidth={1.2} fill="none" />
      <BrandText ctx={ctx} y={192} fill={alpha(ctx.textOnBrandDark, 0.85)} size={6.2} />
    </g>
  );
};

const foundationBottle: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bw = detail ? 54 : 64;
  const bx = detail ? 40 : 100 - bw / 2;
  const by = detail ? 104 : 96;
  const h = 208 - by;
  const d = roundedBottle(bx, by, bw, h, 7, 7);
  return (
    <g>
      <Floor ctx={ctx} rx={detail ? 60 : 38} offset={detail ? 10 : 0} />
      {/* Kaca kotak tebal, cairan shade */}
      <GlassBody ctx={ctx} d={d} box={{ x: bx, y: by, w: bw, h }} liquidTop={by + 12} wall={0.1} keyName="fdn" />
      {/* Pompa pendek */}
      <Cyl ctx={ctx} x={bx + bw / 2 - 15} y={by - 14} w={30} h={16} rx={3} grad="ink" />
      <Cyl ctx={ctx} x={bx + bw / 2 - 10} y={by - 32} w={20} h={20} rx={4} grad="ink" top topColor={lighten(ctx.ink, 0.3)} />
      <rect x={bx + bw / 2 + 8} y={by - 29} width={14} height={7} rx={3} fill={`url(#${ctx.id}-cyl-ink)`} />
      {!detail ? <PaperLabel ctx={ctx} x={bx + 10} y={142} w={bw - 20} h={28} /> : <PaperLabel ctx={ctx} x={bx + 8} y={146} w={bw - 16} h={24} />}
      {detail ? (
        <>
          {/* Olesan cairan foundation di permukaan */}
          <Smear ctx={ctx} x={104} y={158} w={74} h={34} texture="cair" rotate={-8} />
          <Drop ctx={ctx} x={168} y={150} size={5} />
        </>
      ) : null}
    </g>
  );
};

const sunscreenTube: Shape = (ctx) => {
  if (ctx.view === "detail") {
    // Tube rebah, tutup flip terbuka, sedikit krim keluar.
    return (
      <g>
        <ellipse cx={100} cy={200} rx={74} ry={9} fill={alpha(KOPI, 0.2)} filter={`url(#${ctx.id}-blur)`} />
        <LyingTube ctx={ctx} x={30} y={158} w={116} h={40} color={ctx.brand} />
        <path d="M30 160 L46 164 L46 192 L30 196 Z" fill={darken(ctx.brand, 0.3)} opacity={0.5} />
        <rect x={56} y={168} width={54} height={20} rx={2} fill="#FBF8F4" opacity={0.95} />
        <BrandText ctx={ctx} x={83} y={180} fill={ctx.brandDark} size={5.6} maxWidth={46} />
        {/* Tutup flip terbuka */}
        <rect x={146} y={156} width={14} height={44} rx={4} fill={`url(#${ctx.id}-cyl-brandDark)`} />
        <path d="M160 160 L186 146 Q190 144 190 150 L190 174 L160 184 Z" fill={darken(ctx.brand, 0.32)} />
        <path d="M160 160 L186 146 Q190 144 190 150 L190 156 L160 168 Z" fill={darken(ctx.brand, 0.15)} />
        {/* Krim keluar dari mulut tube */}
        <path d="M156 178 Q168 176 176 184 Q182 192 172 196 Q160 198 154 190 Z" fill={ctx.cream} />
        <path d="M156 178 Q168 176 176 184 Q182 192 172 196 Q160 198 154 190 Z" fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.3} />
        <path d="M160 182 Q168 181 173 186" stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.9} />
      </g>
    );
  }
  const topW = 56;
  const botW = 48;
  const body = `M${100 - botW / 2} 178 L${100 - topW / 2 - 2} 70 L${100 + topW / 2 + 2} 70 L${100 + botW / 2} 178 Z`;
  return (
    <g>
      <Floor ctx={ctx} rx={32} />
      <path d={body} fill={`url(#${ctx.id}-cyl-brand)`} />
      <rect x={100 - topW / 2 - 2} y={66} width={topW + 4} height={6} rx={2} fill={darken(ctx.brand, 0.22)} />
      <path d={body} fill={`url(#${ctx.id}-glass)`} opacity={0.35} />
      <rect x={100 - botW / 2 + 7} y={80} width={4.5} height={90} rx={2} fill="#FFFFFF" opacity={0.45} filter={`url(#${ctx.id}-blur-sm)`} />
      <rect x={74} y={100} width={52} height={54} rx={3} fill="#FBF8F4" opacity={0.96} />
      <BrandText ctx={ctx} y={114} fill={ctx.brandDark} size={6} maxWidth={44} />
      <LabelLines x={84} y={121} w={32} color={KOPI} rows={2} />
      <text x={100} y={146} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize={11} fontWeight={800} fill={ctx.brandDark}>
        SPF
      </text>
      <Cyl ctx={ctx} x={100 - botW / 2 - 2} y={178} w={botW + 4} h={30} rx={5} grad="brandDark" spec={false} />
      <rect x={100 - botW / 2 - 2} y={178} width={botW + 4} height={2} fill={alpha("#FFF", 0.3)} />
    </g>
  );
};

const serumDropper: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bw = 60;
  const bx = 70;
  const by = detail ? 118 : 100;
  const h = 208 - by;
  // Botol kaca bulat berbahu: bahu lebar, sudut bawah lembut.
  const d = roundedBottle(bx, by, bw, h, 22, 14);
  const dropperY = detail ? 42 : by - 50;
  return (
    <g>
      <Floor ctx={ctx} rx={36} />
      <GlassBody ctx={ctx} d={d} box={{ x: bx, y: by, w: bw, h }} liquidTop={by + 16} wall={0.1} keyName="serum" />
      {/* Leher botol dengan ulir */}
      <Cyl ctx={ctx} x={88} y={by - 8} w={24} h={10} rx={2} grad="white" spec={false} />
      {!detail ? (
        <>
          <rect x={98.6} y={by + 2} width={2.8} height={h - 26} rx={1.4} fill="#FFFFFF" opacity={0.4} />
          {/* Kerah logam dan karet pipet */}
          <Cyl ctx={ctx} x={84} y={by - 24} w={32} h={18} rx={3} grad="silver" top topColor="#EDEAE7" />
          <Cyl ctx={ctx} x={88} y={by - 50} w={24} h={30} rx={11} grad="ink" top topColor={lighten(ctx.ink, 0.25)} />
        </>
      ) : (
        <>
          {/* Pipet terangkat dengan satu tetesan */}
          <Cyl ctx={ctx} x={88} y={dropperY} w={24} h={30} rx={11} grad="ink" top topColor={lighten(ctx.ink, 0.25)} />
          <Cyl ctx={ctx} x={84} y={dropperY + 26} w={32} h={16} rx={3} grad="silver" />
          <rect x={97.5} y={dropperY + 42} width={5} height={44} rx={2.5} fill="#FFFFFF" opacity={0.6} />
          <rect x={97.5} y={dropperY + 42} width={5} height={44} rx={2.5} fill="none" stroke={KOPI} strokeOpacity={0.25} strokeWidth={0.6} />
          <rect x={98.6} y={dropperY + 60} width={2.8} height={26} rx={1.4} fill={ctx.shade} opacity={0.9} />
          <Drop ctx={ctx} x={100} y={dropperY + 96} size={6} />
        </>
      )}
      <PaperLabel ctx={ctx} x={bx + 9} y={detail ? 150 : 138} w={bw - 18} h={34} />
    </g>
  );
};

const tonerBottle: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bw = 56;
  const bx = detail ? 48 : 72;
  const by = 84;
  const h = 208 - by;
  const d = roundedBottle(bx, by, bw, h, 9, 9);
  return (
    <g>
      <Floor ctx={ctx} rx={detail ? 58 : 34} offset={detail ? 10 : 0} />
      {/* Plastik bening, cairan shade hampir penuh */}
      <GlassBody ctx={ctx} d={d} box={{ x: bx, y: by, w: bw, h }} liquidTop={by + 14} wall={0.07} keyName="toner" />
      {/* Tutup flip: tutup rata dengan bibir engsel kecil */}
      <Cyl ctx={ctx} x={bx + 3} y={62} w={bw - 6} h={24} rx={4} grad="brand" top topColor={ctx.brandLight} />
      <rect x={bx + 3} y={76} width={bw - 6} height={1.4} fill={alpha("#000", 0.25)} />
      <path d={`M${bx + bw - 10} 66 L${bx + bw + 1} 66 Q${bx + bw + 3} 66 ${bx + bw + 3} 68 L${bx + bw + 3} 74 L${bx + bw - 10} 74 Z`} fill={darken(ctx.brand, 0.18)} />
      <rect x={bx + bw * 0.2} y={118} width={bw * 0.6} height={1.2} fill={ctx.brand} opacity={0.7} />
      <BrandText ctx={ctx} x={bx + bw / 2} y={134} fill={ctx.brandDark} size={6} maxWidth={bw - 14} />
      <LabelLines x={bx + bw * 0.25} y={142} w={bw * 0.5} color={KOPI} rows={3} />
      {detail ? (
        <>
          {/* Kapas basah bersandar di kanan */}
          <rect x={112} y={158} width={62} height={44} rx={10} fill="#FFFFFF" transform="rotate(-10 143 180)" />
          <rect x={112} y={158} width={62} height={44} rx={10} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.25} transform="rotate(-10 143 180)" />
          <ellipse cx={140} cy={178} rx={22} ry={13} fill={ctx.shadePale} opacity={0.75} transform="rotate(-10 143 180)" />
          <ellipse cx={136} cy={176} rx={12} ry={7} fill={ctx.shade} opacity={0.35} transform="rotate(-10 143 180)" />
          <g stroke={alpha(KOPI, 0.1)} strokeWidth={1} fill="none" transform="rotate(-10 143 180)">
            <path d="M120 166 Q143 162 166 166" />
            <path d="M118 194 Q143 198 168 194" />
          </g>
        </>
      ) : null}
    </g>
  );
};

const creamJar: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const jw = 96;
  const jx = 52;
  return (
    <g>
      <Floor ctx={ctx} rx={jw / 2 + 4} />
      <defs>
        <linearGradient id={`${ctx.id}-jar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(ctx.brand, 0.26)} />
          <stop offset="0.3" stopColor={lighten(ctx.brand, 0.16)} />
          <stop offset="0.55" stopColor={ctx.brand} />
          <stop offset="0.9" stopColor={darken(ctx.brand, 0.12)} />
          <stop offset="1" stopColor={darken(ctx.brand, 0.3)} />
        </linearGradient>
      </defs>
      {detail ? (
        <>
          {/* Tutup bersandar di belakang */}
          <g transform="rotate(-18 150 120)">
            <rect x={110} y={84} width={100} height={30} rx={9} fill={`url(#${ctx.id}-cyl-brandDark)`} />
            <ellipse cx={160} cy={84} rx={50} ry={7} fill={ctx.brandDark} />
          </g>
          {/* Jar terbuka dengan krim shade bertekstur */}
          <rect x={jx} y={132} width={jw} height={76} rx={12} fill={`url(#${ctx.id}-jar)`} />
          <rect x={jx} y={194} width={jw} height={14} rx={10} fill={alpha("#000", 0.1)} />
          <ellipse cx={100} cy={132} rx={48} ry={11} fill={darken(ctx.brand, 0.35)} />
          <ellipse cx={100} cy={133} rx={44} ry={9.5} fill={`url(#${ctx.id}-cream)`} />
          <path d="M66 132 Q80 124 96 131 Q112 138 130 129" stroke={lighten(ctx.shade, 0.35)} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
          <path d="M74 137 Q92 131 112 136" stroke={darken(ctx.shade, 0.15)} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
          <ellipse cx={86} cy={129} rx={10} ry={2.6} fill="#FFFFFF" opacity={0.3} />
          {/* Sendok kecil dengan krim */}
          <rect x={120} y={150} width={44} height={5} rx={2.5} fill={`url(#${ctx.id}-cyl-white)`} transform="rotate(30 142 152)" />
          <ellipse cx={121} cy={147} rx={7} ry={5} fill="#F3EEE8" transform="rotate(30 142 152)" />
          <ellipse cx={121} cy={146} rx={5} ry={3.5} fill={ctx.shade} transform="rotate(30 142 152)" />
        </>
      ) : (
        <>
          <rect x={jx} y={132} width={jw} height={76} rx={12} fill={`url(#${ctx.id}-jar)`} />
          <rect x={jx} y={194} width={jw} height={14} rx={10} fill={alpha("#000", 0.1)} />
          <rect x={jx + jw * 0.18} y={140} width={jw * 0.07} height={58} rx={3} fill="#FFFFFF" opacity={0.4} filter={`url(#${ctx.id}-blur-sm)`} />
          <Cyl ctx={ctx} x={jx - 4} y={100} w={jw + 8} h={34} rx={9} grad="brandDark" top topColor={ctx.brand} />
          <rect x={jx - 4} y={128} width={jw + 8} height={6} rx={3} fill={alpha("#000", 0.16)} />
          <BrandText ctx={ctx} y={102} fill={alpha(ctx.textOnBrand, 0.9)} size={6.4} />
          <rect x={jx + 18} y={154} width={jw - 36} height={26} rx={2} fill="#FBF8F4" opacity={0.95} />
          <BrandText ctx={ctx} y={165} fill={ctx.brandDark} size={5.6} maxWidth={jw - 48} />
          <LabelLines x={jx + 30} y={170} w={jw - 60} color={KOPI} rows={2} />
        </>
      )}
    </g>
  );
};

// Sikat mascara spiral.
function MascaraWand({ ctx, x, y, len = 64 }: { ctx: ArtCtx; x: number; y: number; len?: number }) {
  return (
    <g>
      <rect x={x - 2.2} y={y} width={4.4} height={len} rx={2.2} fill={`url(#${ctx.id}-cyl-ink)`} />
      <rect x={x - 5} y={y + len} width={10} height={40} rx={4} fill={darken(ctx.ink, 0.2)} />
      {Array.from({ length: 11 }).map((_, i) => (
        <path key={i} d={`M${x - 6.5} ${y + len + 3 + i * 3.4} Q${x} ${y + len + 1 + i * 3.4} ${x + 6.5} ${y + len + 3 + i * 3.4}`} stroke={lighten(ctx.ink, 0.12)} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      ))}
      <rect x={x - 1} y={y + len + 2} width={1.4} height={36} fill="#FFFFFF" opacity={0.2} />
    </g>
  );
}

const mascara: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bw = 24;
  const bx = detail ? 62 : 88;
  return (
    <g>
      <Floor ctx={ctx} rx={detail ? 44 : 20} offset={detail ? 14 : 0} />
      {/* Tabung ramping panjang, buram, gelap */}
      <Cyl ctx={ctx} x={bx} y={118} w={bw} h={90} rx={6} grad="tube" />
      <rect x={bx} y={118} width={bw} height={2.4} fill={alpha("#000", 0.3)} />
      {!detail ? (
        <>
          <Cyl ctx={ctx} x={bx - 2} y={44} w={bw + 4} h={76} rx={8} grad="tube" top topColor={lighten(ctx.tubeDark, 0.22)} />
          <rect x={bx - 2} y={112} width={bw + 4} height={2} fill={`url(#${ctx.id}-cyl-gold)`} />
          <BrandText ctx={ctx} x={bx + bw / 2 + 0.5} y={166} fill={alpha("#FFFFFF", 0.85)} size={5.4} rotate={-90} maxWidth={70} />
        </>
      ) : (
        <>
          <Cyl ctx={ctx} x={bx + 3} y={110} w={bw - 6} h={10} rx={2} grad="ink" />
          <BrandText ctx={ctx} x={bx + bw / 2 + 0.5} y={166} fill={alpha("#FFFFFF", 0.85)} size={5.4} rotate={-90} maxWidth={70} />
          {/* Tutup sekaligus gagang, sikat dicabut */}
          <Cyl ctx={ctx} x={116} y={34} w={28} h={64} rx={8} grad="tube" top topColor={lighten(ctx.tubeDark, 0.22)} />
          <rect x={116} y={92} width={28} height={2} fill={`url(#${ctx.id}-cyl-gold)`} />
          <MascaraWand ctx={ctx} x={130} y={98} len={56} />
        </>
      )}
    </g>
  );
};

function palettePans(ctx: ArtCtx) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return shiftHue(ctx.shade, (col - 1) * 18 + row * 8, 1 + row * 0.15, 1 - row * 0.16 + (col === 0 ? 0.12 : 0));
  });
}

const eyeshadowPalette: Shape = (ctx) => {
  const pans = palettePans(ctx);
  if (ctx.view === "detail") {
    const big = [pans[1], pans[4], pans[7]];
    return (
      <g>
        <rect x={20} y={40} width={160} height={92} rx={10} fill={`url(#${ctx.id}-cyl-brandDark)`} />
        <rect x={28} y={48} width={144} height={76} rx={6} fill={ctx.brandDeep} />
        {big.map((c, i) => {
          const cx = 52 + i * 48;
          return (
            <g key={i}>
              <circle cx={cx} cy={86} r={21} fill={darken(c, 0.15)} />
              <circle cx={cx} cy={85} r={20} fill={c} filter={i === 2 ? undefined : `url(#${ctx.id}-grain)`} />
              <circle cx={cx} cy={85} r={20} fill={`url(#${ctx.id}-sheen)`} opacity={i === 2 ? 0.5 : 0.2} />
              <ellipse cx={cx - 7} cy={76} rx={7} ry={3} fill="#FFFFFF" opacity={0.3} filter={`url(#${ctx.id}-blur-sm)`} />
              <path d={`M${cx - 10} ${92} Q${cx} ${98} ${cx + 10} ${92}`} stroke={darken(c, 0.25)} strokeWidth={1.2} fill="none" opacity={0.5} />
            </g>
          );
        })}
        <ellipse cx={100} cy={204} rx={76} ry={8} fill={alpha(KOPI, 0.16)} filter={`url(#${ctx.id}-blur)`} />
        {/* Swatch usapan di bawah tiap pan */}
        {big.map((c, i) => (
          <Smear key={i} ctx={ctx} x={28 + i * 48} y={150} w={46} h={28} color={c} texture={i === 2 ? "satin" : "bubuk"} rotate={-6 + i * 4} />
        ))}
      </g>
    );
  }
  return (
    <g>
      <Floor ctx={ctx} rx={66} />
      <rect x={36} y={50} width={128} height={76} rx={10} fill={`url(#${ctx.id}-cyl-brand)`} />
      <rect x={36} y={50} width={128} height={76} rx={10} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.45} />
      <rect x={45} y={58} width={110} height={60} rx={6} fill={`url(#${ctx.id}-mirror)`} />
      <path d="M52 114 L112 60 L128 60 L68 114 Z" fill="#FFFFFF" opacity={0.3} />
      <rect x={36} y={128} width={128} height={80} rx={10} fill={`url(#${ctx.id}-cyl-brandDark)`} />
      <rect x={36} y={128} width={128} height={3} fill={alpha("#FFF", 0.2)} />
      <rect x={44} y={136} width={112} height={64} rx={6} fill={ctx.brandDeep} />
      {pans.map((color, i) => {
        const cx = 64 + (i % 3) * 36;
        const cy = 150 + Math.floor(i / 3) * 20;
        const shimmer = i % 3 === 2;
        return (
          <g key={i}>
            <rect x={cx - 15} y={cy - 8} width={30} height={16} rx={3} fill={darken(color, 0.1)} />
            <rect x={cx - 15} y={cy - 8} width={30} height={16} rx={3} fill={color} opacity={0.85} filter={shimmer ? undefined : `url(#${ctx.id}-grain)`} />
            <rect x={cx - 15} y={cy - 8} width={30} height={16} rx={3} fill={`url(#${ctx.id}-sheen)`} opacity={shimmer ? 0.55 : 0.18} />
            {shimmer ? <ellipse cx={cx - 5} cy={cy - 3} rx={7} ry={2.5} fill="#FFFFFF" opacity={0.35} filter={`url(#${ctx.id}-blur-sm)`} /> : null}
          </g>
        );
      })}
      <BrandText ctx={ctx} y={205} fill={alpha(ctx.textOnBrandDark, 0.8)} size={5} />
    </g>
  );
};

const perfumeBottle: Shape = (ctx) => {
  if (ctx.view === "detail") {
    // Sudut 3/4: muka depan dan muka samping yang lebih gelap, pantulan diagonal.
    const front = "M58 104 L118 98 L124 116 L124 196 Q124 206 114 206 L62 206 Q52 206 52 196 L52 118 Z";
    const side = "M118 98 L146 108 L150 124 L150 196 Q150 204 142 204 L124 206 L124 116 Z";
    return (
      <g>
        <Floor ctx={ctx} rx={50} offset={2} />
        <defs>
          <clipPath id={`${ctx.id}-pf-front`}>
            <path d={front} />
          </clipPath>
          <clipPath id={`${ctx.id}-pf-side`}>
            <path d={side} />
          </clipPath>
        </defs>
        <path d={front} fill={mix("#FFFFFF", ctx.shade, 0.1)} />
        <path d={side} fill={mix("#FFFFFF", ctx.shade, 0.1)} />
        <g clipPath={`url(#${ctx.id}-pf-front)`}>
          <rect x={52} y={124} width={72} height={82} fill={`url(#${ctx.id}-liquid-h)`} />
          <rect x={52} y={124} width={72} height={82} fill={`url(#${ctx.id}-liquid)`} opacity={0.5} />
          <path d="M52 124 L124 120 L124 128 L52 132 Z" fill={lighten(ctx.shade, 0.35)} opacity={0.9} />
          <rect x={52} y={192} width={72} height={14} fill={KOPI} opacity={0.16} />
        </g>
        <g clipPath={`url(#${ctx.id}-pf-side)`}>
          <rect x={124} y={120} width={26} height={86} fill={darken(ctx.shade, 0.3)} />
          <rect x={124} y={120} width={26} height={86} fill={`url(#${ctx.id}-liquid)`} opacity={0.35} />
          <rect x={124} y={192} width={26} height={14} fill={KOPI} opacity={0.3} />
        </g>
        <path d={front} fill={`url(#${ctx.id}-glass)`} />
        <path d={side} fill={KOPI} opacity={0.18} />
        <path d={side} fill={`url(#${ctx.id}-sheen)`} opacity={0.25} />
        <g clipPath={`url(#${ctx.id}-pf-front)`}>
          <path d="M60 200 L104 100 L116 100 L72 200 Z" fill="#FFFFFF" opacity={0.3} />
          <rect x={58} y={112} width={5} height={86} rx={2.5} fill="#FFFFFF" opacity={0.55} filter={`url(#${ctx.id}-blur-sm)`} />
        </g>
        <path d={front} fill="none" stroke={KOPI} strokeOpacity={0.18} strokeWidth={0.8} />
        <path d={side} fill="none" stroke={KOPI} strokeOpacity={0.18} strokeWidth={0.8} />
        {/* Leher dan tutup berat */}
        <path d="M86 86 L112 84 L114 100 L88 102 Z" fill={`url(#${ctx.id}-cyl-gold)`} />
        <path d="M76 50 L120 46 L128 54 L128 86 L84 90 L76 82 Z" fill={`url(#${ctx.id}-cyl-brandDark)`} />
        <path d="M76 50 L120 46 L128 54 L84 58 Z" fill={lighten(ctx.brandDark, 0.25)} />
        <rect x={64} y={138} width={40} height={28} rx={2} fill="#FBF8F4" opacity={0.95} transform="skewY(-5)" />
        <rect x={64} y={138} width={40} height={28} rx={2} fill="none" stroke={ctx.gold} strokeWidth={0.8} opacity={0.8} transform="skewY(-5)" />
        <g transform="skewY(-5)">
          <BrandText ctx={ctx} x={84} y={151} fill={KOPI} size={5.2} maxWidth={32} />
          <LabelLines x={72} y={156} w={24} color={KOPI} rows={2} />
        </g>
      </g>
    );
  }
  const bw = 72;
  const bx = 64;
  const d = `M${bx + 8} 98 L${bx + bw - 8} 98 L${bx + bw} 118 L${bx + bw} 198 Q${bx + bw} 208 ${bx + bw - 8} 208 L${bx + 8} 208 Q${bx} 208 ${bx} 198 L${bx} 118 Z`;
  return (
    <g>
      <Floor ctx={ctx} rx={42} />
      <GlassBody ctx={ctx} d={d} box={{ x: bx, y: 98, w: bw, h: 110 }} liquidTop={120} wall={0.1} keyName="pf" />
      {/* Dasar kaca tebal dan faset bahu */}
      <path d={`M${bx} 186 L${bx + bw} 186 L${bx + bw} 198 Q${bx + bw} 208 ${bx + bw - 8} 208 L${bx + 8} 208 Q${bx} 208 ${bx} 198 Z`} fill={KOPI} opacity={0.12} />
      <path d={`M${bx} 118 L${bx + 8} 98 L${bx + 13} 106 L${bx + 5} 122 Z`} fill="#FFFFFF" opacity={0.55} />
      <path d={`M${bx + bw} 118 L${bx + bw - 8} 98 L${bx + bw - 13} 106 L${bx + bw - 5} 122 Z`} fill={KOPI} opacity={0.14} />
      <path d={`M${bx + 10} 200 L${bx + 40} 104 L${bx + 50} 104 L${bx + 20} 200 Z`} fill="#FFFFFF" opacity={0.22} />
      <Cyl ctx={ctx} x={90} y={84} w={20} h={16} rx={2} grad="gold" />
      <Cyl ctx={ctx} x={80} y={42} w={40} h={44} rx={6} grad="brandDark" top topColor={ctx.brand} />
      <rect x={bx + 16} y={134} width={bw - 32} height={30} rx={2} fill="#FBF8F4" opacity={0.95} />
      <rect x={bx + 16} y={134} width={bw - 32} height={30} rx={2} fill="none" stroke={ctx.gold} strokeWidth={0.8} opacity={0.8} />
      <BrandText ctx={ctx} y={147} fill={KOPI} size={5.4} maxWidth={bw - 40} />
      <LabelLines x={bx + 24} y={153} w={bw - 48} color={KOPI} rows={2} />
    </g>
  );
};

const lotionPump: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const bw = 58;
  const bx = detail ? 50 : 71;
  const cx = bx + bw / 2;
  const d = roundedBottle(bx, 108, bw, 100, 14, 12);
  return (
    <g>
      <Floor ctx={ctx} rx={detail ? 52 : 36} offset={detail ? 8 : 0} />
      {/* Plastik tinggi warna merek */}
      <path d={d} fill={`url(#${ctx.id}-cyl-brand)`} />
      <path d={d} fill={`url(#${ctx.id}-glass)`} opacity={0.3} />
      <rect x={bx + bw * 0.17} y={118} width={bw * 0.08} height={80} rx={3} fill="#FFFFFF" opacity={0.4} filter={`url(#${ctx.id}-blur-sm)`} />
      {/* Leher panjang dan pompa dengan nozzle menjorok ke samping */}
      <Cyl ctx={ctx} x={cx - 13} y={94} w={26} h={16} rx={3} grad="brandDark" />
      <Cyl ctx={ctx} x={cx - 5} y={62} w={10} h={34} rx={2} grad="brandDark" spec={false} />
      <path d={`M${cx - 10} 44 Q${cx - 10} 40 ${cx - 6} 40 L${cx + 8} 40 Q${cx + 12} 40 ${cx + 12} 44 L${cx + 12} 50 L${cx + 34} 50 Q${cx + 38} 50 ${cx + 38} 54 L${cx + 38} 58 L${cx + 32} 58 L${cx + 32} 56 L${cx + 12} 56 L${cx + 12} 64 L${cx - 10} 64 Z`} fill={`url(#${ctx.id}-cyl-brandDark)`} />
      <rect x={cx - 8} y={43} width={3} height={18} rx={1.5} fill="#FFFFFF" opacity={0.35} />
      <PaperLabel ctx={ctx} x={bx + 8} y={136} w={bw - 16} h={44} />
      {detail ? (
        <>
          <Drop ctx={ctx} x={cx + 35} y={70} size={5} color={ctx.cream} />
          {/* Setetes lotion jatuh ke permukaan */}
          <path d={`M${cx + 20} 194 Q${cx + 36} 180 ${cx + 56} 190 Q${cx + 62} 200 ${cx + 48} 204 Q${cx + 28} 206 ${cx + 20} 194 Z`} fill={ctx.cream} />
          <path d={`M${cx + 20} 194 Q${cx + 36} 180 ${cx + 56} 190 Q${cx + 62} 200 ${cx + 48} 204 Q${cx + 28} 206 ${cx + 20} 194 Z`} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.3} />
          <path d={`M${cx + 28} 192 Q${cx + 38} 186 ${cx + 50} 192`} stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.9} />
        </>
      ) : null}
    </g>
  );
};

const sheetMask: Shape = (ctx) => {
  const detail = ctx.view === "detail";
  const sachet = (x: number, y: number, w: number, h: number, rot = 0) => (
    <g transform={rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={`url(#${ctx.id}-cyl-brand)`} />
      <rect x={x} y={y} width={w} height={14} rx={8} fill={darken(ctx.brand, 0.18)} />
      <rect x={x} y={y + 8} width={w} height={6} fill={darken(ctx.brand, 0.18)} />
      {Array.from({ length: Math.floor(w / 7.5) }).map((_, i) => (
        <rect key={i} x={x + 4 + i * 7.5} y={y + 3} width={1.2} height={8} fill={alpha("#FFF", 0.4)} />
      ))}
      <rect x={x} y={y + h - 12} width={w} height={12} rx={6} fill={darken(ctx.brand, 0.18)} />
      <path d={`M${x + 12} ${y + h - 8} L${x + w - 32} ${y + 16} L${x + w - 14} ${y + 16} L${x + 30} ${y + h - 8} Z`} fill="#FFFFFF" opacity={0.2} />
      <path d={`M${x} ${y + 22} L${x + 4} ${y + 24} L${x} ${y + 26} Z`} fill={alpha(KOPI, 0.4)} />
      <ellipse cx={x + w / 2} cy={y + h * 0.42} rx={w * 0.2} ry={h * 0.2} fill={alpha("#FFFFFF", 0.85)} stroke={alpha(ctx.brandDark, 0.3)} strokeWidth={1} />
      <path d={`M${x + w / 2 - 8} ${y + h * 0.4} Q${x + w / 2 - 5} ${y + h * 0.37} ${x + w / 2 - 2} ${y + h * 0.4} M${x + w / 2 + 2} ${y + h * 0.4} Q${x + w / 2 + 5} ${y + h * 0.37} ${x + w / 2 + 8} ${y + h * 0.4}`} stroke={alpha(ctx.brandDark, 0.55)} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <path d={`M${x + w / 2 - 5} ${y + h * 0.5} Q${x + w / 2} ${y + h * 0.53} ${x + w / 2 + 5} ${y + h * 0.5}`} stroke={alpha(ctx.brandDark, 0.55)} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <BrandText ctx={ctx} x={x + w / 2} y={y + h * 0.76} fill={ctx.textOnBrand} size={Math.min(6.4, w / 14)} maxWidth={w - 16} />
      <text x={x + w / 2} y={y + h * 0.84} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize={4.6} letterSpacing={1} fill={alpha(ctx.textOnBrand, 0.75)}>
        SHEET MASK
      </text>
    </g>
  );
  if (detail) {
    return (
      <g>
        <ellipse cx={100} cy={206} rx={80} ry={9} fill={alpha(KOPI, 0.2)} filter={`url(#${ctx.id}-blur)`} />
        {sachet(22, 70, 74, 112, -8)}
        {/* Lembar masker putih terbuka, sedikit tembus essence */}
        <path d="M110 70 Q150 50 188 70 Q196 120 180 170 Q160 200 148 200 Q136 200 116 170 Q100 120 110 70 Z" fill="#FFFFFF" opacity={0.96} />
        <path d="M110 70 Q150 50 188 70 Q196 120 180 170 Q160 200 148 200 Q136 200 116 170 Q100 120 110 70 Z" fill={ctx.shadePale} opacity={0.35} />
        <path d="M110 70 Q150 50 188 70 Q196 120 180 170 Q160 200 148 200 Q136 200 116 170 Q100 120 110 70 Z" fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.18} />
        <ellipse cx={134} cy={104} rx={10} ry={5} fill={ctx.shadePale} opacity={0.9} />
        <ellipse cx={164} cy={104} rx={10} ry={5} fill={ctx.shadePale} opacity={0.9} />
        <path d="M144 128 Q149 124 154 128" stroke={alpha(KOPI, 0.3)} strokeWidth={1.2} fill="none" />
        <ellipse cx={149} cy={156} rx={11} ry={4.5} fill={ctx.shadePale} opacity={0.9} />
        <path d="M116 110 Q130 120 118 150 M182 110 Q168 120 180 150" stroke={alpha(KOPI, 0.12)} strokeWidth={1} fill="none" />
        <path d="M120 80 Q150 64 178 80" stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.9} />
      </g>
    );
  }
  return (
    <g>
      <Floor ctx={ctx} rx={56} />
      {sachet(46, 62, 108, 146)}
    </g>
  );
};

export const shapes: Record<Packaging, Shape> = {
  lipstick,
  lip_tint: lipTint,
  lip_cream: lipCream,
  cushion,
  foundation_bottle: foundationBottle,
  sunscreen_tube: sunscreenTube,
  serum_dropper: serumDropper,
  toner_bottle: tonerBottle,
  cream_jar: creamJar,
  mascara,
  eyeshadow_palette: eyeshadowPalette,
  perfume_bottle: perfumeBottle,
  lotion_pump: lotionPump,
  sheet_mask: sheetMask,
};

export const packagingLabels: Record<Packaging, string> = {
  lipstick: "Lipstick",
  lip_tint: "Lip tint",
  lip_cream: "Lip cream",
  cushion: "Cushion",
  foundation_bottle: "Botol foundation",
  sunscreen_tube: "Tube sunscreen",
  serum_dropper: "Botol serum pipet",
  toner_bottle: "Botol toner",
  cream_jar: "Jar krim",
  mascara: "Mascara",
  eyeshadow_palette: "Palet eyeshadow",
  perfume_bottle: "Botol parfum",
  lotion_pump: "Botol pompa",
  sheet_mask: "Sachet sheet mask",
};

export const detailLabels: Record<Packaging, string> = {
  lipstick: "Peluru keluar, tutup rebah",
  lip_tint: "Aplikator doe-foot dicabut",
  lip_cream: "Aplikator doe-foot dicabut",
  cushion: "Tertutup dari atas",
  foundation_bottle: "Olesan cairan shade",
  sunscreen_tube: "Tube rebah, krim keluar",
  serum_dropper: "Pipet terangkat, satu tetes",
  toner_bottle: "Kapas basah",
  cream_jar: "Tutup terbuka, tekstur krim",
  mascara: "Sikat dicabut",
  eyeshadow_palette: "Close-up 3 pan dan swatch",
  perfume_bottle: "Sudut 3/4 dengan pantulan",
  lotion_pump: "Setetes lotion",
  sheet_mask: "Lembar masker terbuka",
};

export { FLOOR_Y };
