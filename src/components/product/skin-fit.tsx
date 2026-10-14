// "Cocok untuk kulitmu?" berbasis aturan (tanpa AI). Dirender di server dari profil kulit pengunjung.
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { FitResult } from "@/lib/skin/rules";
import { cn } from "@/lib/utils";

const VERDICT = { cocok: "Cocok untuk kulitmu", perhatikan: "Bisa cocok, perhatikan ini", kurang_cocok: "Kurang cocok untuk kulitmu" } as const;

export function SkinFit({ fit }: { fit: FitResult | null }) {
  if (!fit) {
    return (
      <div className="rounded-xl border border-dashed border-garis bg-putih p-3 text-sm" data-testid="cocok-kulit">
        <p className="font-semibold text-kopi">Cocok untuk kulitmu?</p>
        <p className="mt-0.5 text-abu-hangat">
          Ikut{" "}
          <Link href="/kuis-kulit" className="font-semibold text-rona hover:underline">
            kuis kulit 1 menit
          </Link>{" "}
          supaya kami bisa menilai kecocokannya.
        </p>
      </div>
    );
  }
  const good = fit.reasons.filter((r) => r.tone === "cocok").map((r) => r.text);
  const watch = fit.reasons.filter((r) => r.tone !== "cocok").map((r) => r.text);
  const Icon = fit.verdict === "cocok" ? CircleCheck : fit.verdict === "perhatikan" ? CircleAlert : CircleX;
  return (
    <div className={cn("rounded-xl border p-3 text-sm", fit.verdict === "cocok" ? "border-sukses/30 bg-[#EEF7F1]" : fit.verdict === "perhatikan" ? "border-peringatan/30 bg-[#FBF3E6]" : "border-bahaya/20 bg-[#FBEDEB]")} data-testid="cocok-kulit">
      <p className="flex items-center gap-1.5 font-semibold text-kopi">
        <Icon className={cn("size-4", fit.verdict === "cocok" ? "text-sukses" : fit.verdict === "perhatikan" ? "text-peringatan" : "text-bahaya")} aria-hidden /> {VERDICT[fit.verdict]}
      </p>
      {good.length ? <p className="mt-1 text-kopi/85">Cocok: {good.join("; ")}.</p> : null}
      {watch.length ? <p className="mt-0.5 text-kopi/85">Perhatikan: {watch.join("; ")}.</p> : null}
      <p className="mt-1 text-[11px] text-abu-hangat">
        Dinilai dari profil kulitmu dan data produk, bukan diagnosis.{" "}
        <Link href="/kuis-kulit" className="underline">
          Ubah profil
        </Link>
      </p>
    </div>
  );
}
