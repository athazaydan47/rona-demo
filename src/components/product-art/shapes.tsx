import type { Packaging } from "@/db/schema/enums";
import { alpha, darken, lighten, mix, shiftHue } from "@/lib/color";
import { KOPI, type ArtCtx } from "./context";
import { BrandText, Cyl, FLOOR_Y, Floor, LabelLines } from "./primitives";

type Shape = (ctx: ArtCtx) => React.ReactNode;

// Setiap bentuk digambar di kanvas 200 x 240, lantai di y = 208, objek berpusat di x = 100.

const lipstick: Shape = (ctx) => {
  if (ctx.view === "side") {
    // Tertutup, berdiri: tutup di atas, badan di bawah.
    return (
      <g>
        <Floor ctx={ctx} rx={22} />
        <Cyl ctx={ctx} x={84} y={118} w={32} h={90} rx={5} grad="brandDark" />
        <rect x={84} y={118} width={32} height={3} fill={alpha("#000", 0.25)} />
        <Cyl ctx={ctx} x={83} y={40} w={34} h={78} rx={6} grad="brand" top topColor={ctx.brandLight} />
        <rect x={83} y={110} width={34} height={2.5} fill={`url(#${ctx.id}-cyl-gold)`} />
        <BrandText ctx={ctx} y={166} fill={alpha("#FFFFFF", 0.85)} size={5.2} rotate={-90} x={101} maxWidth={60} />
      </g>
    );
  }
  return (
    <g>
      <Floor ctx={ctx} rx={44} />
      {/* Tutup diletakkan di belakang, sedikit ke kiri */}
      <g opacity={0.95}>
        <Cyl ctx={ctx} x={44} y={88} w={30} h={120} rx={6} grad="brand" top topColor={ctx.brandLight} />
        <rect x={44} y={200} width={30} height={8} rx={2} fill={alpha("#000", 0.18)} />
      </g>
      {/* Badan bawah */}
      <Cyl ctx={ctx} x={100} y={138} w={34} h={70} rx={5} grad="brandDark" />
      {/* Kerah logam */}
      <Cyl ctx={ctx} x={102} y={120} w={30} h={20} rx={3} grad="gold" top topColor={lighten(ctx.gold, 0.4)} />
      {/* Peluru lipstik dengan ujung miring */}
      <path
        d={`M106 122 L106 82 Q106 72 114 68 L128 60 Q130 59 130 62 L130 122 Z`}
        fill={`url(#${ctx.id}-cyl-shade)`}
      />
      <path d={`M114 68 L128 60 Q130 59 130 62 L130 70 Z`} fill={lighten(ctx.shade, 0.18)} opacity={0.9} />
      <rect x={110} y={84} width={3.5} height={34} rx={1.6} fill="#FFFFFF" opacity={0.35} filter={`url(#${ctx.id}-blur-sm)`} />
      <BrandText ctx={ctx} x={117} y={176} fill={alpha("#FFFFFF", 0.8)} size={5} rotate={-90} maxWidth={52} />
    </g>
  );
};

const lipTint: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 34 : 48;
  const bx = 100 - bw / 2;
  const cw = side ? 26 : 36;
  const cx = 100 - cw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 22 : 30} />
      {/* Cairan di dalam botol kaca */}
      <rect x={bx} y={124} width={bw} height={84} rx={9} fill={`url(#${ctx.id}-liquid)`} />
      {/* Batang aplikator */}
      <rect x={98.5} y={110} width={3} height={78} rx={1.5} fill={darken(ctx.shade, 0.3)} opacity={0.7} />
      <ellipse cx={100} cy={190} rx={4.5} ry={8} fill={darken(ctx.shade, 0.28)} opacity={0.8} />
      {/* Dinding kaca */}
      <rect x={bx} y={108} width={bw} height={100} rx={9} fill="#FFFFFF" opacity={0.18} />
      <rect x={bx} y={108} width={bw} height={100} rx={9} fill={`url(#${ctx.id}-glass)`} />
      <rect x={bx + bw * 0.16} y={118} width={bw * 0.1} height={80} rx={2} fill="#FFFFFF" opacity={0.5} filter={`url(#${ctx.id}-blur-sm)`} />
      {/* Tutup */}
      <Cyl ctx={ctx} x={cx} y={56} w={cw} h={54} rx={5} grad="ink" top topColor={lighten(ctx.ink, 0.25)} />
      {!side ? <BrandText ctx={ctx} y={160} fill={alpha("#FFFFFF", 0.9)} size={5.4} maxWidth={40} /> : null}
    </g>
  );
};

