// Aturan kulit berbasis data produk (tanpa AI): klasifikasi bahan aktif, cek bentrok bahan dalam rutinitas, dan
// "Cocok untuk kulitmu?". Semua peringatan ditulis sebagai saran pemakaian, bukan klaim medis.
import type { SkinProfile } from "@/db/schema/customers";

export type IngredientClass = "retinoid" | "aha" | "bha" | "vitamin_c" | "parfum" | "niacinamide";

const PATTERNS: Record<IngredientClass, RegExp> = {
  retinoid: /\b(retinol|retinal|retinaldehyde|tretinoin|adapalene|retinyl)\b/i,
  aha: /\b(glycolic|lactic|mandelic|aha)\b/i,
  bha: /\b(salicylic|betaine salicylate|bha)\b/i,
  vitamin_c: /\b(ascorbic|ascorbyl|vitamin c)\b/i,
  parfum: /\b(parfum|fragrance|pewangi)\b/i,
  niacinamide: /\bniacinamide\b/i,
};

// Daftar komposisi di seed diakhiri kalimat seperti "Tanpa paraben, tanpa alkohol denat": hanya bagian sebelum
// "Bahan aktif utama" yang dibaca supaya kata "tanpa ..." tidak salah terdeteksi.
export function ingredientClasses(p: { activeIngredients?: string[]; ingredients?: string | null }): Set<IngredientClass> {
  const list = (p.ingredients ?? "").split(/Bahan aktif utama/i)[0];
  const text = `${(p.activeIngredients ?? []).join(", ")} ${list}`;
  const out = new Set<IngredientClass>();
  for (const [k, re] of Object.entries(PATTERNS) as [IngredientClass, RegExp][]) if (re.test(text)) out.add(k);
  return out;
}

export const isExfoliant = (c: Set<IngredientClass>) => c.has("aha") || c.has("bha");

// ---------- Cek bentrok bahan dalam rutinitas ----------

export type RoutineItemForCheck = { name: string; classes: Set<IngredientClass> };
export type ConflictWarning = { id: string; time: "pagi" | "malam" | "umum"; text: string };

export function checkConflicts(input: { pagi: RoutineItemForCheck[]; malam: RoutineItemForCheck[]; hasSunscreen: boolean; profile?: SkinProfile | null }): ConflictWarning[] {
  const out: ConflictWarning[] = [];
  const names = (items: RoutineItemForCheck[], f: (c: Set<IngredientClass>) => boolean) => items.filter((i) => f(i.classes)).map((i) => i.name);

  for (const time of ["pagi", "malam"] as const) {
    const items = input[time];
    // Aturan 1: retinoid dan AHA atau BHA tidak dipakai di malam yang sama.
    // Sumber: American Academy of Dermatology, "How to safely use retinoids" (2022); retinoid dan eksfoliasi kimia
    // sama-sama bisa membuat kulit kering dan iritasi, jadi dianjurkan dipakai bergantian.
    const retinoid = names(items, (c) => c.has("retinoid"));
    const exfo = names(items, isExfoliant);
    if (retinoid.length && exfo.length) {
      out.push({ id: "retinoid-eksfoliasi", time, text: `${retinoid[0]} (retinoid) dan ${exfo[0]} (AHA atau BHA) sebaiknya dipakai di malam yang berbeda, misalnya selang-seling, supaya kulit tidak terlalu kering atau perih.` });
    }
    // Aturan 2: vitamin C dan AHA atau BHA di waktu yang sama.
    // Sumber: Pinnell SR dkk., "Topical L-ascorbic acid: percutaneous absorption studies", Dermatol Surg 2001;27:137-142
    // (stabilitas vitamin C bergantung pH); keduanya asam sehingga dipakai bersamaan lebih mudah memicu rasa perih.
    const vitC = names(items, (c) => c.has("vitamin_c"));
    if (vitC.length && exfo.length && vitC[0] !== exfo[0]) {
      out.push({ id: "vitc-eksfoliasi", time, text: `${vitC[0]} (vitamin C) dan ${exfo[0]} (AHA atau BHA) lebih nyaman dipakai di waktu berbeda, misalnya vitamin C pagi dan eksfoliasi malam.` });
    }
    // Aturan 3: dua produk eksfoliasi di rutinitas yang sama.
    // Sumber: American Academy of Dermatology, "How to safely exfoliate at home" (2023): eksfoliasi berlebihan dapat
    // merusak lapisan pelindung kulit.
    if (exfo.length >= 2) out.push({ id: "eksfoliasi-ganda", time, text: `${exfo.join(" dan ")} sama-sama mengandung AHA atau BHA. Pakai salah satu saja di ${time} yang sama.` });
  }
  // Aturan 4: bahan eksfoliasi atau retinoid membuat kulit lebih peka matahari; ingatkan sunscreen setiap pagi.
  // Sumber: U.S. FDA, "Alpha Hydroxy Acids in Cosmetics" (Guidance for Industry, 2005) dan AAD tentang retinoid.
  const all = [...input.pagi, ...input.malam];
  const sensitizing = names(all, (c) => isExfoliant(c) || c.has("retinoid"));
  if (sensitizing.length) {
    out.push({ id: "pengingat-sunscreen", time: "umum", text: input.hasSunscreen ? `Karena ada ${sensitizing[0]}, jangan lewatkan sunscreen setiap pagi dan ulangi saat beraktivitas di luar.` : `Rutinitas ini memakai ${sensitizing[0]}. Tambahkan sunscreen setiap pagi, ya.` });
  }
  // Aturan 5: kulit sensitif dan produk berparfum.
  // Sumber: AAD, "Sensitive skin: tips" (2023): pilih produk tanpa pewangi untuk kulit sensitif.
  if (input.profile && (input.profile.skinType === "sensitif" || input.profile.sensitivity === "tinggi")) {
    const fragrant = names(all, (c) => c.has("parfum"));
    if (fragrant.length) out.push({ id: "sensitif-parfum", time: "umum", text: `${fragrant[0]} mengandung parfum. Untuk kulit sensitif, coba dulu di area kecil.` });
  }
  return out;
}

