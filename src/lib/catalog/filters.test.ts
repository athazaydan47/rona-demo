import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
  applyFilters,
  countActiveFilters,
  emptyFilters,
  paginate,
  parseCatalogParams,
  serializeCatalogParams,
  sortItems,
  type CatalogItem,
  type CatalogVariant,
} from "./filters";

const variant = (over: Partial<CatalogVariant> = {}): CatalogVariant => ({
  id: 1,
  shadeName: "Standar",
  shadeSlug: "standar",
  hex: "#AAAAAA",
  undertone: null,
  depth: null,
  price: 100000,
  normalPrice: 100000,
  source: "normal",
  stockByLocation: { "gudang-online": 5, dinoyo: 0 },
  ...over,
});

const item = (over: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 1,
  name: "Produk",
  slug: "produk",
  brandSlug: "lumi",
  brandName: "Lumi",
  brandColor: "#C2416B",
  categorySlug: "lipstick",
  parentSlug: "bibir",
  packaging: "lipstick",
  ratingAvg: 4.5,
  reviewCount: 10,
  soldCount: 100,
  isNew: false,
  isBestseller: false,
  publishedAt: "2026-09-01T00:00:00.000Z",
  skinTypes: ["normal", "berminyak"],
  concerns: ["kusam"],
  finish: "matte",
  spf: null,
  relevance: 0,
  variants: [variant()],
  ...over,
});

const catalog: CatalogItem[] = [
  item({ id: 1, name: "Lipstick Lumi", soldCount: 300, variants: [variant({ id: 11, price: 89000, normalPrice: 99000, undertone: "warm" }), variant({ id: 12, price: 89000, normalPrice: 99000, undertone: "cool", stockByLocation: { dinoyo: 3 } })] }),
  item({ id: 2, name: "Cushion Pualam", brandSlug: "pualam", brandName: "Pualam", categorySlug: "cushion", parentSlug: "makeup-wajah", spf: 50, finish: "matte", ratingAvg: 4.8, reviewCount: 40, soldCount: 500, isBestseller: true, publishedAt: "2026-10-01T00:00:00.000Z", skinTypes: ["berminyak"], concerns: ["pori"], variants: [variant({ id: 21, price: 159000, normalPrice: 179000, undertone: "neutral" })] }),
  item({ id: 3, name: "Serum Kirana", brandSlug: "kirana-lab", brandName: "Kirana Lab", categorySlug: "serum-dan-essence", parentSlug: "skincare", finish: null, ratingAvg: 0, reviewCount: 0, soldCount: 50, isNew: true, publishedAt: "2026-10-10T00:00:00.000Z", skinTypes: ["kering"], concerns: ["dehidrasi"], variants: [variant({ id: 31, price: 129000, normalPrice: 129000 })] }),
];

describe("parseCatalogParams", () => {
  it("membaca semua parameter dari URL dan membuang nilai tidak sah", () => {
    const f = parseCatalogParams({
      q: " cusion ",
      merek: "lumi,pualam",
      harga_min: "50000",
      harga_maks: "abc",
      rating: "4",
      kulit: ["berminyak", "aneh"],
      masalah: "pori",
      finish: "matte,glowy",
      undertone: "warm",
      spf: "1",
      cabang: "Dinoyo",
      promo: "1",
      urut: "termurah",
      hal: "2",
    });
    expect(f.q).toBe("cusion");
    expect(f.brands).toEqual(["lumi", "pualam"]);
    expect(f.priceMin).toBe(50000);
    expect(f.priceMax).toBeNull();
    expect(f.ratingMin).toBe(4);
    expect(f.skinTypes).toEqual(["berminyak"]);
    expect(f.finishes).toEqual(["matte", "glowy"]);
    expect(f.spf).toBe(true);
    expect(f.location).toBe("dinoyo");
    expect(f.promo).toBe(true);
    expect(f.sort).toBe("termurah");
    expect(f.page).toBe(2);
  });
  it("memakai nilai bawaan untuk parameter kosong atau salah", () => {
    const f = parseCatalogParams({ urut: "ngawur", hal: "-3" });
    expect(f.sort).toBe("relevan");
    expect(f.page).toBe(1);
    expect(countActiveFilters(f)).toBe(0);
  });
  it("serialisasi bolak-balik menghasilkan URL yang sama dan bersih", () => {
    const f = parseCatalogParams({ merek: "lumi", kulit: "berminyak", urut: "rating", hal: "3", promo: "1" });
    const qs = serializeCatalogParams(f);
    expect(qs).toBe("merek=lumi&kulit=berminyak&promo=1&urut=rating&hal=3");
    expect(parseCatalogParams(Object.fromEntries(new URLSearchParams(qs)))).toEqual(f);
    expect(serializeCatalogParams(emptyFilters())).toBe("");
  });
});

