// Packshot ringan (Fase 8B): hanya <img> ke route /art dan label. Versi SVG inline (galeri, hero, OG) ada di
// ./inline supaya kode gambar semua kemasan tidak ikut bundel klien halaman katalog dan beranda.
import type { Packaging } from "@/db/schema/enums";
import { cn } from "@/lib/utils";
import { detailLabels, packagingLabels } from "./labels";

export type ProductArtView = "depan" | "detail";

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
      // Gambar prioritas (kandidat LCP) didekode biasa supaya langsung terlukis; sisanya asinkron.
      decoding={priority ? "auto" : "async"}
      draggable={false}
      className={cn("block h-auto w-full select-none", className)}
      style={{ aspectRatio: "5 / 6" }}
    />
  );
}

export { packagingLabels, detailLabels };
