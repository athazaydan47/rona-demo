// Lembar review ProductArt: 14 bentuk, tampak depan dan samping, dalam 3 shade.
//   npm run cuplik:art            (opsional: -- --nama=art)
// Hasil: _review/cuplik-<nama>-<YYYYMMDD-HHmm>-1.jpg
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { formatBytes, labelWib, launchBrowser, screenshotHtmlToJpeg, stampWib } from "./screenshot.mjs";
import { ArtGrid, artSheetShades } from "./render-product-art";

const WIDTH = 2400;
const PAD = 24;
const LABEL_W = 180;
const GAP = 12;

function argValue(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const CSS = `
  :root { color-scheme: light; --font-teks: "Plus Jakarta Sans", -apple-system, "Helvetica Neue", Arial, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #EFE8E4; color: #2A1F1D; font-family: var(--font-teks); }
  .sheet { width: ${WIDTH}px; padding: ${PAD}px; }
  header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
  h1 { margin: 0; font: 600 26px/1.2 Georgia, "Times New Roman", serif; }
  .meta { font-size: 15px; color: #6E615D; }
  .col-head { display: flex; align-items: center; gap: 8px; justify-content: center; font-size: 16px; font-weight: 700; padding: 8px; background: #fff; border: 1px solid #DCD2CD; border-radius: 10px; }
  .dot { width: 14px; height: 14px; border-radius: 99px; border: 1px solid rgba(0,0,0,.12); }
  .sub-head { text-align: center; font-size: 13px; color: #6E615D; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .row-head { display: flex; flex-direction: column; justify-content: center; gap: 4px; font-size: 16px; padding-right: 8px; }
  .row-head code { font-size: 12px; color: #6E615D; }
  .cell { background: #fff; border: 1px solid #DCD2CD; border-radius: 12px; padding: 6px; }
  .cell svg { display: block; width: 100%; height: auto; }
`;

async function main() {
  const nama = (argValue("nama") ?? "art").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const shades = artSheetShades.slice(0, 3);
  const views = ["depan", "detail"] as const;
  const cols = shades.length * views.length;
  const cellWidth = Math.floor((WIDTH - PAD * 2 - LABEL_W - GAP * cols) / cols);

  const now = new Date();
  const stamp = stampWib(now);
  const outDir = path.resolve("_review");
  const tmpDir = path.join(outDir, `.tmp-${nama}-${stamp}-${process.pid}`);
  mkdirSync(tmpDir, { recursive: true });

  const html =
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="id">
        {/* HTML mandiri untuk Playwright, bukan halaman Next. */}
        {/* eslint-disable-next-line @next/next/no-head-element */}
        <head>
          <meta charSet="utf-8" />
          <title>ProductArt</title>
          <style dangerouslySetInnerHTML={{ __html: CSS }} />
        </head>
        <body>
          <div className="sheet">
            <header>
              <h1>Rona Beauty, ProductArt: 14 bentuk, depan dan detail, 3 shade</h1>
              <div className="meta">{labelWib(now)}</div>
            </header>
            <ArtGrid shades={shades} views={[...views]} cellWidth={cellWidth} labelWidth={LABEL_W} gap={GAP} />
          </div>
        </body>
      </html>,
    );
  const htmlPath = path.join(tmpDir, "art.html");
  writeFileSync(htmlPath, html);

  const out = path.join(outDir, `cuplik-${nama}-${stamp}-1.jpg`);
  const browser = await launchBrowser();
  try {
    const { bytes, quality } = await screenshotHtmlToJpeg(browser, htmlPath, out, { width: WIDTH });
    console.log(`1 lembar dibuat di _review/:`);
    console.log(`  ${path.relative(process.cwd(), out)}  ${formatBytes(bytes)}${quality !== 80 ? `  (kualitas diturunkan ke ${quality})` : ""}`);
    console.log(`  ukuran sel ${cellWidth} x ${Math.round(cellWidth * 1.2)} px`);
  } finally {
    await browser.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