const lipCream: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 24 : 32;
  const bx = 100 - bw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 18 : 24} />
      {/* Badan tabung buram berwarna shade */}
      <Cyl ctx={ctx} x={bx} y={94} w={bw} h={114} rx={8} grad="shade" />
      <rect x={bx} y={198} width={bw} height={10} rx={6} fill={alpha("#000", 0.12)} />
      {/* Tutup matte warna merek */}
      <Cyl ctx={ctx} x={bx - 1} y={46} w={bw + 2} h={50} rx={7} grad="brand" top topColor={ctx.brandLight} spec={false} />
      <rect x={bx - 1} y={92} width={bw + 2} height={2} fill={alpha("#000", 0.2)} />
      {!side ? (
        <>
          <BrandText ctx={ctx} y={150} fill={ctx.textOnShade} size={5.2} maxWidth={26} />
          <LabelLines x={bx + 6} y={158} w={bw - 12} color={ctx.textOnShade} />
        </>
      ) : null}
    </g>
  );
};

const cushion: Shape = (ctx) => {
  if (ctx.view === "side") {
    // Compact tertutup dari samping: cakram pipih
    return (
      <g>
        <Floor ctx={ctx} rx={58} />
        <rect x={40} y={176} width={120} height={32} rx={8} fill={`url(#${ctx.id}-cyl-brandDark)`} />
        <rect x={40} y={150} width={120} height={28} rx={8} fill={`url(#${ctx.id}-cyl-brand)`} />
        <rect x={40} y={176} width={120} height={2} fill={alpha("#000", 0.3)} />
        <ellipse cx={100} cy={150} rx={60} ry={9} fill={ctx.brandLight} />
        <ellipse cx={100} cy={150} rx={58} ry={7.5} fill={`url(#${ctx.id}-sheen)`} opacity={0.6} />
        <rect x={58} y={158} width={10} height={44} rx={4} fill="#FFFFFF" opacity={0.3} filter={`url(#${ctx.id}-blur-sm)`} />
        <BrandText ctx={ctx} y={169} fill={alpha(ctx.textOnBrand, 0.85)} size={6} />
      </g>
    );
  }
  return (
    <g>
      <Floor ctx={ctx} rx={60} />
      {/* Tutup terbuka dengan cermin */}
      <rect x={46} y={58} width={108} height={92} rx={16} fill={`url(#${ctx.id}-cyl-brand)`} />
      <rect x={46} y={58} width={108} height={92} rx={16} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.5} />
      <rect x={55} y={67} width={90} height={74} rx={11} fill={`url(#${ctx.id}-mirror)`} />
      <path d="M62 136 L118 70 L132 70 L76 136 Z" fill="#FFFFFF" opacity={0.35} />
      {/* Badan compact */}
      <rect x={38} y={166} width={124} height={42} rx={10} fill={`url(#${ctx.id}-cyl-brandDark)`} />
      <rect x={38} y={196} width={124} height={12} rx={6} fill={alpha("#000", 0.14)} />
      <ellipse cx={100} cy={166} rx={62} ry={14} fill={ctx.brand} />
      <ellipse cx={100} cy={166} rx={62} ry={14} fill={`url(#${ctx.id}-sheen)`} opacity={0.35} />
      {/* Spons berwarna shade di dalam */}
      <ellipse cx={100} cy={166} rx={50} ry={10.5} fill={darken(ctx.shade, 0.08)} />
      <ellipse cx={100} cy={165} rx={50} ry={10} fill={`url(#${ctx.id}-liquid)`} />
      <ellipse cx={82} cy={163} rx={16} ry={3.5} fill="#FFFFFF" opacity={0.25} filter={`url(#${ctx.id}-blur-sm)`} />
      {/* Puff bersandar di tepi */}
      <ellipse cx={134} cy={160} rx={22} ry={9} fill="#F6F0EB" />
      <ellipse cx={134} cy={158.5} rx={22} ry={8.5} fill="#FBF8F5" />
      <path d="M118 159 Q134 152 150 159" stroke={alpha(KOPI, 0.18)} strokeWidth={1.2} fill="none" />
      <BrandText ctx={ctx} y={192} fill={alpha(ctx.textOnBrand, 0.85)} size={6.2} />
    </g>
  );
};

