// Logika kulit berbasis aturan: padanan shade (deltaE, bobot, urutan), kuis ke profil, rutinitas, bentrok bahan,
// dan "Cocok untuk kulitmu?".
import { describe, expect, it } from "vitest";
import type { SkinProfile } from "@/db/schema/customers";
import { decodeProfileCookie, encodeProfileCookie, quizToProfile, shouldAdoptGuestProfile, withShade } from "./profile";
import { buildRoutine, productScore, routineSteps, type RoutineProduct } from "./routine";
import { checkConflicts, fitForProfile, ingredientClasses } from "./rules";
import { deltaE, hexToLab, rankShades, SHADE_WEIGHTS, shadeDistance } from "./shade";

const NOW = new Date("2026-10-14T03:00:00.000Z");

describe("padanan shade", () => {
  it("konversi hex ke Lab dan deltaE CIE76", () => {
    const red = hexToLab("#FF0000");
    expect(red.L).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);
    expect(deltaE(hexToLab("#FFFFFF"), hexToLab("#000000"))).toBeCloseTo(100, 3);
    expect(deltaE(hexToLab("#DAB085"), hexToLab("#DAB085"))).toBe(0);
    expect(() => hexToLab("merah")).toThrow();
  });
  it("bobot: warna 0,6, kedalaman 0,25, undertone 0,15 dan totalnya 1", () => {
    expect(SHADE_WEIGHTS.color + SHADE_WEIGHTS.depth + SHADE_WEIGHTS.undertone).toBeCloseTo(1);
    const a = { id: 1, hex: "#DAB085", depth: 3, undertone: "warm" };
    expect(shadeDistance(a, { ...a, id: 2 }).score).toBe(0);
    // Hanya undertone beda (warm vs cool): skor = 0,15.
    expect(shadeDistance(a, { ...a, id: 2, undertone: "cool" }).score).toBe(0.15);
    // Neutral setengah cocok.
    expect(shadeDistance(a, { ...a, id: 2, undertone: "neutral" }).score).toBe(0.075);
    // Hanya kedalaman beda 5 tingkat: skor = 0,25.
    expect(shadeDistance({ ...a, depth: 1 }, { ...a, id: 2, depth: 6 }).score).toBe(0.25);
    // Warna sangat jauh dipotong di 1 x 0,6.
    expect(shadeDistance({ ...a, hex: "#FFFFFF" }, { ...a, id: 2, hex: "#000000" }).score).toBe(0.6);
  });
  it("3 teratas urut skor, tanpa shade sumber, dengan alasan singkat", () => {
    const from = { id: 1, hex: "#D9A98B", depth: 3, undertone: "warm" };
    const cands = [
      { id: 1, hex: "#D9A98B", depth: 3, undertone: "warm" },
      { id: 2, hex: "#E6BFA2", depth: 2, undertone: "warm" }, // lebih terang, undertone sama
      { id: 3, hex: "#D8A88A", depth: 3, undertone: "cool" }, // warna hampir sama, undertone beda
      { id: 4, hex: "#8A5B3A", depth: 6, undertone: "warm" }, // jauh lebih gelap
      { id: 5, hex: "#DAAA8C", depth: 3, undertone: "warm" }, // hampir identik
    ];
    const r = rankShades(from, cands);
    expect(r.map((x) => x.id)).toEqual([5, 3, 2]);
    expect(r[0].reason).toBe("warnanya hampir sama, undertone sama");
    expect(r[1].reason).toContain("undertone cool, bukan warm");
    expect(r[2].reason).toMatch(/lebih terang, undertone sama/);
  });
});

