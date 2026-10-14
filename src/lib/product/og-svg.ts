// Serialisasi pohon elemen ProductArt menjadi string SVG tanpa react-dom/server (yang tidak boleh diimpor di App Router).
// Hanya mendukung elemen intrinsik SVG, Fragment, dan komponen fungsi tanpa hook, cukup untuk ProductArt.
import { Fragment, isValidElement, type ReactNode } from "react";
import type { Packaging } from "@/db/schema/enums";
import { buildCtx, type ProductArtView } from "@/components/product-art/context";
import { Defs } from "@/components/product-art/primitives";
import { shapes } from "@/components/product-art/shapes";
import { MEREK } from "@/config/merek";

const keepCamel = new Set([
  "viewBox", "baseFrequency", "numOctaves", "stdDeviation", "xChannelSelector", "yChannelSelector", "textLength", "lengthAdjust",
  "clipPathUnits", "gradientUnits", "gradientTransform", "patternUnits", "preserveAspectRatio", "spreadMethod", "stitchTiles",
  "surfaceScale", "specularExponent", "specularConstant", "tableValues", "primitiveUnits", "filterUnits", "maskUnits", "maskContentUnits",
  "markerWidth", "markerHeight", "refX", "refY", "startOffset", "pointsAtX", "pointsAtY", "pointsAtZ", "limitingConeAngle", "diffuseConstant",
  "kernelMatrix", "kernelUnitLength", "edgeMode", "targetX", "targetY", "attributeName", "attributeType", "repeatCount", "keyTimes", "keySplines",
]);

function attrName(key: string) {
  if (key === "className") return "class";
  if (key === "htmlFor") return "for";
  if (keepCamel.has(key)) return key;
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function styleString(style: Record<string, unknown>) {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${String(v)}`)
    .join(";");
}

export function renderStatic(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return esc(node);
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(renderStatic).join("");
  if (!isValidElement(node)) return "";
  const el = node as React.ReactElement<Record<string, unknown>>;
  const { type, props } = el;
  if (type === Fragment) return renderStatic(props.children as ReactNode);
  if (typeof type === "function") {
    const Comp = type as (p: Record<string, unknown>) => ReactNode;
    return renderStatic(Comp(props));
  }
  if (typeof type !== "string") return "";
  const attrs: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || key === "ref" || value == null || value === false) continue;
    if (key === "dangerouslySetInnerHTML") continue;
    if (key === "style" && typeof value === "object") {
      const css = styleString(value as Record<string, unknown>);
      if (css) attrs.push(`style="${esc(css)}"`);
      continue;
    }
    if (typeof value === "object") continue;
    attrs.push(`${attrName(key)}="${esc(String(value))}"`);
  }
  const inner = (props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html ?? renderStatic(props.children as ReactNode);
  return `<${type}${attrs.length ? " " + attrs.join(" ") : ""}>${inner}</${type}>`;
}

// Isi SVG ProductArt (tanpa elemen <svg> luar) untuk disematkan ke kanvas OG.
export function productArtInnerSvg(input: { packaging: Packaging; shade: string; brandColor: string; brandName: string }) {
  const ctx = buildCtx({ id: "og", view: "depan", packaging: input.packaging, shade: input.shade, brand: input.brandColor, brandName: input.brandName });
  const draw = shapes[input.packaging] ?? shapes.cream_jar;
  return renderStatic(Defs({ ctx })) + renderStatic(draw(ctx));
}

function escText(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

// Berkas SVG ProductArt lengkap untuk route /art (id tetap karena satu berkas berisi satu packshot).
export function productArtSvg(input: { packaging: Packaging; shade: string; brandColor: string; brandName: string; view?: ProductArtView; background?: "soft" | "none"; title?: string }) {
  const id = "art";
  const ctx = buildCtx({ id, view: input.view ?? "depan", packaging: input.packaging, shade: input.shade, brand: input.brandColor, brandName: input.brandName });
  const draw = shapes[input.packaging] ?? shapes.cream_jar;
  const bg = input.background === "none" ? "" : `<rect width="200" height="240" rx="${MEREK.productArt.sudut}" fill="url(#${id}-bg)"></rect>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240" role="img">${input.title ? `<title>${escText(input.title)}</title>` : ""}${renderStatic(Defs({ ctx }))}${bg}${renderStatic(draw(ctx))}</svg>`;
}