const foundationBottle: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 44 : 60;
  const bx = 100 - bw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 28 : 36} />
      {/* Cairan foundation */}
      <path
        d={`M${bx} ${112} Q${bx} ${98} ${bx + 14} ${96} L${bx + bw - 14} ${96} Q${bx + bw} ${98} ${bx + bw} ${112} L${bx + bw} ${198} Q${bx + bw} ${208} ${bx + bw - 10} ${208} L${bx + 10} ${208} Q${bx} ${208} ${bx} ${198} Z`}
        fill={`url(#${ctx.id}-liquid)`}
      />
      {/* Kaca */}
      <path
        d={`M${bx} ${112} Q${bx} ${98} ${bx + 14} ${96} L${bx + bw - 14} ${96} Q${bx + bw} ${98} ${bx + bw} ${112} L${bx + bw} ${198} Q${bx + bw} ${208} ${bx + bw - 10} ${208} L${bx + 10} ${208} Q${bx} ${208} ${bx} ${198} Z`}
        fill={`url(#${ctx.id}-glass)`}
      />
      <rect x={bx + bw * 0.14} y={106} width={bw * 0.1} height={92} rx={3} fill="#FFFFFF" opacity={0.55} filter={`url(#${ctx.id}-blur-sm)`} />
      <rect x={bx + bw - 7} y={108} width={2} height={88} rx={1} fill="#FFFFFF" opacity={0.3} />
      {/* Kerah dan pompa */}
      <Cyl ctx={ctx} x={100 - (side ? 13 : 16)} y={80} w={side ? 26 : 32} h={18} rx={3} grad="ink" />
      <Cyl ctx={ctx} x={100 - (side ? 10 : 12)} y={52} w={side ? 20 : 24} h={30} rx={5} grad="ink" top topColor={lighten(ctx.ink, 0.3)} />
      {!side ? <rect x={110} y={56} width={18} height={8} rx={3} fill={`url(#${ctx.id}-cyl-ink)`} /> : <rect x={96} y={56} width={8} height={6} rx={2} fill={darken(ctx.ink, 0.2)} />}
      {!side ? (
        <>
          <rect x={bx + 10} y={140} width={bw - 20} height={28} rx={3} fill="#FFFFFF" opacity={0.85} />
          <BrandText ctx={ctx} y={154} fill={KOPI} size={5.6} maxWidth={bw - 26} />
          <LabelLines x={bx + 16} y={159} w={bw - 32} color={KOPI} />
        </>
      ) : null}
    </g>
  );
};