describe("kuis dan profil", () => {
  it("jawaban kuis menjadi profil; nilai tidak dikenal dibuang; masalah maksimal 3", () => {
    const p = quizToProfile({ skinType: "berminyak", concerns: ["jerawat", "pori", "kusam", "penuaan"], sensitivity: "sedang", budget: 150_000, undertone: "warm", depth: 4, routine: "dasar" }, NOW);
    expect(p).toMatchObject({ skinType: "berminyak", concerns: ["jerawat", "pori", "kusam"], sensitivity: "sedang", budget: 150_000, undertone: "warm", depth: 4, source: "kuis" });
    expect(quizToProfile({ skinType: "plastik", depth: 9 }, NOW)).not.toHaveProperty("skinType");
  });
  it("cookie tamu bolak-balik, cookie rusak diabaikan", () => {
    const p = quizToProfile({ skinType: "kering", depth: 2, undertone: "cool" }, NOW);
    expect(decodeProfileCookie(encodeProfileCookie(p), NOW)).toEqual(p);
    expect(decodeProfileCookie("bukan-base64!!", NOW)).toBeNull();
    expect(decodeProfileCookie(Buffer.from(JSON.stringify({ skinType: "x" })).toString("base64url"), NOW)).toBeNull();
  });
  it("profil tamu dipakai saat masuk bila akun belum punya profil atau profil tamu lebih baru", () => {
    const old = { ...quizToProfile({ skinType: "normal" }, NOW), updatedAt: "2026-01-01T00:00:00.000Z" };
    const fresh = quizToProfile({ skinType: "kering" }, NOW);
    expect(shouldAdoptGuestProfile(null, fresh)).toBe(true);
    expect(shouldAdoptGuestProfile(old, fresh)).toBe(true);
    expect(shouldAdoptGuestProfile(fresh, old)).toBe(false);
    expect(shouldAdoptGuestProfile(old, null)).toBe(false);
  });
  it("Shade Finder menambah kedalaman dan undertone tanpa menghapus jawaban lain", () => {
    const p = withShade(quizToProfile({ skinType: "berminyak", concerns: ["jerawat"] }, NOW), { depth: 5, undertone: "neutral" }, NOW);
    expect(p).toMatchObject({ skinType: "berminyak", concerns: ["jerawat"], depth: 5, undertone: "neutral" });
  });
});

const prod = (id: number, categorySlug: string, over: Partial<RoutineProduct> = {}): RoutineProduct => ({
  productId: id,
  variantId: id * 10,
  slug: `p-${id}`,
  name: `Produk ${id}`,
  brandName: "Merek",
  brandColor: "#000000",
  packaging: "cream_jar",
  hex: "#FFFFFF",
  shadeName: "Standar",
  categorySlug,
  price: 80_000,
  normalPrice: 80_000,
  priceSource: "normal",
  rating: 4.5,
  onlineStock: 10,
  skinTypes: ["normal", "berminyak", "kering", "kombinasi", "sensitif"],
  concerns: [],
  activeIngredients: [],
  ingredients: "Aqua, Glycerin.",
  ...over,
});

const catalog: RoutineProduct[] = [
  prod(1, "pembersih", { name: "Gel Wash" }),
  prod(2, "pembersih", { name: "Milk Cleanser", skinTypes: ["kering", "sensitif"] }),
  prod(3, "pembersih", { name: "Cleanser Mahal", price: 300_000 }),
  prod(4, "toner", { name: "Toner Lembut" }),
  prod(5, "serum-dan-essence", { name: "Vitamin C", activeIngredients: ["Ethyl Ascorbic Acid 5%"], concerns: ["kusam"] }),
  prod(6, "serum-dan-essence", { name: "Retinal Serum", activeIngredients: ["Retinal 0.05%"], concerns: ["penuaan", "pori"] }),
  prod(7, "serum-dan-essence", { name: "Hyaluron", activeIngredients: ["Hyaluronic Acid"], concerns: ["dehidrasi"] }),
  prod(8, "perawatan-jerawat", { name: "BHA 2%", activeIngredients: ["Salicylic Acid 2%"], concerns: ["jerawat", "pori"], skinTypes: ["berminyak", "kombinasi"] }),
  prod(9, "pelembap", { name: "Gel Moisturizer", skinTypes: ["normal", "berminyak", "kombinasi"] }),
  prod(10, "pelembap", { name: "Barrier Cream", skinTypes: ["sensitif", "kering"] }),
  prod(11, "sunscreen-wajah", { name: "Gel Sunscreen" }),
  prod(12, "sunscreen-wajah", { name: "Sunscreen Habis", onlineStock: 0 }),
];

