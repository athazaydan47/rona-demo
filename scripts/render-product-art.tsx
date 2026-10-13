// Lembar kontak ProductArt.
//   CLI: npx tsx scripts/render-product-art.tsx keluaran.svg
//   Modul: ArtGrid dan artSheetShades dipakai oleh scripts/cuplik-art.tsx.
import { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { packagingValues } from "@/db/schema/enums";
import { ProductArt, packagingLabels, type ProductArtView } from "@/components/product-art";

export type ArtShade = { label: string; shade: string; brand: string; brandName: string };

export const artSheetShades: ArtShade[] = [
  { label: "Lumi, 05 Mawar Tua", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi" },
  { label: "Pualam, 05W Madu", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam" },
  { label: "Kirana Lab, hijau", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab" },
  { label: "Dayu, Samudra", shade: "#4F6C8A", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
];

const viewLabel: Record<ProductArtView, string> = { depan: "Depan", detail: "Detail" };

// Grid HTML: satu baris per bentuk kemasan, kolom = shade x sudut pandang.
export function ArtGrid({
  shades,
  views,
  cellWidth,
  labelWidth = 180,
  gap = 12,
}: {
  shades: ArtShade[];
  views: ProductArtView[];
  cellWidth: number;
  labelWidth?: number;
  gap?: number;
}) {
  const cols = shades.length * views.length;
  return (
    <div
      className="art-grid"
      style={{ display: "grid", gridTemplateColumns: `${labelWidth}px repeat(${cols}, ${cellWidth}px)`, gap }}
    >
      <div />
      {shades.map((s) => (
        <div key={s.label} className="col-head" style={{ gridColumn: `span ${views.length}` }}>
          <span className="dot" style={{ background: s.shade }} />
          {s.label}
        </div>
      ))}
      <div />
      {shades.flatMap((s) =>
        views.map((v) => (
          <div key={`${s.label}-${v}`} className="sub-head">
            {viewLabel[v]}
          </div>
        )),
      )}
      {packagingValues.map((p) => (
        <Fragment key={p}>
          <div className="row-head">
            <b>{packagingLabels[p]}</b>
            <code>{p}</code>
          </div>
          {shades.flatMap((s) =>
            views.map((v) => (
              <div key={`${p}-${s.label}-${v}`} className="cell">
                <ProductArt packaging={p} shade={s.shade} brandColor={s.brand} brandName={s.brandName} view={v} />
              </div>
            )),
          )}
        </Fragment>
      ))}
    </div>
  );
}

// SVG tunggal (dipakai CLI lama).
export function renderArtSheetSvg(shades: ArtShade[] = artSheetShades) {
  const cell = 200;
  const rows = packagingValues.length;
  const cols = shades.length + 1;
  // Satu pohon render supaya useId menghasilkan id unik untuk tiap packshot.
  return renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={cols * cell}
      height={rows * cell * 1.2}
      viewBox={`0 0 ${cols * cell} ${rows * cell * 1.2}`}
      style={{ fontFamily: "'Plus Jakarta Sans', Helvetica, Arial, sans-serif" }}
    >
      <rect width="100%" height="100%" fill="#FAF7F5" />
      {packagingValues.map((p, r) => (
        <g key={p}>
          {shades.map((s, c) => (
            <svg key={s.label} x={c * cell} y={r * cell * 1.2} width={cell} height={cell * 1.2} viewBox="0 0 200 240">
              <ProductArt packaging={p} shade={s.shade} brandColor={s.brand} brandName={s.brandName} />
            </svg>
          ))}
          <svg x={shades.length * cell} y={r * cell * 1.2} width={cell} height={cell * 1.2} viewBox="0 0 200 240">
            <ProductArt packaging={p} shade={shades[0].shade} brandColor={shades[0].brand} brandName={shades[0].brandName} view="detail" />
          </svg>
        </g>
      ))}
    </svg>,
  );
}

if (process.argv[1]?.endsWith("render-product-art.tsx")) {
  const out = process.argv[2] ?? "product-art-sheet.svg";
  const svg = renderArtSheetSvg();
  writeFileSync(out, svg);
  console.log("ditulis", out, svg.length);
}