const sunscreenTube: Shape = (ctx) => {
  const side = ctx.view === "side";
  const body = mix(ctx.pastel, "#FFFFFF", 0.35);
  const topW = side ? 14 : 56;
  const botW = side ? 30 : 48;
  const cx = 100;
  const pathBody = `M${cx - botW / 2} 178 L${cx - topW / 2 - (side ? 0 : 2)} 70 L${cx + topW / 2 + (side ? 0 : 2)} 70 L${cx + botW / 2} 178 Z`;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 24 : 32} />
      <defs>
        <linearGradient id={`${ctx.id}-tube`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(body, 0.22)} />
          <stop offset="0.25" stopColor={lighten(body, 0.1)} />
          <stop offset="0.5" stopColor={body} />
          <stop offset="0.85" stopColor={darken(body, 0.08)} />
          <stop offset="1" stopColor={darken(body, 0.26)} />
        </linearGradient>
      </defs>
      {/* Badan tabung, berdiri di atas tutup flip */}
      <path d={pathBody} fill={`url(#${ctx.id}-tube)`} />
      <rect x={cx - topW / 2 - (side ? 0 : 2)} y={66} width={topW + (side ? 0 : 4)} height={6} rx={2} fill={darken(body, 0.18)} />
      <path d={pathBody} fill={`url(#${ctx.id}-glass)`} opacity={0.5} />
      <rect x={cx - botW / 2 + 7} y={80} width={side ? 3 : 4.5} height={90} rx={2} fill="#FFFFFF" opacity={0.5} filter={`url(#${ctx.id}-blur-sm)`} />
      {/* Pita warna merek dan aksen shade */}
      {!side ? (
        <>
          <path d="M72 104 L128 104 L130 122 L70 122 Z" fill={`url(#${ctx.id}-cyl-brand)`} />
          <path d="M70.6 124 L129.4 124 L130 128 L70 128 Z" fill={ctx.shade} opacity={0.9} />
          <BrandText ctx={ctx} y={116} fill={ctx.textOnBrand} size={6} maxWidth={48} />
          <LabelLines x={82} y={140} w={36} color={KOPI} rows={3} />
          <text x={100} y={166} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize={9} fontWeight={800} fill={ctx.brandDark}>
            SPF
          </text>
        </>
      ) : (
        <rect x={cx - 15} y={104} width={30} height={20} fill={ctx.brand} opacity={0.9} />
      )}
      {/* Tutup flip */}
      <Cyl ctx={ctx} x={cx - botW / 2 - 2} y={178} w={botW + 4} h={30} rx={5} grad="brand" spec={false} />
      <rect x={cx - botW / 2 - 2} y={178} width={botW + 4} height={2} fill={alpha("#FFF", 0.35)} />
    </g>
  );
};

const serumDropper: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 46 : 58;
  const bx = 100 - bw / 2;
  const glassTint = mix(ctx.shade, "#FFFFFF", 0.2);
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 28 : 34} />
      <defs>
        <linearGradient id={`${ctx.id}-amber`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(glassTint, 0.4)} />
          <stop offset="0.2" stopColor={darken(glassTint, 0.05)} />
          <stop offset="0.38" stopColor={lighten(glassTint, 0.2)} />
          <stop offset="0.6" stopColor={glassTint} />
          <stop offset="1" stopColor={darken(glassTint, 0.42)} />
        </linearGradient>
      </defs>
      {/* Botol kaca berwarna, bahu membulat */}
      <path
        d={`M${bx} 118 Q${bx} 100 ${bx + 16} 100 L${bx + bw - 16} 100 Q${bx + bw} 100 ${bx + bw} 118 L${bx + bw} 196 Q${bx + bw} 208 ${bx + bw - 12} 208 L${bx + 12} 208 Q${bx} 208 ${bx} 196 Z`}
        fill={`url(#${ctx.id}-amber)`}
      />
      {/* Pipet di dalam */}
      <rect x={98.6} y={102} width={2.8} height={92} rx={1.4} fill="#FFFFFF" opacity={0.35} />
      <rect x={bx + bw * 0.16} y={110} width={bw * 0.09} height={86} rx={2.5} fill="#FFFFFF" opacity={0.45} filter={`url(#${ctx.id}-blur-sm)`} />
      <rect x={bx + bw - 6} y={112} width={1.8} height={84} rx={1} fill="#FFFFFF" opacity={0.28} />
      {/* Kerah dan bulb pipet */}
      <Cyl ctx={ctx} x={86} y={86} w={28} h={16} rx={3} grad="ink" />
      <Cyl ctx={ctx} x={88} y={50} w={24} h={38} rx={11} grad="ink" top topColor={lighten(ctx.ink, 0.25)} />
      {!side ? (
        <>
          <rect x={bx + 9} y={138} width={bw - 18} height={34} rx={2} fill="#FBF8F4" opacity={0.95} />
          <BrandText ctx={ctx} y={152} fill={KOPI} size={5.6} maxWidth={bw - 26} />
          <LabelLines x={bx + 15} y={158} w={bw - 30} color={KOPI} rows={3} />
        </>
      ) : null}
    </g>
  );
};