describe("rutinitas", () => {
  it("jumlah langkah selalu 4 sampai 6", () => {
    for (const p of [{ skinType: "normal" }, { skinType: "berminyak", concerns: ["jerawat"] }, { skinType: "sensitif", concerns: ["jerawat"] }, { skinType: "kering", routine: "belum" }] as SkinProfile[]) {
      const s = routineSteps(p);
      for (const list of [s.pagi, s.malam]) {
        expect(list.length).toBeGreaterThanOrEqual(4);
        expect(list.length).toBeLessThanOrEqual(6);
      }
    }
    expect(routineSteps({ skinType: "berminyak", concerns: ["jerawat"] }).malam).toContain("eksfoliasi");
    expect(routineSteps({ skinType: "sensitif", concerns: ["jerawat"] }).malam).not.toContain("eksfoliasi");
  });
  it("tiap langkah 1 utama dan 2 alternatif bila ada, sesuai budget per produk", () => {
    const r = buildRoutine({ skinType: "berminyak", concerns: ["kusam"] }, catalog, 150_000);
    const pembersih = r.pagi.find((s) => s.key === "pembersih")!;
    expect(pembersih.main.name).toBe("Gel Wash");
    expect(pembersih.alternatives.map((a) => a.name)).toEqual(["Milk Cleanser"]); // yang Rp 300.000 di luar budget
    expect(r.pagi.find((s) => s.key === "serum")!.main.name).toBe("Vitamin C"); // vitamin C diunggulkan pagi
    expect(r.pagi.find((s) => s.key === "sunscreen")!.main.name).toBe("Gel Sunscreen"); // stok online habis diturunkan
    // Total menghitung produk yang dipakai pagi dan malam sekali saja.
    const unique = new Set([...r.pagi, ...r.malam].map((s) => s.main.variantId));
    expect(r.total).toBe(catalog.filter((p) => unique.has(p.variantId)).reduce((s, p) => s + p.price, 0));
  });
  it("retinoid hanya malam; serum pagi dan malam berbeda bila bisa", () => {
    const p: SkinProfile = { skinType: "kombinasi", concerns: ["penuaan"] };
    expect(productScore(catalog[5], p, "pagi")).toBeLessThan(0);
    const r = buildRoutine(p, catalog, 250_000);
    expect(r.pagi.find((s) => s.key === "serum")!.main.name).not.toBe("Retinal Serum");
    expect(r.malam.find((s) => s.key === "perawatan")!.main.name).toBe("Retinal Serum");
  });
  it("profil sensitif menghindari BHA dan retinoid", () => {
    const r = buildRoutine({ skinType: "sensitif", sensitivity: "tinggi" }, catalog, 250_000);
    const names = [...r.pagi, ...r.malam].map((s) => s.main.name);
    expect(names).not.toContain("BHA 2%");
    expect(names).not.toContain("Retinal Serum");
    expect(r.pagi.find((s) => s.key === "pelembap")!.main.name).toBe("Barrier Cream");
  });
});

