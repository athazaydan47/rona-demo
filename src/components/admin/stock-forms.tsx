"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiveStockAction, searchVariantsAction, transferStockAction, variantAvailabilityAction } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";
import { fieldClass } from "./ui";

export type Variant = { variantId: number; productName: string; shadeName: string; sku: string; hex: string; brandName: string };
type Line = { key: number; variant: Variant | null; quantity: string };
type Loc = { id: number; name: string };

// Cari varian berdasarkan nama produk, shade, merek, atau SKU.
export function VariantPicker({ onPick, label = "Cari varian" }: { onPick: (v: Variant) => void; label?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Variant[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      if (q.trim().length < 2) return setHits([]);
      const r = await searchVariantsAction(q).catch(() => []);
      if (my === seq.current) setHits(r);
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-abu-hangat" aria-hidden />
      <input value={q} onChange={(e) => (setQ(e.target.value), setOpen(true))} onFocus={() => setOpen(true)} placeholder="Nama produk, shade, atau SKU" aria-label={label} className={cn(fieldClass, "pl-9")} />
      {open && hits.length ? (
        <ul className="absolute inset-x-0 top-11 z-30 max-h-72 overflow-y-auto rounded-lg border border-garis bg-putih p-1 shadow-lift" role="listbox">
          {hits.map((h) => (
            <li key={h.variantId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-blush/50"
              >
                <span className="size-4 shrink-0 rounded-full border border-garis" style={{ background: h.hex }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {h.productName} <span className="text-abu-hangat">· {h.shadeName}</span>
                </span>
                <span className="font-mono text-[11px] text-abu-hangat">{h.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

let keySeq = 1;
const newLine = (): Line => ({ key: keySeq++, variant: null, quantity: "1" });

// initialLines: draf dari saran transfer (Fase 7B). Staf tetap memeriksa lalu menyimpan sendiri.
export function StockLinesForm({ mode, locations, defaultFrom, defaultTo, initialLines, draftNote }: { mode: "masuk" | "transfer"; locations: Loc[]; defaultFrom?: number; defaultTo?: number; initialLines?: { variant: Variant; quantity: number }[]; draftNote?: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() => (initialLines?.length ? initialLines.map((l) => ({ key: keySeq++, variant: l.variant, quantity: String(l.quantity) })) : [newLine()]));
  const [from, setFrom] = useState<number>(defaultFrom ?? locations[0]?.id ?? 0);
  const [to, setTo] = useState<number>(defaultTo ?? locations.find((l) => l.id !== (defaultFrom ?? locations[0]?.id))?.id ?? 0);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [avail, setAvail] = useState<Record<number, Record<number, number>>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<number, string>>({});
  const [done, setDone] = useState<{ reference: string; lines: number } | null>(null);
  const [pending, start] = useTransition();

  const picked = lines.filter((l) => l.variant).map((l) => l.variant!.variantId);
  const pickedKey = picked.join(",");
  useEffect(() => {
    if (!pickedKey) return;
    let alive = true;
    variantAvailabilityAction(pickedKey.split(",").map(Number)).then((r) => alive && setAvail(r));
    return () => {
      alive = false;
    };
  }, [pickedKey]);

  const valid = lines.filter((l) => l.variant && Number(l.quantity) > 0);
  const total = valid.reduce((s, l) => s + Number(l.quantity), 0);
  const target = mode === "masuk" ? from : to;
  const name = (id: number) => locations.find((l) => l.id === id)?.name ?? "";
  const over = mode === "transfer" ? valid.filter((l) => Number(l.quantity) > (avail[l.variant!.variantId]?.[from] ?? 0)) : [];

  const submit = () =>
    start(async () => {
      setError(null);
      setIssues({});
      const payload = valid.map((l) => ({ variantId: l.variant!.variantId, quantity: Number(l.quantity) }));
      const r = mode === "masuk" ? await receiveStockAction({ locationId: from, lines: payload, reference, note }) : await transferStockAction({ fromId: from, toId: to, lines: payload, note });
      if (!r.ok) {
        setError(r.message);
        if ("issues" in r && Array.isArray(r.issues)) setIssues(Object.fromEntries((r.issues as { variantId: number; message: string }[]).map((i) => [i.variantId, i.message])));
        setConfirming(false);
        return;
      }
      setDone({ reference: r.reference, lines: r.lines });
      setConfirming(false);
      setLines([newLine()]);
      router.refresh();
    });

  if (done) {
    return (
      <div className="rounded-xl border border-garis bg-putih p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-sukses" aria-hidden />
        <p className="mt-2 font-serif text-xl text-kopi">{mode === "masuk" ? "Stok masuk tersimpan" : "Transfer tersimpan"}</p>
        <p className="mt-1 text-sm text-abu-hangat">
          Referensi <span className="font-mono font-semibold text-kopi" data-testid="referensi-stok">{done.reference}</span>, {done.lines} varian.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/stok">Lihat matriks</Link>
          </Button>
          <Button onClick={() => setDone(null)}>{mode === "masuk" ? "Catat lagi" : "Transfer lagi"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draftNote ? (
        <p className="rounded-xl bg-[#FBEEDC] px-4 py-2.5 text-sm text-[#8A5512]" role="status" data-testid="draf-transfer">
          {draftNote}
        </p>
      ) : null}
      <div className="grid gap-3 rounded-xl border border-garis bg-putih p-4 md:grid-cols-2">
        {mode === "transfer" ? (
          <>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Dari lokasi</span>
              <select value={from} onChange={(e) => setFrom(Number(e.target.value))} className={fieldClass} aria-label="Lokasi asal">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Ke lokasi</span>
              <select value={to} onChange={(e) => setTo(Number(e.target.value))} className={fieldClass} aria-label="Lokasi tujuan">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            {from === to ? <p className="text-sm text-bahaya md:col-span-2" role="alert">Lokasi asal dan tujuan tidak boleh sama.</p> : null}
          </>
        ) : (
          <>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Lokasi tujuan</span>
              <select value={from} onChange={(e) => setFrom(Number(e.target.value))} className={fieldClass} aria-label="Lokasi tujuan">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Referensi atau nomor surat jalan</span>
              <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 40))} placeholder="Kosongkan untuk dibuat otomatis" className={fieldClass} />
            </label>
          </>
        )}
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-medium">Catatan (opsional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} className={fieldClass} placeholder={mode === "masuk" ? "Misal: kiriman distributor Surabaya" : "Misal: isi ulang rak cabang"} />
        </label>
      </div>

      <div className="rounded-xl border border-garis bg-putih">
        <div className="flex items-center justify-between border-b border-garis px-4 py-2.5">
          <h2 className="text-sm font-semibold">Barang</h2>
          <span className="text-xs text-abu-hangat tabular-nums">
            {valid.length} varian · {total} pcs
          </span>
        </div>
        <ul className="divide-y divide-garis">
          {lines.map((l, i) => (
            <li key={l.key} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_120px_40px] md:items-center">
              {l.variant ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="mr-1.5 inline-block size-3 rounded-full border border-garis align-middle" style={{ background: l.variant.hex }} aria-hidden />
                    {l.variant.productName} · {l.variant.shadeName}
                  </p>
                  <p className="text-xs text-abu-hangat">
                    <span className="font-mono">{l.variant.sku}</span>
                    {mode === "transfer" ? ` · tersedia di asal ${avail[l.variant.variantId]?.[from] ?? 0}` : ` · tersedia di ${name(target)} ${avail[l.variant.variantId]?.[target] ?? 0}`}
                  </p>
                  {issues[l.variant.variantId] ? <p className="text-xs text-bahaya">{issues[l.variant.variantId]}</p> : null}
                </div>
              ) : (
                <VariantPicker label={`Varian baris ${i + 1}`} onPick={(v) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, variant: v } : x)))} />
              )}
              <input type="number" min={1} inputMode="numeric" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: e.target.value.replace(/\D/g, "").slice(0, 5) } : x)))} aria-label={`Jumlah baris ${i + 1}`} className={cn(fieldClass, "text-right tabular-nums", mode === "transfer" && l.variant && Number(l.quantity) > (avail[l.variant.variantId]?.[from] ?? 0) && "border-bahaya")} />
              <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))} className="grid size-10 place-items-center rounded-lg text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus baris ${i + 1}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-garis p-3">
          <Button type="button" size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, newLine()])} disabled={lines.length >= 50}>
            <Plus /> Tambah baris
          </Button>
        </div>
      </div>

      {over.length ? (
        <p className="rounded-lg bg-[#F7E3E1] px-3 py-2 text-sm text-bahaya" role="alert">
          Jumlah melebihi stok tersedia di {name(from)} untuk {over.length} varian.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-[#F7E3E1] px-3 py-2 text-sm text-bahaya" role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="rounded-xl border-2 border-kopi bg-putih p-4" data-testid="ringkasan-stok">
          <p className="font-semibold">Periksa sebelum menyimpan</p>
          <p className="mt-1 text-sm text-abu-hangat">
            {mode === "masuk" ? `Tambah stok fisik di ${name(from)}` : `Pindahkan dari ${name(from)} ke ${name(to)}`}: {valid.length} varian, {total} pcs.
          </p>
          <ul className="mt-2 space-y-0.5 text-sm">
            {valid.map((l) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span className="truncate">
                  {l.variant!.productName} · {l.variant!.shadeName}
                </span>
                <span className="font-semibold tabular-nums">{mode === "masuk" ? "+" : ""}{l.quantity}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Simpan
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Ubah lagi
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" disabled={!valid.length || (mode === "transfer" && (from === to || over.length > 0))} onClick={() => setConfirming(true)}>
          Lanjut ke ringkasan
        </Button>
      )}
    </div>
  );
}