const tonerBottle: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 46 : 60;
  const bx = 100 - bw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 28 : 36} />
      <Cyl ctx={ctx} x={bx} y={74} w={bw} h={134} rx={11} grad="pastel" />
      <rect x={bx} y={196} width={bw} height={12} rx={8} fill={alpha("#000", 0.1)} />
      {/* Tutup cakram */}
      <Cyl ctx={ctx} x={bx + 4} y={58} w={bw - 8} h={18} rx={4} grad="brand" top topColor={ctx.brandLight} />
      {!side ? (
        <>
          <rect x={bx} y={116} width={bw} height={44} fill="#FFFFFF" opacity={0.7} />
          <rect x={bx} y={116} width={bw} height={1.2} fill={ctx.brand} opacity={0.6} />
          <rect x={bx} y={158.8} width={bw} height={1.2} fill={ctx.brand} opacity={0.6} />
          <BrandText ctx={ctx} y={134} fill={ctx.brandDark} size={6.2} maxWidth={bw - 10} />
          <LabelLines x={bx + 12} y={142} w={bw - 24} color={KOPI} rows={3} />
        </>
      ) : null}
    </g>
  );
};

const creamJar: Shape = (ctx) => {
  const side = ctx.view === "side";
  const jw = side ? 84 : 96;
  const jx = 100 - jw / 2;
  const frosted = mix(ctx.shade, "#FFFFFF", 0.3);
  return (
    <g>
      <Floor ctx={ctx} rx={jw / 2 + 4} />
      <defs>
        <linearGradient id={`${ctx.id}-jar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(frosted, 0.24)} />
          <stop offset="0.3" stopColor={lighten(frosted, 0.14)} />
          <stop offset="0.55" stopColor={frosted} />
          <stop offset="0.9" stopColor={darken(frosted, 0.1)} />
          <stop offset="1" stopColor={darken(frosted, 0.28)} />
        </linearGradient>
      </defs>
      <rect x={jx} y={132} width={jw} height={76} rx={12} fill={`url(#${ctx.id}-jar)`} />
      <rect x={jx} y={194} width={jw} height={14} rx={10} fill={alpha("#000", 0.1)} />
      <rect x={jx + jw * 0.18} y={140} width={jw * 0.07} height={58} rx={3} fill="#FFFFFF" opacity={0.42} filter={`url(#${ctx.id}-blur-sm)`} />
      {/* Tutup lebih lebar */}
      <Cyl ctx={ctx} x={jx - 4} y={100} w={jw + 8} h={34} rx={9} grad="brand" top topColor={ctx.brandLight} />
      <rect x={jx - 4} y={128} width={jw + 8} height={6} rx={3} fill={alpha("#000", 0.16)} />
      {!side ? (
        <>
          <BrandText ctx={ctx} y={102} fill={alpha(ctx.textOnBrand, 0.9)} size={6.4} />
          <LabelLines x={jx + 24} y={160} w={jw - 48} color={ctx.textOnPastel} rows={3} />
        </>
      ) : null}
    </g>
  );
};

const mascara: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 24 : 28;
  const bx = 100 - bw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={20} />
      <Cyl ctx={ctx} x={bx} y={118} w={bw} h={90} rx={6} grad="brandDark" />
      <rect x={bx} y={118} width={bw} height={2.4} fill={alpha("#000", 0.3)} />
      <Cyl ctx={ctx} x={bx - 2} y={44} w={bw + 4} h={76} rx={8} grad="brand" top topColor={ctx.brandLight} />
      <rect x={bx - 2} y={112} width={bw + 4} height={2} fill={`url(#${ctx.id}-cyl-gold)`} />
      {!side ? <BrandText ctx={ctx} x={100.5} y={166} fill={alpha("#FFFFFF", 0.85)} size={5.4} rotate={-90} maxWidth={70} /> : null}
      <ellipse cx={100} cy={200} rx={bw / 2 - 2} ry={1.5} fill={ctx.shade} opacity={0.9} />
    </g>
  );
};

