// Aturan katalog admin (murni): validasi produk dan varian, nama mirip, dan pohon kategori.
import { describe, expect, it } from "vitest";
import { suggestSku, validateProduct, type ProductInput } from "./products";
import { levenshtein, similarNames, trigramSimilarity } from "./similar";
import { MAX_CHILDREN, validateTree } from "./tree";

const variant = (over: Partial<ProductInput["variants"][number]> = {}): ProductInput["variants"][number] => ({ shadeName: "01 Ivory", hex: "#F1D9C0", undertone: "neutral", depth: 1, sku: "LUMI-0101", weightGram: 40, normalPrice: 129_000, salePrice: 109_000, isActive: true, ...over });
const product = (over: Partial<ProductInput> = {}): ProductInput => ({ name: "Lumi Skin Tint", brandId: 1, categoryId: 2, packaging: "lipstick", status: "aktif", variants: [variant(), variant({ shadeName: "02 Sand", hex: "#E3BF9A", sku: "LUMI-0102" })], ...over });
const fields = (p: ProductInput) => validateProduct(p).map((i) => i.field);

describe("validateProduct", () => {
  it("produk lengkap dengan 2 shade lolos", () => {
    expect(validateProduct(product())).toEqual([]);
  });
  it("harga jual tidak boleh di atas harga normal", () => {
    expect(fields(product({ variants: [variant({ salePrice: 139_000 })] }))).toEqual(["variants.0.salePrice"]);
  });
  it("SKU kembar dalam satu produk ditolak, SKU tidak boleh berspasi atau terlalu pendek", () => {
    expect(fields(product({ variants: [variant(), variant({ shadeName: "02", sku: "lumi-0101" })] }))).toContain("variants.1.sku");
    expect(fields(product({ variants: [variant({ sku: "AB" })] }))).toContain("variants.0.sku");
    expect(fields(product({ variants: [variant({ sku: "LUMI 01" })] }))).toContain("variants.0.sku");
  });
  it("shade kembar, hex salah, dan kedalaman di luar 1 sampai 6 ditolak", () => {
    expect(fields(product({ variants: [variant(), variant({ shadeName: "01 ivory", sku: "LUMI-0199" })] }))).toContain("variants.1.shadeName");
    expect(fields(product({ variants: [variant({ hex: "F1D9C0" })] }))).toContain("variants.0.hex");
    expect(fields(product({ variants: [variant({ depth: 7 })] }))).toContain("variants.0.depth");
  });
  it("minimal satu varian, slug valid, SEO dalam batas", () => {
    expect(fields(product({ variants: [] }))).toContain("variants");
    expect(fields(product({ slug: "Lumi Tint!" }))).toContain("slug");
    expect(fields(product({ seoTitle: "x".repeat(61) }))).toContain("seoTitle");
    expect(fields(product({ seoDescription: "x".repeat(161) }))).toContain("seoDescription");
  });
  it("SKU otomatis memakai kode merek dan nomor urut", () => {
    expect(suggestSku("Lumi Beauty", 7, 1)).toBe("LUMI-007-02");
    expect(suggestSku("", null, 0)).toBe("RONA-000-01");
  });
});

describe("nama mirip (trigram dan Levenshtein)", () => {
  it("salah ketik terdeteksi: Lip Blam mirip Lip Balm", () => {
    const hits = similarNames("Lip Blam", ["Lip Balm", "Lip Tint", "Serum"]);
    expect(hits.map((h) => h.name)).toEqual(["Lip Balm"]);
    expect(hits[0].distance).toBeLessThanOrEqual(2);
  });
  it("nama yang persis sama bukan peringatan mirip (itu duplikat), nama berbeda jauh tidak muncul", () => {
    expect(similarNames("Serum", ["serum"])).toEqual([]);
    expect(similarNames("Cushion", ["Toner", "Eyeliner"])).toEqual([]);
  });
  it("Kirana Lab dan Kirana Labs mirip, ukuran kemiripan masuk akal", () => {
    expect(similarNames("Kirana Labs", ["Kirana Lab", "Pualam"]).map((h) => h.name)).toEqual(["Kirana Lab"]);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(trigramSimilarity("abc", "abc")).toBe(1);
  });
});

describe("validateTree", () => {
  it("2 tingkat dengan 8 anak lolos", () => {
    const nodes = [{ id: 1, parentId: null }, ...Array.from({ length: MAX_CHILDREN }, (_, i) => ({ id: 10 + i, parentId: 1 }))];
    expect(validateTree(nodes)).toBeNull();
  });
  it("anak ke-9 ditolak", () => {
    const nodes = [{ id: 1, parentId: null }, ...Array.from({ length: MAX_CHILDREN + 1 }, (_, i) => ({ id: 10 + i, parentId: 1 }))];
    expect(validateTree(nodes)).toMatch(/Maksimal 8/);
  });
  it("tingkat ketiga, induk diri sendiri, dan induk hilang ditolak", () => {
    expect(validateTree([{ id: 1, parentId: null }, { id: 2, parentId: 1 }, { id: 3, parentId: 2 }])).toMatch(/2 tingkat/);
    expect(validateTree([{ id: 1, parentId: 1 }])).toMatch(/dirinya sendiri/);
    expect(validateTree([{ id: 2, parentId: 99 }])).toMatch(/tidak ditemukan/);
  });
});
