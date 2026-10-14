import { describe, expect, it } from "vitest";
import { formatRupiah } from "@/lib/format";
import {
  activeFilterChips,
  applyFilters,
  countActiveFilters,
  emptyFilters,
  hardFilters,
  loosenedText,
  paginate,
  rankInterpreted,
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
  attrText: "",
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

describe("tafsiran pencarian: filter wajib dan penambah peringkat", () => {
  // Lima lipstik, dua tint, satu cushion. Hanya Satin Lembap yang satin dan melembapkan sekaligus.
  const catalog = [
    item({ id: 1, name: "Satin Lembap", finish: "satin", attrText: "melembapkan bibir", soldCount: 10 }),
    item({ id: 2, name: "Matte Lembap", finish: "matte", attrText: "melembapkan, tahan lama", soldCount: 90 }),
    item({ id: 3, name: "Matte Kering", finish: "matte", attrText: "tahan lama", soldCount: 300 }),
    item({ id: 4, name: "Satin Biasa", finish: "satin", attrText: "warna cantik", soldCount: 50 }),
    item({ id: 5, name: "Glossy Lembap", finish: "glowy", attrText: "lembap seharian", soldCount: 20 }),
    item({ id: 6, name: "Tint Lembap", categorySlug: "lip-tint", finish: "glowy", attrText: "lembap", soldCount: 500 }),
    item({ id: 7, name: "Tint Murah", categorySlug: "lip-tint", finish: "satin", attrText: "", soldCount: 400, variants: [variant({ price: 40000, normalPrice: 40000 })] }),
    item({ id: 8, name: "Cushion", categorySlug: "cushion", parentSlug: "makeup-wajah", finish: "satin", attrText: "melembapkan" }),
  ];
  const lipstick = { ...emptyFilters(), q: "lipstik yang ga bikin bibir kering buat kondangan", category: "lipstick", finishes: ["satin"], attributes: ["melembapkan"], keyword: "kondangan", interpreted: true };

  it("hanya kategori, merek, dan harga yang wajib; finish, atribut, dan kata sisa tidak menyaring", () => {
    expect(hardFilters(lipstick)).toMatchObject({ category: "lipstick", finishes: [], attributes: [] });
    const r = rankInterpreted(catalog, lipstick);
    expect(r.items.map((i) => i.id).sort()).toEqual([1, 2, 3, 4, 5]); // semua lipstik, bukan hanya 1 produk
    expect(r.items[0].id).toBe(1); // cocok satin dan melembapkan
    // Hanya 1 yang cocok semuanya: kata "kondangan" lalu Satin dilepas (urutan prioritas), Melembapkan dipertahankan.
    expect(loosenedText(r.loosened)).toBe('Kami longgarkan: tanpa kata "kondangan", tanpa Satin.');
    expect(r.items.slice(0, 3).map((i) => i.id)).toEqual([1, 2, 5]);
  });
  it("tanpa tafsiran, filter tetap wajib seperti biasa", () => {
    const manual = { ...lipstick, interpreted: false };
    expect(applyFilters(catalog, manual).map((i) => i.id)).toEqual([1]);
  });
  it("cukup hasil: tidak ada pelonggaran", () => {
    const r = rankInterpreted(catalog, { ...lipstick, finishes: [], keyword: "" });
    expect(r.loosened).toEqual([]);
    expect(r.items.slice(0, 3).map((i) => i.id)).toEqual([2, 5, 1]); // yang melembapkan dulu, lalu terlaris
  });
  it("kurang dari 3: harga dilonggarkan sebelum kategori, kategori shade diperluas ke kelompok sejenis", () => {
    const cheap = { ...emptyFilters(), category: "lip-tint", priceMax: 50000, interpreted: true };
    const r = rankInterpreted(catalog, cheap);
    expect(r.loosened[0]).toEqual({ kind: "price", max: 50000 });
    expect(r.loosened[1]).toMatchObject({ kind: "category", from: "lip-tint", to: "bibir", group: true });
    expect(r.items.slice(0, 2).map((i) => i.id).sort()).toEqual([6, 7]); // kategori asli tetap di atas
    expect(r.items.some((i) => i.id === 8)).toBe(false); // cushion bukan produk bibir
    expect(loosenedText(r.loosened, { categories: { "lip-tint": "Lip Tint" } })).toBe(`Kami longgarkan: tanpa batas harga ${formatRupiah(50000)}, Lip Tint diperluas ke produk bibir.`);
  });
  it("tanpa filter wajib: produk minimal cocok satu kriteria lunak, bukan seluruh katalog", () => {
    const r = rankInterpreted(catalog, { ...emptyFilters(), q: "yang satin", finishes: ["satin"], interpreted: true });
    expect(r.items.map((i) => i.id).sort()).toEqual([1, 4, 7, 8]);
  });
  it("kriteria yang tidak menyaring tidak pernah disebut dilonggarkan", () => {
    const r = rankInterpreted(catalog, { ...lipstick, finishes: [], keyword: "", skinTypes: ["berminyak"] });
    expect(r.loosened).toEqual([]);
  });
});
