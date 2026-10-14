"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImageUp, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuizSuggestion } from "@/lib/ai/skin-photo";
import { shrinkImage } from "@/lib/image/shrink";
import { cn } from "@/lib/utils";

type Phase = { kind: "setuju" } | { kind: "unggah" } | { kind: "proses" } | { kind: "ulang"; tip: string } | { kind: "galat"; message: string };

// Bantu isi kuis dari foto (opsional): persetujuan dulu, lalu unggah satu foto wajah. Foto diperkecil dan metadata
// dibuang di browser, diproses di memori server, lalu langsung dibuang.
export function PhotoAssist({ onApply, onManual }: { onApply: (s: QuizSuggestion) => void; onManual: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "setuju" });
  const [agreed, setAgreed] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const send = async (file: File | undefined) => {
    if (!file) return;
    setPhase({ kind: "proses" });
    try {
      const blob = await shrinkImage(file);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      const form = new FormData();
      form.append("foto", blob, "foto.jpg");
      const res = await fetch("/api/ai/foto-kulit", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; quality?: string; tip?: string; suggestion?: QuizSuggestion; message?: string };
      if (!d.ok) return setPhase({ kind: "galat", message: d.message ?? "Foto belum bisa diproses. Coba lagi, atau isi kuisnya sendiri." });
      if (d.quality !== "cukup" || !d.suggestion) return setPhase({ kind: "ulang", tip: d.tip ?? "Coba foto lain dengan cahaya alami, ya." });
      onApply(d.suggestion);
    } catch (e) {
      setPhase({ kind: "galat", message: e instanceof Error ? e.message : "Foto belum bisa diproses." });
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  if (phase.kind === "setuju") {
    return (
      <div className="space-y-4" data-testid="persetujuan-foto">
        <div className="rounded-xl border border-garis bg-putih p-4 text-sm text-kopi">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-rona" aria-hidden /> Sebelum kamu kirim foto
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-kopi/90">
            <li>Foto hanya dipakai untuk memperkirakan kondisi kulit yang terlihat.</li>
            <li>Foto tidak disimpan dan langsung dibuang setelah diproses.</li>
            <li>Hasilnya hanya perkiraan dan bisa kamu ubah di setiap langkah.</li>
            <li>Ini bukan pemeriksaan medis.</li>
          </ul>
          <p className="mt-2 text-xs text-abu-hangat">
            Baca juga{" "}
            <Link href="/kebijakan/privasi#foto" className="font-semibold text-rona hover:underline">
              kebijakan privasi soal foto
            </Link>
            .
          </p>
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-kopi)]" data-testid="setuju-foto" />
          <span>Aku mengerti dan setuju fotoku diproses untuk mengisi kuis ini.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!agreed} onClick={() => setPhase({ kind: "unggah" })} data-aksi-utama>
            Lanjut pilih foto
          </Button>
          <Button variant="ghost" onClick={onManual}>
            Isi sendiri saja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="unggah-foto">
      <div className="rounded-xl border border-dashed border-garis bg-putih p-4 text-sm">
        <p className="font-semibold text-kopi">Satu foto wajah, tanpa filter, di cahaya alami</p>
        <p className="mt-1 text-abu-hangat">Hadap ke jendela, wajah bersih tanpa makeup bila bisa, seluruh wajah masuk bingkai.</p>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (blob), tidak pernah diunggah ulang
          <img src={preview} alt="Pratinjau fotomu" className="mt-3 h-28 w-auto rounded-lg object-cover" />
        ) : null}
        {phase.kind === "ulang" ? (
          <p className="mt-3 rounded-lg bg-[#FBEEDC] px-3 py-2 text-[#8A5512]" role="status" data-testid="foto-ulang">
            {phase.tip}
          </p>
        ) : null}
        {phase.kind === "galat" ? (
          <p className="mt-3 text-bahaya" role="alert">
            {phase.message}
          </p>
        ) : null}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void send(e.target.files?.[0])} data-testid="input-kamera" />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void send(e.target.files?.[0])} data-testid="input-galeri" />
      <div className={cn("flex flex-wrap gap-2", phase.kind === "proses" && "pointer-events-none opacity-60")}>
        <Button onClick={() => cameraRef.current?.click()} disabled={phase.kind === "proses"}>
          <Camera /> Ambil foto
        </Button>
        <Button variant="outline" onClick={() => galleryRef.current?.click()} disabled={phase.kind === "proses"}>
          <ImageUp /> Pilih dari galeri
        </Button>
        <Button variant="ghost" onClick={onManual} disabled={phase.kind === "proses"}>
          Isi sendiri saja
        </Button>
      </div>
      {phase.kind === "proses" ? (
        <p className="flex items-center gap-2 text-sm text-abu-hangat" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Membaca fotomu...
        </p>
      ) : null}
    </div>
  );
}