// ---------- "Cocok untuk kulitmu?" ----------

export type FitProduct = {
  categorySlug: string;
  parentSlug: string;
  skinTypes: string[];
  concerns: string[];
  finish: string | null;
  activeIngredients: string[];
  ingredients: string | null;
  variants: { shadeName: string; undertone: string | null; depth: number | null }[];
};
export type FitReason = { tone: "cocok" | "perhatikan" | "kurang"; text: string };
export type FitResult = { verdict: "cocok" | "perhatikan" | "kurang_cocok"; reasons: FitReason[] };

const SKIN_LABEL: Record<string, string> = { normal: "normal", kering: "kering", berminyak: "berminyak", kombinasi: "kombinasi", sensitif: "sensitif" };
const CONCERN_LABEL: Record<string, string> = { jerawat: "jerawat", kusam: "kulit kusam", pori: "pori-pori", penuaan: "tanda penuaan", dehidrasi: "kulit dehidrasi" };
const SKINCARE_PARENTS = new Set(["skincare", "sun-care", "pria"]);

export function fitForProfile(profile: SkinProfile, p: FitProduct): FitResult {
  const reasons: FitReason[] = [];
  const skin = profile.skinType;
  const isSkincare = SKINCARE_PARENTS.has(p.parentSlug) || p.categorySlug.startsWith("sunscreen");
  if (skin && p.skinTypes.length) {
    if (p.skinTypes.includes(skin)) reasons.push({ tone: "cocok", text: `ditujukan untuk kulit ${SKIN_LABEL[skin]} seperti kulitmu` });
    else if (isSkincare) reasons.push({ tone: "kurang", text: `tidak ditujukan untuk kulit ${SKIN_LABEL[skin]}` });
  }
  const shared = (profile.concerns ?? []).filter((c) => p.concerns.includes(c));
  if (shared.length) reasons.push({ tone: "cocok", text: `membantu ${shared.map((c) => CONCERN_LABEL[c] ?? c).join(" dan ")}` });
  if (skin && p.finish) {
    if (skin === "berminyak" && p.finish === "matte") reasons.push({ tone: "cocok", text: "kulitmu berminyak dan ini matte" });
    else if (skin === "berminyak" && p.finish === "glowy") reasons.push({ tone: "perhatikan", text: "hasil glowy bisa terlihat lebih berminyak di kulitmu" });
    else if (skin === "kering" && p.finish === "glowy") reasons.push({ tone: "cocok", text: "kulitmu kering dan hasilnya glowy" });
    else if (skin === "kering" && p.finish === "matte") reasons.push({ tone: "perhatikan", text: "hasil matte bisa terasa kering, pakai pelembap dulu" });
  }
  const classes = ingredientClasses(p);
  const sensitive = skin === "sensitif" || profile.sensitivity === "tinggi";
  if (sensitive && classes.has("parfum")) reasons.push({ tone: "perhatikan", text: "mengandung parfum, kulitmu sensitif" });
  if (sensitive && (classes.has("retinoid") || isExfoliant(classes))) reasons.push({ tone: "perhatikan", text: "bahan aktifnya cukup kuat, coba dulu di area kecil" });
  if (classes.has("retinoid") || isExfoliant(classes)) reasons.push({ tone: "perhatikan", text: "pakai sunscreen di pagi hari selama memakai produk ini" });
  if (profile.undertone || profile.depth) {
    const match = p.variants.find((v) => (profile.undertone ? v.undertone === profile.undertone : true) && (profile.depth ? v.depth != null && Math.abs(v.depth - profile.depth) <= 0 : true) && (v.undertone || v.depth));
    const near = match ?? p.variants.find((v) => profile.depth && v.depth != null && Math.abs(v.depth - profile.depth) <= 1 && (!profile.undertone || v.undertone === profile.undertone || v.undertone === "neutral"));
    if (match) reasons.push({ tone: "cocok", text: `ada shade untuk kedalaman dan undertone-mu: ${match.shadeName}` });
    else if (near) reasons.push({ tone: "cocok", text: `shade terdekat untukmu: ${near.shadeName}` });
  }
  const bad = reasons.filter((r) => r.tone === "kurang").length;
  const good = reasons.filter((r) => r.tone === "cocok").length;
  const warn = reasons.filter((r) => r.tone === "perhatikan").length;
  const verdict = bad && !good ? "kurang_cocok" : bad || warn ? "perhatikan" : "cocok";
  return { verdict, reasons };
}