const eyeshadowPalette: Shape = (ctx) => {
  if (ctx.view === "side") {
    return (
      <g>
        <Floor ctx={ctx} rx={66} />
        <rect x={34} y={166} width={132} height={42} rx={7} fill={`url(#${ctx.id}-cyl-brandDark)`} />
        <rect x={34} y={166} width={132} height={20} rx={6} fill={`url(#${ctx.id}-cyl-brand)`} />
        <rect x={34} y={185} width={132} height={1.6} fill={alpha("#000", 0.35)} />
        <rect x={34} y={166} width={132} height={4} rx={2} fill={`url(#${ctx.id}-sheen)`} opacity={0.7} />
        <BrandText ctx={ctx} y={179.5} fill={alpha(ctx.textOnBrand, 0.85)} size={6} />
      </g>
    );
  }
  const pans = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const hueShift = (col - 1) * 18 + row * 8;
    const light = 1 - row * 0.16 + (col === 0 ? 0.12 : 0);
    const sat = 1 + row * 0.15;
    return shiftHue(ctx.shade, hueShift, sat, light);
  });
  return (
    <g>
      <Floor ctx={ctx} rx={66} />
      {/* Tutup terbuka dengan cermin */}
      <rect x={36} y={50} width={128} height={76} rx={10} fill={`url(#${ctx.id}-cyl-brand)`} />
      <rect x={36} y={50} width={128} height={76} rx={10} fill={`url(#${ctx.id}-fade-bottom)`} opacity={0.45} />
      <rect x={45} y={58} width={110} height={60} rx={6} fill={`url(#${ctx.id}-mirror)`} />
      <path d="M52 114 L112 60 L128 60 L68 114 Z" fill="#FFFFFF" opacity={0.3} />
      {/* Badan palet */}
      <rect x={36} y={128} width={128} height={80} rx={10} fill={`url(#${ctx.id}-cyl-brandDark)`} />
      <rect x={36} y={128} width={128} height={3} fill={alpha("#FFF", 0.2)} />
      <rect x={44} y={136} width={112} height={64} rx={6} fill={darken(ctx.brandDark, 0.3)} />
      {pans.map((color, i) => {
        const cx = 64 + (i % 3) * 36;
        const cy = 150 + Math.floor(i / 3) * 20;
        const shimmer = i % 3 === 2;
        return (
          <g key={i}>
            <rect x={cx - 15} y={cy - 8} width={30} height={16} rx={3} fill={darken(color, 0.1)} />
            <rect x={cx - 15} y={cy - 8} width={30} height={16} rx={3} fill={`url(#${ctx.id}-sheen)`} opacity={shimmer ? 0.55 : 0.18} />
            <rect x={cx - 15} y={cy - 8} width={30} height={16} rx={3} fill={color} opacity={0.82} />
            {shimmer ? <ellipse cx={cx - 5} cy={cy - 3} rx={7} ry={2.5} fill="#FFFFFF" opacity={0.35} filter={`url(#${ctx.id}-blur-sm)`} /> : null}
          </g>
        );
      })}
      <BrandText ctx={ctx} y={205} fill={alpha(ctx.textOnBrand, 0.8)} size={5} />
    </g>
  );
};

