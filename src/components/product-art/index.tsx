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

// Alamat berkas SVG packshot (route /art). Parameter diurutkan tetap supaya URL yang sama selalu identik (cache).
export function artSrc(p: Pick<ProductArtProps, "packaging" | "shade" | "brandColor" | "brandName" | "view" | "background">) {
  const q = new URLSearchParams({ p: p.packaging, s: p.shade.replace(/^#/, ""), b: p.brandColor.replace(/^#/, ""), n: p.brandName.slice(0, 40) });
  if (p.view === "detail") q.set("v", "detail");
  if (p.background === "none") q.set("bg", "none");
  return `/art?${q.toString()}`;
}

export function artLabel(p: Pick<ProductArtProps, "packaging" | "brandName" | "view" | "title">) {
  return p.title ?? `${packagingLabels[p.packaging]} ${p.brandName}${p.view === "detail" ? `, ${detailLabels[p.packaging].toLowerCase()}` : ""}`;
}

// Packshot sebagai <img> ke /art (bawaan sejak Fase 8A): ringan di HTML dan payload RSC, di-cache browser per
// packshot. priority untuk gambar di atas lipatan (LCP).
export function ProductArt({ packaging, shade, brandColor, brandName, view = "depan", background = "soft", className, title, width, priority = false }: ProductArtProps & { priority?: boolean }) {
  const label = artLabel({ packaging, brandName, view, title });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG dari route sendiri, tidak lewat optimasi next/image
    <img
      src={artSrc({ packaging, shade, brandColor, brandName, view, background })}
      alt={label}
      width={typeof width === "number" ? width : 200}
      height={typeof width === "number" ? width * 1.2 : 240}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      draggable={false}
      className={cn("block h-auto w-full select-none", className)}
      style={{ aspectRatio: "5 / 6" }}
    />
  );
}

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
      {background === "soft" ? <rect width="200" height="240" rx="16" fill={`url(#${id}-bg)`} /> : null}
      {draw(ctx)}
    </svg>
  );
}

export { packagingLabels, detailLabels };
