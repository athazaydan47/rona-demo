import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { RoutineView, type RoutineStepView } from "@/components/routine/routine-view";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import type { SkinProfile } from "@/db/schema/customers";
import { aiConfig, aiModel } from "@/lib/ai";
import { explainRoutine } from "@/lib/ai/explain";
import { globalCapReached } from "@/lib/ai/usage";
import { currentVisitorHash } from "@/lib/ai/visitor";
import { susunRutinitas } from "@/lib/catalog/tools";
import { skinTypeLabels, concernLabels } from "@/lib/catalog/filters";
import { now } from "@/lib/clock";
import { formatRupiah } from "@/lib/format";
import { currentSkinProfile } from "@/lib/skin/current";
import { isProfileUsable } from "@/lib/skin/profile";
import type { Routine, RoutineStep } from "@/lib/skin/routine";

export const metadata: Metadata = { title: "Rutinitas", description: "Rutinitas pagi dan malam dari katalog Rona sesuai profil kulit dan budgetmu." };

const toView = (steps: RoutineStep[]): RoutineStepView[] => steps.map((s) => ({ key: s.key, label: s.label, options: [s.main, ...s.alternatives].map((p) => ({ productId: p.productId, variantId: p.variantId, slug: p.slug, name: p.name, brandName: p.brandName, brandColor: p.brandColor, packaging: p.packaging as RoutineStepView["options"][number]["packaging"], hex: p.hex, price: p.price, normalPrice: p.normalPrice, onlineStock: p.onlineStock })) }));

// Penjelasan AI dimuat terpisah supaya rutinitas berbasis aturan tampil tanpa menunggu AI.
async function Explanation({ profile, routine }: { profile: SkinProfile; routine: Routine }) {
  const cfg = aiConfig();
  const model = aiModel(cfg);
  if (!model) return null;
  const at = now();
  if (await globalCapReached(db, cfg, at).catch(() => true)) return null;
  const text = await explainRoutine(db, model, profile, routine, at, { visitorHash: await currentVisitorHash(), timeoutMs: 5000 });
  if (!text) return null;
  return (
    <div className="rounded-xl border border-garis bg-putih p-4 text-sm" data-testid="penjelasan-ai">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-rona">
        <Sparkles className="size-3.5" aria-hidden /> Penjelasan AI (bisa keliru)
      </p>
      <p className="mt-1 text-kopi">{text}</p>
    </div>
  );
}

async function Content() {
  const profile = await currentSkinProfile();
  if (!isProfileUsable(profile)) {
    return (
      <div className="rounded-card border border-garis bg-porselen p-6 text-center">
        <p className="font-serif text-2xl text-kopi">Kenali kulitmu dulu, yuk</p>
        <p className="mt-1 text-sm text-abu-hangat">Rutinitas disusun dari jenis kulit, masalah, dan budgetmu. Cuma 6 pertanyaan.</p>
        <Button asChild className="mt-4">
          <Link href="/kuis-kulit">Mulai kuis kulit</Link>
        </Button>
      </div>
    );
  }
  const routine = await susunRutinitas(db, profile, profile.budget, now());
  return (
    <div className="space-y-5">
      <p className="text-sm text-abu-hangat">
        Untuk kulit {skinTypeLabels[profile.skinType!]?.toLowerCase()}
        {profile.concerns?.length ? `, fokus ${profile.concerns.map((c) => concernLabels[c]?.toLowerCase() ?? c).join(" dan ")}` : ""}, budget sampai {formatRupiah(routine.budget)} per produk.{" "}
        <Link href="/kuis-kulit" className="font-semibold text-rona hover:underline">
          Ubah jawaban kuis
        </Link>
      </p>
      <Suspense fallback={null}>
        <Explanation profile={profile} routine={routine} />
      </Suspense>
      <RoutineView pagi={toView(routine.pagi)} malam={toView(routine.malam)} warnings={routine.warnings.map((w) => ({ id: w.id, text: w.text }))} />
      <p className="text-[11px] text-abu-hangat">Disusun berbasis aturan dari katalog Rona, bukan diagnosis. Untuk keluhan kulit serius, periksa ke dokter kulit.</p>
    </div>
  );
}

export default function RoutinePage() {
  return (
    <section className="container-rona py-8 md:py-12">
      <p className="text-xs font-semibold tracking-wide text-rona uppercase">Rutinitas</p>
      <h1 className="mt-1 mb-4 font-serif text-3xl font-medium text-kopi md:text-4xl">Rutinitas pagi dan malammu</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-garis/40" />}>
        <Content />
      </Suspense>
    </section>
  );
}