const perfumeBottle: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 44 : 68;
  const bx = 100 - bw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 28 : 40} />
      {/* Cairan parfum */}
      <path d={`M${bx + 6} 104 L${bx + bw - 6} 104 L${bx + bw} 118 L${bx + bw} 200 Q${bx + bw} 208 ${bx + bw - 8} 208 L${bx + 8} 208 Q${bx} 208 ${bx} 200 L${bx} 118 Z`} fill={`url(#${ctx.id}-liquid)`} />
      <rect x={bx + 2} y={104} width={bw - 4} height={14} fill="#FFFFFF" opacity={0.22} />
      {/* Kaca tebal dengan faset */}
      <path d={`M${bx + 6} 96 L${bx + bw - 6} 96 L${bx + bw} 118 L${bx + bw} 200 Q${bx + bw} 208 ${bx + bw - 8} 208 L${bx + 8} 208 Q${bx} 208 ${bx} 200 L${bx} 118 Z`} fill={`url(#${ctx.id}-glass)`} />
      <path d={`M${bx} 118 L${bx + 6} 96 L${bx + 10} 104 L${bx + 5} 122 Z`} fill="#FFFFFF" opacity={0.5} />
      <path d={`M${bx + bw} 118 L${bx + bw - 6} 96 L${bx + bw - 10} 104 L${bx + bw - 5} 122 Z`} fill={KOPI} opacity={0.12} />
      <rect x={bx + bw * 0.13} y={110} width={bw * 0.08} height={90} rx={2.5} fill="#FFFFFF" opacity={0.6} filter={`url(#${ctx.id}-blur-sm)`} />
      <rect x={bx + bw - 7} y={120} width={2} height={80} rx={1} fill="#FFFFFF" opacity={0.4} />
      {/* Leher dan tutup */}
      <Cyl ctx={ctx} x={90} y={84} w={20} h={14} rx={2} grad="gold" />
      <Cyl ctx={ctx} x={100 - (side ? 14 : 18)} y={46} w={side ? 28 : 36} h={40} rx={6} grad="brandDark" top topColor={ctx.brand} />
      {!side ? (
        <>
          <rect x={bx + 14} y={134} width={bw - 28} height={30} rx={2} fill="#FBF8F4" opacity={0.95} />
          <rect x={bx + 14} y={134} width={bw - 28} height={30} rx={2} fill="none" stroke={ctx.gold} strokeWidth={0.8} opacity={0.8} />
          <BrandText ctx={ctx} y={147} fill={KOPI} size={5.4} maxWidth={bw - 34} />
          <LabelLines x={bx + 20} y={153} w={bw - 40} color={KOPI} rows={2} />
        </>
      ) : null}
    </g>
  );
};

const lotionPump: Shape = (ctx) => {
  const side = ctx.view === "side";
  const bw = side ? 50 : 64;
  const bx = 100 - bw / 2;
  return (
    <g>
      <Floor ctx={ctx} rx={side ? 30 : 38} />
      <path
        d={`M${bx} 112 Q${bx} 98 ${bx + 14} 98 L${bx + bw - 14} 98 Q${bx + bw} 98 ${bx + bw} 112 L${bx + bw} 198 Q${bx + bw} 208 ${bx + bw - 10} 208 L${bx + 10} 208 Q${bx} 208 ${bx} 198 Z`}
        fill={`url(#${ctx.id}-cyl-pastel)`}
      />
      <rect x={bx + bw * 0.17} y={108} width={bw * 0.08} height={90} rx={3} fill="#FFFFFF" opacity={0.45} filter={`url(#${ctx.id}-blur-sm)`} />
      <rect x={bx + bw - 5} y={110} width={1.6} height={86} rx={1} fill="#FFFFFF" opacity={0.3} />
      {/* Kerah pompa */}
      <Cyl ctx={ctx} x={100 - 14} y={82} w={28} h={18} rx={3} grad="brand" />
      {/* Batang dan kepala pompa */}
      <Cyl ctx={ctx} x={100 - 5} y={64} w={10} h={20} rx={2} grad="brandDark" spec={false} />
      {side ? (
        <>
          <Cyl ctx={ctx} x={100 - 11} y={46} w={22} h={20} rx={5} grad="brand" top topColor={ctx.brandLight} />
          <rect x={96} y={50} width={8} height={8} rx={2} fill={ctx.brandDark} />
        </>
      ) : (
        <>
          <path d="M90 50 Q90 46 94 46 L110 46 Q114 46 114 50 L114 60 L130 60 Q134 60 134 64 L134 66 L128 66 L128 64 L114 64 L114 66 L90 66 Z" fill={`url(#${ctx.id}-cyl-brand)`} />
          <rect x={92} y={48} width={3} height={14} rx={1.5} fill="#FFFFFF" opacity={0.35} />
        </>
      )}
      {!side ? (
        <>
          <rect x={bx + 8} y={132} width={bw - 16} height={46} rx={3} fill="#FFFFFF" opacity={0.75} />
          <BrandText ctx={ctx} y={148} fill={ctx.brandDark} size={6} maxWidth={bw - 24} />
          <LabelLines x={bx + 16} y={156} w={bw - 32} color={KOPI} rows={4} />
        </>
      ) : null}
    </g>
  );
};

