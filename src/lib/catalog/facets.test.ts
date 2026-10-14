import { describe, expect, it } from "vitest";
import { computeFacets } from "./facets";
import { emptyFilters, type CatalogItem, type CatalogVariant } from "./filters";

const v = (over: Partial<CatalogVariant>): CatalogVariant => ({
  id: 1,
  shadeName: "S",
  shadeSlug: "s",
  hex: "#000000",
  undertone: null,
  depth: null,
  price: 50000,
  normalPrice: 50000,
  source: "normal",
  stockByLocation: {},
  ...over,
});
const p = (over: Partial<CatalogItem>): CatalogItem => ({
  id: 1,
  name: "P",
  slug: "p",
  brandSlug: "lumi",
  brandName: "Lumi",
  brandColor: "#000",
  categorySlug: "c",
  parentSlug: "pc",
  packaging: "lipstick",
  ratingAvg: 0,
  reviewCount: 0,
  soldCount: 0,
  isNew: false,
  isBestseller: false,
  publishedAt: "2026-01-01T00:00:00.000Z",
  skinTypes: [],
  concerns: [],
  finish: null,
  spf: null,
  relevance: 0,
  attrText: "",
  variants: [v({})],
  ...over,
});

const items: CatalogItem[] = [
  p({ id: 1, brandSlug: "lumi", skinTypes: ["berminyak"], finish: "matte", ratingAvg: 4.6, reviewCount: 5, variants: [v({ id: 1, price: 80000, normalPrice: 100000, undertone: "warm", stockByLocation: { dinoyo: 2 } }), v({ id: 2, price: 90000, normalPrice: 100000, undertone: "cool" })] }),
  p({ id: 2, brandSlug: "pualam", skinTypes: ["berminyak", "normal"], finish: "matte", spf: 50, ratingAvg: 4.2, reviewCount: 9, variants: [v({ id: 3, price: 150000, normalPrice: 150000, undertone: "neutral", stockByLocation: { dinoyo: 1, sawojajar: 4 } })] }),
  p({ id: 3, brandSlug: "kirana-lab", skinTypes: ["kering"], finish: null, ratingAvg: 3.5, reviewCount: 2, variants: [v({ id: 4, price: 120000, normalPrice: 120000, stockByLocation: { sawojajar: 2 } })] }),
];

describe("computeFacets", () => {
  it("tanpa filter: menghitung semua nilai beserta jumlah produk", () => {
    const fc = computeFacets(items, emptyFilters());
    expect(fc.brands).toEqual([
      { value: "kirana-lab", count: 1 },
      { value: "lumi", count: 1 },
      { value: "pualam", count: 1 },
    ]);
    expect(fc.skinTypes.find((s) => s.value === "berminyak")?.count).toBe(2);
    expect(fc.finishes).toEqual([{ value: "matte", count: 2 }]);
    expect(fc.undertones.map((u) => u.value).sort()).toEqual(["cool", "neutral", "warm"]);
    expect(fc.locations).toEqual([
      { value: "dinoyo", count: 2 },
      { value: "sawojajar", count: 2 },
    ]);
    expect(fc.spf).toBe(1);
    expect(fc.promo).toBe(1);
    expect(fc.ratings).toEqual([
      { value: "4.5", count: 1 },
      { value: "4", count: 2 },
      { value: "3", count: 3 },
    ]);
    expect(fc.price).toEqual({ min: 80000, max: 150000 });
  });
  it("dimensi sendiri diabaikan, dimensi lain diterapkan", () => {
    const f = { ...emptyFilters(), brands: ["lumi"], skinTypes: ["berminyak"] };
    const fc = computeFacets(items, f);
    // Merek: filter kulit berminyak berlaku, filter merek tidak: lumi dan pualam tetap tampil.
    expect(fc.brands).toEqual([
      { value: "lumi", count: 1 },
      { value: "pualam", count: 1 },
    ]);
    // Jenis kulit: filter merek berlaku, hanya nilai milik Lumi.
    expect(fc.skinTypes).toEqual([{ value: "berminyak", count: 1 }]);
    // Undertone hanya dari varian Lumi.
    expect(fc.undertones.map((u) => u.value).sort()).toEqual(["cool", "warm"]);
    expect(fc.price).toEqual({ min: 80000, max: 90000 });
  });
  it("filter varian membatasi facet lain lewat varian yang cocok", () => {
    const f = { ...emptyFilters(), location: "dinoyo" };
    const fc = computeFacets(items, f);
    expect(fc.brands.map((b) => b.value)).toEqual(["lumi", "pualam"]);
    expect(fc.undertones.map((u) => u.value).sort()).toEqual(["neutral", "warm"]);
    expect(fc.locations.map((l) => l.value)).toEqual(["dinoyo", "sawojajar"]);
    expect(fc.price).toEqual({ min: 80000, max: 150000 });
  });
  it("hasil kosong menghasilkan facet kosong dan harga null", () => {
    const fc = computeFacets([], emptyFilters());
    expect(fc.brands).toEqual([]);
    expect(fc.price).toBeNull();
  });
});
