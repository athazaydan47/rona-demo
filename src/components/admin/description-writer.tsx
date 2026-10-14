"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bulkDescriptionAction, draftDescriptionAction } from "@/lib/admin/ai-actions";
import { DESCRIPTION_FIELDS, FIELD_LABELS, type ClaimIssue, type DescriptionDraft, type DescriptionField } from "@/lib/ai/penulis";
import { cn } from "@/lib/utils";

export type WriterSource = {
  name: string;
  brand: string;
  category: string;
  activeIngredients: string[];
  skinTypes: string[];
  finish: string | null;
  spf: number | null;
  netto: string;
  bpom: string;
  current: Record<DescriptionField, string>;
};
type Draft = { draft: DescriptionDraft; issues: Record<DescriptionField, ClaimIssue[]> };

// Penulis deskripsi dan SEO: usulan per kolom berdampingan dengan isi lama. Kalimat yang klaimnya tidak ada di acuan
// ditandai beserta alasannya. Admin menerima per kolom; produk baru tersimpan saat admin menekan Simpan produk.
export function DescriptionWriter({ source, onAccept, initial = null, initialBy = null }: { source: WriterSource; onAccept: (field: DescriptionField, text: string) => void; initial?: Draft | null; initialBy?: string | null }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [points, setPoints] = useState("");
  const [supplier, setSupplier] = useState("");
  const [result, setResult] = useState<Draft | null>(initial);
  const [accepted, setAccepted] = useState<Set<DescriptionField>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const generate = (variation: "lebih_singkat" | "lebih_santai" | null = null) =>
    run(async () => {
      setError(null);
      const r = await draftDescriptionAction({ ...source, points, supplierText: supplier, variation });
      if (!r.ok) return setError(r.message);
      setResult({ draft: r.draft, issues: r.issues });
      setAccepted(new Set());
    });

  return (
    <div className="rounded-xl border border-aksen/25 bg-blush/20 p-4" data-testid="penulis-ai">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold text-kopi">
          <Sparkles className="size-4 text-aksen" aria-hidden /> Bantu tulis dengan AI
        </span>
        <span className="text-xs text-abu-hangat">{open ? "Tutup" : "Buka"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          {initialBy && initial && !accepted.size ? <p className="text-xs text-abu-hangat">Usulan massal dibuat oleh {initialBy}. Tinjau per kolom sebelum menyimpan.</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Poin-poin (opsional)</span>
              <textarea rows={4} value={points} onChange={(e) => setPoints(e.target.value.slice(0, 2000))} placeholder={"- ringan, cepat meresap\n- cocok di bawah makeup"} className="w-full rounded-lg border border-garis bg-putih px-3 py-2 text-sm outline-none focus-visible:border-aksen" aria-label="Poin acuan" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Teks dari pemasok atau kemasan (opsional)</span>
              <textarea rows={4} value={supplier} onChange={(e) => setSupplier(e.target.value.slice(0, 4000))} placeholder="Tempel teks dari pemasok atau kemasan" className="w-full rounded-lg border border-garis bg-putih px-3 py-2 text-sm outline-none focus-visible:border-aksen" aria-label="Teks pemasok" />
            </label>
          </div>
          <p className="text-xs text-abu-hangat">Data produk (bahan aktif, jenis kulit, finish, SPF, netto, BPOM) ikut dipakai. Usulan mengikuti panduan gaya bahasa di Pengaturan.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => generate()} disabled={pending} data-testid="buat-usulan">
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {result ? "Buat ulang" : "Buat usulan"}
            </Button>
            {result ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => generate("lebih_singkat")} disabled={pending}>
                  Lebih singkat
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => generate("lebih_santai")} disabled={pending}>
                  Lebih santai
                </Button>
              </>
            ) : null}
          </div>
          {error ? (
            <p className="text-sm text-bahaya" role="alert">
              {error}
            </p>
          ) : null}
          {result ? (
            <ul className="space-y-3">
              {DESCRIPTION_FIELDS.map((f) => {
                const proposal = result.draft[f];
                if (!proposal) return null;
                const issues = result.issues[f] ?? [];
                const done = accepted.has(f);
                return (
                  <li key={f} className="rounded-lg border border-garis bg-putih p-3" data-testid={`usulan-${f}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{FIELD_LABELS[f]}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant={done ? "ghost" : "outline"}
                        disabled={done}
                        onClick={() => {
                          onAccept(f, proposal);
                          setAccepted((s) => new Set([...s, f]));
                        }}
                        data-testid={`terima-${f}`}
                      >
                        {done ? (
                          <>
                            <Check /> Diterima
                          </>
                        ) : (
                          "Terima"
                        )}
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">Isi sekarang</p>
                        <p className={cn("mt-0.5 text-sm whitespace-pre-line", source.current[f] ? "text-kopi/80" : "text-abu-hangat italic")}>{source.current[f] || "Kosong"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-aksen uppercase">Usulan AI</p>
                        <p className="mt-0.5 text-sm whitespace-pre-line text-kopi" data-testid="teks-usulan">{proposal}</p>
                        <p className="mt-0.5 text-[11px] text-abu-hangat tabular-nums">{proposal.length} karakter</p>
                      </div>
                    </div>
                    {issues.length ? (
                      <ul className="mt-2 space-y-1 rounded-md bg-[#FBEEDC] p-2 text-xs text-[#8A5512]" data-testid="klaim-ditandai">
                        {issues.map((x, i) => (
                          <li key={i} className="flex gap-1.5">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            <span>
                              &ldquo;{x.kalimat}&rdquo; {x.alasan}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {result ? <p className="text-xs text-abu-hangat">Kolom yang diterima masuk ke formulir. Tekan Simpan produk untuk menyimpan.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// Penulisan massal: pilih beberapa produk berdeskripsi pendek, buat usulan untuk semuanya, lalu tinjau per produk.
export function BulkDescriptionPanel({ products }: { products: { id: number; name: string; length: number }[] }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<{ id: number; name: string; ok: boolean; message?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  if (!products.length) return null;
  return (
    <section className="mb-4 rounded-xl border border-aksen/25 bg-blush/20 p-4" data-testid="usulan-massal">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-kopi">
        <Sparkles className="size-4 text-aksen" aria-hidden /> Deskripsi pendek, bisa dibantu AI
      </h2>
      <p className="mt-0.5 text-xs text-abu-hangat">Pilih produk, buat usulan untuk semuanya, lalu tinjau dan simpan per produk. Tidak ada deskripsi yang berubah sebelum kamu menyimpan.</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={picked.has(p.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} className="size-4" />
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 text-[11px] text-abu-hangat tabular-nums">{p.length} karakter</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!picked.size || pending}
          onClick={() =>
            run(async () => {
              setError(null);
              const r = await bulkDescriptionAction([...picked]);
              if (!r.ok) return setError(r.message);
              setDone(r.done);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Buat usulan deskripsi ({picked.size})
        </Button>
        {error ? <span className="text-sm text-bahaya">{error}</span> : null}
      </div>
      {done ? (
        <ul className="mt-3 space-y-1 text-sm">
          {done.map((d) => (
            <li key={d.id}>
              {d.ok ? (
                <a href={`/admin/produk/${d.id}`} className="font-semibold text-aksen hover:underline">
                  Tinjau usulan {d.name}
                </a>
              ) : (
                <span className="text-bahaya">
                  {d.name}: {d.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