describe("applyFilters", () => {
  it("menggabungkan filter produk dan varian (DAN antar dimensi, ATAU di dalam dimensi)", () => {
    const f = { ...emptyFilters(), skinTypes: ["berminyak", "kering"] };
    expect(applyFilters(catalog, f).map((i) => i.id)).toEqual([1, 2, 3]);
    const f2 = { ...f, finishes: ["matte"], priceMax: 100000 };
    expect(applyFilters(catalog, f2).map((i) => i.id)).toEqual([1]);
  });
  it("filter cabang hanya meloloskan produk yang punya varian dengan stok di cabang itu", () => {
    const f = { ...emptyFilters(), location: "dinoyo" };
    expect(applyFilters(catalog, f).map((i) => i.id)).toEqual([1]);
    const f2 = { ...f, undertones: ["warm"] }; // varian warm Lumi tidak ada di Dinoyo
    expect(applyFilters(catalog, f2)).toEqual([]);
  });
  it("filter promo, SPF, rating, dan merek", () => {
    expect(applyFilters(catalog, { ...emptyFilters(), promo: true }).map((i) => i.id)).toEqual([1, 2]);
    expect(applyFilters(catalog, { ...emptyFilters(), spf: true }).map((i) => i.id)).toEqual([2]);
    expect(applyFilters(catalog, { ...emptyFilters(), ratingMin: 4.6 }).map((i) => i.id)).toEqual([2]);
    expect(applyFilters(catalog, { ...emptyFilters(), brands: ["kirana-lab", "pualam"] }).map((i) => i.id)).toEqual([2, 3]);
  });
});

describe("sortItems dan paginate", () => {
  it("mengurutkan sesuai kunci", () => {
    const f = emptyFilters();
    expect(sortItems(catalog, { ...f, sort: "terlaris" }).map((i) => i.id)).toEqual([2, 1, 3]);
    expect(sortItems(catalog, { ...f, sort: "terbaru" }).map((i) => i.id)).toEqual([3, 2, 1]);
    expect(sortItems(catalog, { ...f, sort: "termurah" }).map((i) => i.id)).toEqual([1, 3, 2]);
    expect(sortItems(catalog, { ...f, sort: "termahal" }).map((i) => i.id)).toEqual([2, 3, 1]);
    expect(sortItems(catalog, { ...f, sort: "rating" }).map((i) => i.id)).toEqual([2, 1, 3]);
    expect(sortItems(catalog, { ...f, sort: "relevan" }).map((i) => i.id)).toEqual([2, 1, 3]);
  });
  it("relevan memakai skor pencarian bila ada kata kunci", () => {
    const scored = catalog.map((i) => ({ ...i, relevance: i.id === 3 ? 0.9 : 0.2 }));
    expect(sortItems(scored, { ...emptyFilters(), q: "serum" })[0].id).toBe(3);
  });
  it("memotong halaman", () => {
    const page = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(page).toEqual({ items: [3, 4], total: 5, hasMore: true });
    expect(paginate([1, 2], 1, 2).hasMore).toBe(false);
  });
});

describe("activeFilterChips", () => {
  it("membuat chip per nilai dan filter tanpa chip itu", () => {
    const f = parseCatalogParams({ merek: "lumi,pualam", harga_maks: "100000", cabang: "dinoyo" });
    const chips = activeFilterChips(f, { brands: { lumi: "Lumi" }, locations: { dinoyo: "Rona Dinoyo" } });
    expect(chips.map((c) => c.label)).toEqual(["Lumi", "pualam", "Di bawah Rp\u00A0100.000", "Tersedia di Rona Dinoyo"]);
    expect(chips[0].next.brands).toEqual(["pualam"]);
    expect(chips[2].next.priceMax).toBeNull();
    expect(chips[3].next.location).toBeNull();
  });
});