describe("cek bentrok bahan", () => {
  const item = (name: string, actives: string[], ingredients = "") => ({ name, classes: ingredientClasses({ activeIngredients: actives, ingredients }) });
  it("retinoid dan BHA di malam yang sama, plus pengingat sunscreen", () => {
    const w = checkConflicts({ pagi: [item("Sunscreen", [])], malam: [item("Retinal Serum", ["Retinal 0.05%"]), item("BHA 2%", ["Salicylic Acid 2%"])], hasSunscreen: true });
    expect(w.map((x) => x.id)).toEqual(["retinoid-eksfoliasi", "pengingat-sunscreen"]);
    expect(w[0].text).toMatch(/malam yang berbeda/);
  });
  it("vitamin C dan AHA atau BHA di waktu yang sama, dan eksfoliasi ganda", () => {
    const w = checkConflicts({ pagi: [item("Vit C", ["Ethyl Ascorbic Acid"]), item("BHA Toner", ["Salicylic Acid 1%"]), item("AHA Serum", ["Glycolic Acid 5%"])], malam: [], hasSunscreen: false });
    expect(w.map((x) => x.id)).toEqual(["vitc-eksfoliasi", "eksfoliasi-ganda", "pengingat-sunscreen"]);
    expect(w.at(-1)!.text).toMatch(/Tambahkan sunscreen/);
  });
  it("kulit sensitif dan parfum; kata 'tanpa alkohol denat' tidak salah terdeteksi", () => {
    const w = checkConflicts({ pagi: [item("Body Lotion", [], "Aqua, Glycerin, Parfum. Bahan aktif utama: Shea Butter.")], malam: [], hasSunscreen: true, profile: { skinType: "sensitif" } });
    expect(w.map((x) => x.id)).toEqual(["sensitif-parfum"]);
    expect(ingredientClasses({ ingredients: "Aqua, Glycerin. Bahan aktif utama: Niacinamide. Tanpa parfum, tanpa alkohol denat." }).has("parfum")).toBe(false);
    expect(checkConflicts({ pagi: [item("Toner", ["Centella"])], malam: [], hasSunscreen: true })).toEqual([]);
  });
});

describe("Cocok untuk kulitmu?", () => {
  const base = { categorySlug: "cushion", parentSlug: "makeup-wajah", skinTypes: ["berminyak", "kombinasi"], concerns: [], finish: "matte", activeIngredients: [], ingredients: "Aqua.", variants: [{ shadeName: "03 Langsat", undertone: "warm", depth: 3 }] };
  it("cocok: kulit berminyak dan matte, ada shade untuk kedalaman dan undertone", () => {
    const r = fitForProfile({ skinType: "berminyak", undertone: "warm", depth: 3 }, base);
    expect(r.verdict).toBe("cocok");
    expect(r.reasons.map((x) => x.text)).toEqual(["ditujukan untuk kulit berminyak seperti kulitmu", "kulitmu berminyak dan ini matte", "ada shade untuk kedalaman dan undertone-mu: 03 Langsat"]);
  });
  it("perhatikan: kulit kering dan matte; sensitif dan parfum", () => {
    expect(fitForProfile({ skinType: "kering" }, base).verdict).toBe("perhatikan");
    const r = fitForProfile({ skinType: "sensitif" }, { ...base, categorySlug: "body-lotion", parentSlug: "body-dan-hair", skinTypes: ["sensitif"], finish: null, ingredients: "Aqua, Parfum. Bahan aktif utama: Shea." });
    expect(r.verdict).toBe("perhatikan");
    expect(r.reasons.map((x) => x.text)).toContain("mengandung parfum, kulitmu sensitif");
  });
  it("kurang cocok: skincare tidak ditujukan untuk jenis kulitmu", () => {
    const r = fitForProfile({ skinType: "kering" }, { ...base, categorySlug: "toner", parentSlug: "skincare", finish: null, skinTypes: ["berminyak"] });
    expect(r.verdict).toBe("kurang_cocok");
  });
  it("masalah kulit yang sama dan bahan aktif kuat", () => {
    const r = fitForProfile({ skinType: "berminyak", concerns: ["jerawat"] }, { ...base, categorySlug: "perawatan-jerawat", parentSlug: "skincare", finish: null, concerns: ["jerawat"], activeIngredients: ["Salicylic Acid 2%"] });
    expect(r.reasons.map((x) => x.text)).toEqual(expect.arrayContaining(["membantu jerawat", "pakai sunscreen di pagi hari selama memakai produk ini"]));
    expect(r.verdict).toBe("perhatikan");
  });
});
