// Lembar kontak ProductArt untuk pemeriksaan visual:
//   npx tsx scripts/render-product-art.tsx keluaran.svg
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { packagingValues } from "@/db/schema/enums";
import { ProductArt } from "@/components/product-art";

const shades = [
  { shade: "#B8475D", brand: "#C2416B", brandName: "Lumi" },
  { shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam" },
  { shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab" },
  { shade: "#4F6C8A", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
];
const out = process.argv[2] ?? "product-art-sheet.svg";
const cell = 200;
const rows = packagingValues.length;
const cols = shades.length + 1;

// Satu pohon render supaya useId menghasilkan id unik untuk tiap packshot.
const sheet = renderToStaticMarkup(
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
          <svg key={s.brandName} x={c * cell} y={r * cell * 1.2} width={cell} height={cell * 1.2} viewBox="0 0 200 240">
            <ProductArt packaging={p} shade={s.shade} brandColor={s.brand} brandName={s.brandName} />
          </svg>
        ))}
        <svg x={shades.length * cell} y={r * cell * 1.2} width={cell} height={cell * 1.2} viewBox="0 0 200 240">
          <ProductArt packaging={p} shade={shades[0].shade} brandColor={shades[0].brand} brandName={shades[0].brandName} view="side" />
        </svg>
      </g>
    ))}
  </svg>,
);
writeFileSync(out, sheet);
console.log("ditulis", out, sheet.length);
