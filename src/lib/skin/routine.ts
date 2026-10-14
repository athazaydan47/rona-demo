// Penyusun rutinitas pagi dan malam berbasis aturan (tanpa AI). Murni: menerima daftar produk katalog yang sudah
// dimuat, memilih 1 produk utama dan 2 alternatif per langkah sesuai profil dan budget per produk.
import type { SkinProfile } from "@/db/schema/customers";
import { checkConflicts, ingredientClasses, isExfoliant, type ConflictWarning } from "./rules";

export type RoutineProduct = {
  productId: number;
  variantId: number;
  slug: string;
  name: string;
  brandName: string;
  brandColor: string;
  packaging: string;
  hex: string;
  shadeName: string;
  categorySlug: string;
  price: number;
  normalPrice: number;
  priceSource: string;
  rating: number;
  onlineStock: number;
  skinTypes: string[];
  concerns: string[];
  activeIngredients: string[];
  ingredients: string | null;
};

export type StepKey = "pembersih" | "toner" | "serum" | "eksfoliasi" | "perawatan" | "pelembap" | "sunscreen";
export type StepDef = { key: StepKey; label: string; categories: string[] };

export const STEP_DEFS: Record<StepKey, StepDef> = {
  pembersih: { key: "pembersih", label: "Pembersih", categories: ["pembersih"] },
  toner: { key: "toner", label: "Toner", categories: ["toner"] },
  serum: { key: "serum", label: "Serum", categories: ["serum-dan-essence"] },
  eksfoliasi: { key: "eksfoliasi", label: "Eksfoliasi atau perawatan jerawat", categories: ["perawatan-jerawat"] },
  perawatan: { key: "perawatan", label: "Serum malam", categories: ["serum-dan-essence"] },
  pelembap: { key: "pelembap", label: "Pelembap", categories: ["pelembap"] },
  sunscreen: { key: "sunscreen", label: "Sunscreen", categories: ["sunscreen-wajah", "tinted-sunscreen"] },
};

// Pagi 5 langkah (4 untuk yang baru mulai merawat kulit, tanpa toner). Malam 4 langkah, ditambah langkah eksfoliasi
// untuk kulit berjerawat atau berpori yang tidak sensitif (5 langkah). Selalu dalam batas 4 sampai 6.
export function routineSteps(profile: SkinProfile): { pagi: StepKey[]; malam: StepKey[] } {
  const beginner = profile.routine === "belum";
  const sensitive = profile.skinType === "sensitif" || profile.sensitivity === "tinggi";
  const exfoliate = !beginner && !sensitive && (profile.concerns ?? []).some((c) => c === "jerawat" || c === "pori");
  return {
    pagi: beginner ? ["pembersih", "serum", "pelembap", "sunscreen"] : ["pembersih", "toner", "serum", "pelembap", "sunscreen"],
    malam: exfoliate ? ["pembersih", "toner", "eksfoliasi", "perawatan", "pelembap"] : ["pembersih", "toner", "perawatan", "pelembap"],
  };
}

// Skor kecocokan produk untuk profil (makin besar makin cocok).
export function productScore(p: RoutineProduct, profile: SkinProfile, time: "pagi" | "malam") {
  let s = 0;
  if (profile.skinType && p.skinTypes.includes(profile.skinType)) s += 3;
  else if (profile.skinType) s -= 2;
  for (const c of profile.concerns ?? []) if (p.concerns.includes(c)) s += 2;
  const cls = ingredientClasses(p);
  const sensitive = profile.skinType === "sensitif" || profile.sensitivity === "tinggi";
  if (sensitive && (cls.has("parfum") || cls.has("retinoid") || isExfoliant(cls))) s -= 3;
  // Retinoid hanya malam (lebih peka cahaya); vitamin C lebih cocok pagi.
  if (cls.has("retinoid")) s += time === "malam" ? (profile.concerns?.includes("penuaan") ? 2 : 0) : -10;
  if (cls.has("vitamin_c") && time === "pagi") s += 1;
  s += p.rating / 5;
  if (p.onlineStock <= 0) s -= 5;
  return Math.round(s * 100) / 100;
}

