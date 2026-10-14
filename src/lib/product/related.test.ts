import { describe, expect, it } from "vitest";
import type { CatalogItem, CatalogVariant } from "@/lib/catalog/filters";
import { pickSimilar, pickTogether } from "./related";

const v = (hex: string, price: number): CatalogVariant => ({ id: Math.round(Math.random() * 1e6), shadeName: "S", shadeSlug: "s", hex, undertone: null, depth: null, price, normalPrice: price, source: "normal", stockByLocation: { "gudang-online": 3 } });
let seq = 0;
const item = (name: string, categorySlug: string, parentSlug: string, soldCount: number, hex = "#CCCCCC", price = 100000): CatalogItem => ({
  id: ++seq,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  brandSlug: "x",
  brandName: "X",
  brandColor: "#000",
  categorySlug,
  parentSlug,
  packaging: "cream_jar",
  ratingAvg: 4,
  reviewCount: 1,
  soldCount,
  isNew: false,
  isBestseller: false,
  publishedAt: "2026-01-01T00:00:00.000Z",
  skinTypes: [],
  concerns: [],
  finish: null,
  spf: null,
  relevance: 0,
  attrText: "",
  variants: [v(hex, price)],
});

const catalog: CatalogItem[] = [
  item("Cushion A", "cushion", "makeup-wajah", 500, "#DAB085", 159000),
  item("Cushion B", "cushion", "makeup-wajah", 300, "#D0A47B", 189000),
  item("Cushion C", "cushion", "makeup-wajah", 100, "#4F6C8A", 99000),
  item("Sunscreen Gel", "sunscreen-wajah", "sun-care", 400),
  item("Sunscreen Mist", "sunscreen-wajah", "sun-care", 200),
  item("Primer", "primer-dan-setting-spray", "makeup-wajah", 150),
  item("Lip Tint", "lip-tint", "bibir", 350),
  item("Blush", "blush", "makeup-wajah", 250),
  item("Serum", "serum-dan-essence", "skincare", 600),
];
const ref = { id: catalog[0].id, categorySlug: "cushion", parentSlug: "makeup-wajah", hex: "#DAB085", price: 159000 };

describe("pickTogether", () => {
  it("memilih produk terlaris dari tiap sub kategori pelengkap, bukan kategori yang sama", () => {
    const r = pickTogether(catalog, ref);
    expect(r.map((i) => i.name)).toEqual(["Sunscreen Gel", "Primer", "Lip Tint"]);
    expect(r.every((i) => i.categorySlug !== "cushion")).toBe(true);
    expect(r.some((i) => i.id === ref.id)).toBe(false);
  });
  it("mengisi dari kategori induk lain bila peta pelengkap tidak lengkap", () => {
    const r = pickTogether(catalog, { ...ref, categorySlug: "kategori-tanpa-peta" });
    expect(r).toHaveLength(3);
    expect(r.every((i) => i.parentSlug !== "makeup-wajah")).toBe(true);
    expect(r[0].name).toBe("Serum"); // terlaris di luar induk
  });
});

describe("pickSimilar", () => {
  it("sub kategori sama, diurutkan dari warna dan harga paling mirip", () => {
    const r = pickSimilar(catalog, ref);
    expect(r.map((i) => i.name).slice(0, 2)).toEqual(["Cushion B", "Cushion C"]);
    expect(r.some((i) => i.id === ref.id)).toBe(false);
  });
  it("menambah cadangan dari induk yang sama bila hasil kurang dari 4", () => {
    const r = pickSimilar(catalog, ref, 8);
    expect(r.length).toBeGreaterThanOrEqual(4);
    expect(r.slice(2).every((i) => i.parentSlug === "makeup-wajah" && i.categorySlug !== "cushion")).toBe(true);
  });
});
