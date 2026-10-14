// Data tampilan rutinitas (satu sumber untuk halaman /rutinitas dan kartu rutinitas chat asisten, Fase 8C).
import type { Packaging } from "@/db/schema/enums";
import type { Routine, RoutineStep } from "./routine";

export type RoutineItemData = { productId: number; variantId: number; slug: string; name: string; brandName: string; brandColor: string; packaging: Packaging; hex: string; price: number; normalPrice: number; onlineStock: number };
export type RoutineStepData = { key: string; label: string; options: RoutineItemData[] };

export const routineStepsView = (steps: RoutineStep[]): RoutineStepData[] =>
  steps.map((s) => ({ key: s.key, label: s.label, options: [s.main, ...s.alternatives].map((p) => ({ productId: p.productId, variantId: p.variantId, slug: p.slug, name: p.name, brandName: p.brandName, brandColor: p.brandColor, packaging: p.packaging as Packaging, hex: p.hex, price: p.price, normalPrice: p.normalPrice, onlineStock: p.onlineStock })) }));

export function routineView(routine: Routine, profileRoutine?: string | null) {
  return {
    pagi: routineStepsView(routine.pagi),
    malam: routineStepsView(routine.malam),
    inti: routineStepsView(routine.essentials.steps),
    warnings: routine.warnings.map((w) => ({ id: w.id, text: w.text })),
    intiWarnings: routine.essentials.warnings.map((w) => ({ id: w.id, text: w.text })),
    // Yang baru mulai merawat kulit langsung melihat 3 langkah inti; rutinitas lengkap tetap satu klik.
    defaultMode: (profileRoutine === "belum" ? "inti" : "lengkap") as "inti" | "lengkap",
  };
}
