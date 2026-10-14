// Packshot SVG inline (galeri produk, hero, route /art, OG, skrip lembar seni). Berat: memuat gambar semua kemasan.
import { useId } from "react";
import { cn } from "@/lib/utils";
import { MEREK } from "@/config/merek";
import { buildCtx } from "./context";
import { artLabel, type ProductArtProps } from "./index";
import { Defs } from "./primitives";
import { shapes } from "./shapes";

export { ShadeSwatchArt, swatchTextureLabels, type SwatchTexture } from "./swatch-art";

// Packshot SVG inline yang digambar dari data: dipakai galeri produk, hero, route /art dan OG, serta skrip lembar seni.
export function ProductArtInline({
  packaging,
  shade,
  brandColor,
  brandName,
  view = "depan",
  background = "soft",
  className,
  title,
  width,
}: ProductArtProps) {
  const rawId = useId();
  const id = `pa${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const ctx = buildCtx({ id, view, packaging, shade, brand: brandColor, brandName });
  const draw = shapes[packaging] ?? shapes.cream_jar;
  const label = artLabel({ packaging, brandName, view, title });
  return (
    <svg
      viewBox="0 0 200 240"
      width={width}
      height={typeof width === "number" ? width * 1.2 : undefined}
      role="img"
      aria-label={label}
      className={cn("block h-auto w-full select-none", className)}
      style={{ aspectRatio: "5 / 6" }}
    >
      <title>{label}</title>
      <Defs ctx={ctx} />
      {background === "soft" ? <rect width="200" height="240" rx={MEREK.productArt.sudut} fill={`url(#${id}-bg)`} /> : null}
      {draw(ctx)}
    </svg>
  );
}