const sheetMask: Shape = (ctx) => {
  const side = ctx.view === "side";
  if (side) {
    // Sachet dilihat dari samping: tipis, sedikit melengkung
    return (
      <g>
        <Floor ctx={ctx} rx={16} />
        <path d="M94 70 Q84 140 94 208 L106 208 Q116 140 106 70 Z" fill={`url(#${ctx.id}-cyl-pastel)`} />
        <path d="M96 72 Q88 140 96 206 L99 206 Q92 140 99 72 Z" fill="#FFFFFF" opacity={0.5} />
        <rect x={94} y={70} width={12} height={10} fill={darken(ctx.pastel, 0.12)} />
      </g>
    );
  }
  const face = mix(ctx.pastel, "#FFFFFF", 0.4);
  return (
    <g>
      <Floor ctx={ctx} rx={56} />
      <defs>
        <linearGradient id={`${ctx.id}-sachet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(ctx.pastel, 0.12)} />
          <stop offset="0.5" stopColor={ctx.pastel} />
          <stop offset="1" stopColor={darken(ctx.pastel, 0.14)} />
        </linearGradient>
      </defs>
      <rect x={46} y={62} width={108} height={146} rx={8} fill={`url(#${ctx.id}-sachet)`} />
      {/* Tepi pres atas dan bawah */}
      <rect x={46} y={62} width={108} height={14} rx={8} fill={darken(ctx.pastel, 0.1)} />
      <rect x={46} y={70} width={108} height={6} fill={darken(ctx.pastel, 0.1)} />
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={i} x={50 + i * 7.5} y={65} width={1.2} height={8} fill={alpha("#FFF", 0.5)} />
      ))}
      <rect x={46} y={196} width={108} height={12} rx={6} fill={darken(ctx.pastel, 0.1)} />
      {/* Kilau plastik diagonal */}
      <path d="M58 200 L122 78 L140 78 L76 200 Z" fill="#FFFFFF" opacity={0.28} />
      <path d="M48 120 L48 90 Q60 80 70 100 Q58 110 48 120 Z" fill="#FFFFFF" opacity={0.18} />
      {/* Ikon wajah sederhana */}
      <ellipse cx={100} cy={128} rx={24} ry={30} fill={face} stroke={alpha(ctx.brandDark, 0.35)} strokeWidth={1} />
      <path d="M90 124 Q94 121 98 124 M102 124 Q106 121 110 124" stroke={alpha(ctx.brandDark, 0.5)} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M94 140 Q100 144 106 140" stroke={alpha(ctx.brandDark, 0.5)} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <BrandText ctx={ctx} y={178} fill={ctx.brandDark} size={6.4} />
      <text x={100} y={188} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontSize={5} letterSpacing={1} fill={alpha(ctx.textOnPastel, 0.7)}>
        SHEET MASK
      </text>
      {/* Takik sobek */}
      <path d="M46 84 L50 86 L46 88 Z" fill={alpha(KOPI, 0.35)} />
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

export { FLOOR_Y };
