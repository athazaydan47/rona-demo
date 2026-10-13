"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitOpnameAction } from "@/lib/admin/actions";
import { opnamePreview } from "@/lib/admin/opname";
import { cn } from "@/lib/utils";
import { tdClass, thClass } from "./ui";

export type SheetRow = { variantId: number; productName: string; shadeName: string; sku: string; hex: string; onHand: number; reserved: number };

export function OpnameSheet({ locationId, locationName, rows }: { locationId: number; locationName: string; rows: SheetRow[] }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; changed: number } | null>(null);
  const [pending, start] = useTransition();

  // Baris yang diisi saja yang ikut opname (boleh sebagian varian).
  const filled = rows.filter((r) => counts[r.variantId] != null && counts[r.variantId] !== "");
  const preview = useMemo(() => opnamePreview(filled.map((r) => ({ variantId: r.variantId, onHand: r.onHand, reserved: r.reserved, counted: Number(counts[r.variantId]) }))), [filled, counts]);
  const byId = new Map(preview.rows.map((r) => [r.variantId, r]));

  if (done) {
    return (
      <div className="rounded-xl border border-garis bg-putih p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-sukses" aria-hidden />
        <p className="mt-2 font-serif text-xl">Opname tersimpan</p>
        <p className="mt-1 text-sm text-abu-hangat">
          Referensi <span className="font-mono font-semibold text-kopi">{done.reference}</span>, {done.changed} varian disesuaikan.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/admin/stok">Lihat matriks</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-garis bg-putih">
        <table className="w-full text-sm" data-testid="lembar-opname">
          <thead className="border-b border-garis bg-porselen/70">
            <tr>
              <th className={thClass}>Varian</th>
              <th className={`${thClass} text-right`}>Sistem</th>
              <th className={`${thClass} text-right`}>Dipesan</th>
              <th className={`${thClass} w-28 text-right`}>Fisik</th>
              <th className={`${thClass} text-right`}>Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {rows.map((r) => {
              const p = byId.get(r.variantId);
              return (
                <tr key={r.variantId} className={cn(p?.belowReserved && "bg-[#F7E3E1]")}>
                  <td className={tdClass}>
                    <p className="max-w-64 truncate font-medium">
                      <span className="mr-1.5 inline-block size-3 rounded-full border border-garis align-middle" style={{ background: r.hex }} aria-hidden />
                      {r.productName}
                    </p>
                    <p className="text-xs text-abu-hangat">
                      {r.shadeName} · <span className="font-mono">{r.sku}</span>
                    </p>
                    {p?.belowReserved ? <p className="text-xs font-semibold text-bahaya">Lebih kecil dari {r.reserved} yang sedang dipesan pembeli.</p> : null}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{r.onHand}</td>
                  <td className={`${tdClass} text-right text-abu-hangat tabular-nums`}>{r.reserved}</td>
                  <td className={`${tdClass} text-right`}>
                    <input
                      inputMode="numeric"
                      value={counts[r.variantId] ?? ""}
                      onChange={(e) => setCounts((c) => ({ ...c, [r.variantId]: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                      placeholder="-"
                      aria-label={`Jumlah fisik ${r.productName} ${r.shadeName}`}
                      className="h-9 w-20 rounded-lg border border-garis px-2 text-right tabular-nums outline-none focus-visible:border-rona"
                    />
                  </td>
                  <td className={cn(tdClass, "text-right font-semibold tabular-nums", p && p.diff > 0 && "text-sukses", p && p.diff < 0 && "text-bahaya")} data-testid={`selisih-${r.variantId}`}>
                    {p ? `${p.diff > 0 ? "+" : ""}${p.diff}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-kopi/20 bg-porselen/70 font-semibold">
            <tr>
              <td className={tdClass}>Total {preview.rows.length} varian dihitung, {preview.changed} berubah</td>
              <td colSpan={3} className={`${tdClass} text-right text-xs font-normal text-abu-hangat`}>
                +{preview.plus} / {preview.minus}
              </td>
              <td className={`${tdClass} text-right tabular-nums`} data-testid="selisih-total">
                {preview.totalDiff > 0 ? "+" : ""}
                {preview.totalDiff}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {preview.violations ? (
        <p className="flex items-start gap-2 rounded-lg bg-[#F7E3E1] px-3 py-2 text-sm text-bahaya" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {preview.violations} varian dihitung lebih kecil dari jumlah yang sedang dipesan pembeli. Selesaikan atau batalkan pesanannya dulu, atau hitung ulang.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-[#F7E3E1] px-3 py-2 text-sm text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Catatan opname</span>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Misal: opname bulanan rak depan" className="h-10 w-full rounded-lg border border-garis bg-putih px-3" />
      </label>
      {confirming ? (
        <div className="rounded-xl border-2 border-kopi bg-putih p-4">
          <p className="font-semibold">Simpan opname di {locationName}?</p>
          <p className="mt-1 text-sm text-abu-hangat">
            {preview.changed} varian disesuaikan, total selisih {preview.totalDiff > 0 ? "+" : ""}
            {preview.totalDiff} pcs. Setiap selisih menulis buku stok jenis opname.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await submitOpnameAction({ locationId, counts: preview.rows.map((x) => ({ variantId: x.variantId, counted: x.counted })), note });
                  setConfirming(false);
                  if (!r.ok) return setError(r.message);
                  setDone({ reference: r.reference, changed: r.lines });
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Simpan opname
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Hitung lagi
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" disabled={!preview.rows.length || preview.violations > 0} onClick={() => setConfirming(true)}>
          Lanjut ke konfirmasi
        </Button>
      )}
    </div>
  );
}