export type RoutineStep = { key: StepKey; label: string; main: RoutineProduct; alternatives: RoutineProduct[] };
// "Mulai dari yang penting": 3 langkah inti (pembersih, pelembap, sunscreen). Pembersih dan pelembap yang sama dipakai
// pagi dan malam, sunscreen hanya pagi, jadi cukup 3 produk.
export const ESSENTIAL_STEPS: StepKey[] = ["pembersih", "pelembap", "sunscreen"];
export type RoutineEssentials = { steps: RoutineStep[]; total: number; warnings: ConflictWarning[] };
export type Routine = { pagi: RoutineStep[]; malam: RoutineStep[]; total: number; subtotal: { pagi: number; malam: number }; warnings: ConflictWarning[]; budget: number; essentials: RoutineEssentials };

// Jumlah harga produk unik (produk yang muncul di dua langkah dihitung sekali).
export const uniqueTotal = (steps: RoutineStep[]) => [...new Map(steps.map((s) => [s.main.variantId, s.main.price])).values()].reduce((a, b) => a + b, 0);

function pickStep(def: StepDef, products: RoutineProduct[], profile: SkinProfile, time: "pagi" | "malam", budget: number, avoid: Set<number>): RoutineStep | null {
  const pool = products.filter((p) => def.categories.includes(p.categorySlug));
  if (!pool.length) return null;
  const inBudget = pool.filter((p) => p.price <= budget);
  // Bila tidak ada yang masuk budget, pakai yang termurah supaya langkah tetap terisi.
  const usable = inBudget.length ? inBudget : [...pool].sort((a, b) => a.price - b.price).slice(0, 1);
  const ranked = [...usable].sort((a, b) => productScore(b, profile, time) - productScore(a, profile, time) || a.price - b.price || a.productId - b.productId);
  const main = ranked.find((p) => !avoid.has(p.productId)) ?? ranked[0];
  return { key: def.key, label: def.label, main, alternatives: ranked.filter((p) => p.productId !== main.productId).slice(0, 2) };
}

export function buildRoutine(profile: SkinProfile, products: RoutineProduct[], budgetPerProduct?: number): Routine {
  const budget = budgetPerProduct ?? profile.budget ?? 150_000;
  const steps = routineSteps(profile);
  const build = (time: "pagi" | "malam", keys: StepKey[], avoid: Set<number>) =>
    keys
      .map((k) => {
        const step = pickStep(STEP_DEFS[k], products, profile, time, budget, avoid);
        if (step && (k === "serum" || k === "perawatan")) avoid.add(step.main.productId);
        return step;
      })
      .filter((s): s is RoutineStep => s != null);
  const avoid = new Set<number>();
  const pagi = build("pagi", steps.pagi, avoid);
  const malam = build("malam", steps.malam, avoid);
  const total = uniqueTotal([...pagi, ...malam]);
  const toCheck = (steps: RoutineStep[]) => steps.map((s) => ({ name: s.main.name, classes: ingredientClasses(s.main) }));
  const warnings = checkConflicts({ pagi: toCheck(pagi), malam: toCheck(malam), hasSunscreen: pagi.some((s) => s.key === "sunscreen"), profile });
  const core = pagi.filter((s) => ESSENTIAL_STEPS.includes(s.key));
  const essentials: RoutineEssentials = {
    steps: core,
    total: uniqueTotal(core),
    warnings: checkConflicts({ pagi: toCheck(core), malam: toCheck(core.filter((s) => s.key !== "sunscreen")), hasSunscreen: core.some((s) => s.key === "sunscreen"), profile }),
  };
  return { pagi, malam, total, subtotal: { pagi: uniqueTotal(pagi), malam: uniqueTotal(malam) }, warnings, budget, essentials };
}

// Isi rutinitas sebagai kunci cache penjelasan AI.
export const routineKey = (r: Routine) => `${r.pagi.map((s) => s.main.variantId).join(",")}|${r.malam.map((s) => s.main.variantId).join(",")}`;
