import { useId } from "react";
import type { Packaging } from "@/db/schema/enums";
import { cn } from "@/lib/utils";
import { buildCtx, type ProductArtView } from "./context";
import { Defs } from "./primitives";
import { detailLabels, packagingLabels, shapes } from "./shapes";

export type { ProductArtView };
export { ShadeSwatchArt, swatchTextureLabels, type SwatchTexture } from "./swatch-art";

export type ProductArtProps = {
  packaging: Packaging;
  shade: string; // hex warna isi: shade varian, atau warna produk untuk skincare tanpa shade
  brandColor: string; // hex warna merek untuk badan kemasan
  brandName: string;
  view?: ProductArtView; // "depan" (packshot) atau "detail" (adegan pelengkap per bentuk)
  background?: "soft" | "none";
  className?: string;
  title?: string; // teks aksesibilitas, misal nama produk dan shade
  width?: number | string;
};

// Packshot SVG yang digambar dari data. Dirender di server, ukuran mengikuti lebar kontainer.
export function ProductArt({
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
  const label = title ?? `${packagingLabels[packaging]} ${brandName}${view === "detail" ? `, ${detailLabels[packaging].toLowerCase()}` : ""}`;
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
      {background === "soft" ? <rect width="200" height="240" rx="16" fill={`url(#${id}-bg)`} /> : null}
      {draw(ctx)}
    </svg>
  );
}

export { packagingLabels, detailLabels };
