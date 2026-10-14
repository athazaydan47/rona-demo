"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowDown, ArrowUp, Camera, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { BannerCard } from "@/components/home/banner-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { packagingValues, type Packaging } from "@/db/schema/enums";
import type { BannerArt } from "@/db/schema/content";
import { deleteBannerAction, moveBannerAction, saveBannerAction, savePromoBarAction, saveVoucherAction, setVariantPromoAction, setVoucherActiveAction } from "@/lib/admin/catalog-actions";
import { validateBanner, validateVoucher } from "@/lib/admin/promo-rules";
import { uploadAdminPhoto } from "@/lib/client/compress-image";
import { formatDateTimeWib, formatDateWib, formatNumber, formatRupiah, fromWibInput, toWibInput } from "@/lib/format";
import { discountPercent, roundToPromo } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { PromoVariantPicker } from "./promo-flash";
import { fieldClass } from "./ui";

type Notice = { ok: boolean; text: string } | null;
function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={cn("rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
      {notice.text}
    </p>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function Sheet({ open, onOpenChange, title, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
        <Dialog.Content className={cn("fixed inset-x-3 top-[4dvh] bottom-[4dvh] z-50 mx-auto flex flex-col overflow-hidden rounded-card bg-putih shadow-lift outline-none", wide ? "max-w-5xl" : "max-w-xl")}>
          <div className="flex items-start justify-between border-b border-garis px-5 py-3">
            <Dialog.Title className="font-serif text-xl">{title}</Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const digits = (v: string) => v.replace(/\D/g, "");

// ---------- Harga promo per varian ----------

export type VariantPromoRow = { variantId: number; productName: string; shadeName: string; sku: string; hex: string; normalPrice: number; salePrice: number; promoPrice: number | null; promoStartsAt: string | null; promoEndsAt: string | null };

export function VariantPromoManager({ rows }: { rows: VariantPromoRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ variantId: number; label: string; normalPrice: number; salePrice: number; price: string; start: string; end: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, run] = useTransition();
  const promo = draft && draft.price ? roundToPromo(Number(draft.price)) : 0;
  const save = (clear = false) =>
    run(async () => {
      if (!draft) return;
      const r = await setVariantPromoAction({ variantId: draft.variantId, promoPrice: clear ? null : Number(draft.price), startsAt: fromWibInput(draft.start)?.toISOString() ?? null, endsAt: fromWibInput(draft.end)?.toISOString() ?? null });
      if (!r.ok) return setNotice({ ok: false, text: r.message });
      setNotice({ ok: true, text: clear ? "Harga promo dihapus." : "Harga promo tersimpan." });
      setDraft(null);
      router.refresh();
    });
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-garis bg-putih p-4">
        <h2 className="mb-1 text-sm font-semibold">Atur harga promo varian</h2>
        <p className="mb-3 text-xs text-abu-hangat">Harga promo berlaku dalam periode tertentu, dibulatkan ke Rp 500, dan harus di bawah harga jual. Flash sale tetap lebih kuat selama slotnya berjalan.</p>
        <PromoVariantPicker onPick={(v) => setDraft({ variantId: v.variantId, label: `${v.productName} · ${v.shadeName}`, normalPrice: v.normalPrice, salePrice: v.salePrice, price: v.promoPrice ? String(v.promoPrice) : "", start: toWibInput(v.promoStartsAt ? new Date(v.promoStartsAt) : new Date()), end: toWibInput(v.promoEndsAt ? new Date(v.promoEndsAt) : new Date(Date.now() + 7 * 86_400_000)) })} />
        {draft ? (
          <div className="mt-3 rounded-lg border border-garis bg-porselen/40 p-3">
            <p className="text-sm font-medium">{draft.label}</p>
            <p className="text-xs text-abu-hangat">
              Normal {formatRupiah(draft.normalPrice)}, harga jual {formatRupiah(draft.salePrice)}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Harga promo">
                <input inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: digits(e.target.value) })} className={fieldClass} aria-label="Harga promo" />
              </Field>
              <Field label="Mulai (WIB)">
                <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={fieldClass} />
              </Field>
              <Field label="Selesai (WIB)">
                <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={fieldClass} />
              </Field>
            </div>
            {promo > 0 ? (
              <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-abu-hangat line-through tabular-nums">{formatRupiah(draft.normalPrice)}</span>
                <span className="font-semibold text-aksen tabular-nums">{formatRupiah(promo)}</span>
                <span className="rounded bg-aksen px-1.5 text-xs font-semibold text-putih">-{discountPercent(draft.normalPrice, promo)}%</span>
                {promo !== Number(draft.price) ? <span className="text-xs text-abu-hangat">dibulatkan dari {formatRupiah(Number(draft.price))}</span> : null}
                {promo >= draft.salePrice ? <span className="text-xs text-bahaya">Harus di bawah harga jual.</span> : null}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Batal
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => save(true)}>
                Hapus promo
              </Button>
              <Button disabled={pending || !promo || promo >= draft.salePrice} onClick={() => save(false)}>
                {pending ? <Loader2 className="animate-spin" /> : null} Simpan harga promo
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <NoticeLine notice={notice} />
      <section className="overflow-x-auto rounded-xl border border-garis bg-putih">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-porselen/60 text-left text-xs text-abu-hangat">
            <tr>
              <th className="px-3 py-2 font-semibold">Varian</th>
              <th className="px-3 py-2 font-semibold">Harga</th>
              <th className="px-3 py-2 font-semibold">Periode</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {rows.map((r) => (
              <tr key={r.variantId}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="size-4 shrink-0 rounded-full border border-garis" style={{ background: r.hex }} aria-hidden />
                    <span>
                      <span className="block font-medium">{r.productName}</span>
                      <span className="block text-xs text-abu-hangat">
                        {r.shadeName} · <span className="font-mono">{r.sku}</span>
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  <span className="block font-semibold text-aksen">{formatRupiah(r.promoPrice ?? 0)}</span>
                  <span className="text-xs text-abu-hangat line-through">{formatRupiah(r.normalPrice)}</span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.promoStartsAt ? formatDateTimeWib(new Date(r.promoStartsAt)) : "Sekarang"} sampai {r.promoEndsAt ? formatDateTimeWib(new Date(r.promoEndsAt)) : "tanpa batas"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setDraft({ variantId: r.variantId, label: `${r.productName} · ${r.shadeName}`, normalPrice: r.normalPrice, salePrice: r.salePrice, price: String(r.promoPrice ?? ""), start: toWibInput(r.promoStartsAt ? new Date(r.promoStartsAt) : null), end: toWibInput(r.promoEndsAt ? new Date(r.promoEndsAt) : null) })} className="inline-grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-label={`Ubah promo ${r.productName} ${r.shadeName}`}>
                    <Pencil className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-abu-hangat">
                  Belum ada harga promo yang berjalan atau terjadwal.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------- Voucher ----------

export type VoucherRow = { id: number; code: string; title: string; description: string; type: "nominal" | "persen" | "ongkir"; value: number; maxDiscount: number | null; minSpend: number; startsAt: string; endsAt: string; quota: number | null; quotaPerCustomer: number; used: number; scope: { brandIds?: number[]; categoryIds?: number[] }; stackWithFlash: boolean; isActive: boolean; redeemed: number; totalDiscount: number; remaining: number | null };
type VoucherDraft = { id: number | null; used: number; code: string; title: string; description: string; type: "nominal" | "persen" | "ongkir"; value: string; maxDiscount: string; minSpend: string; start: string; end: string; quota: string; quotaPerCustomer: string; brandIds: number[]; categoryIds: number[]; stackWithFlash: boolean; isActive: boolean };

const TYPE_LABEL = { nominal: "Potongan rupiah", persen: "Potongan persen", ongkir: "Gratis ongkir" } as const;
const voucherValue = (v: { type: string; value: number; maxDiscount: number | null }) => (v.type === "persen" ? `${v.value}%${v.maxDiscount ? `, maks ${formatRupiah(v.maxDiscount)}` : ""}` : v.type === "ongkir" ? `Ongkir s.d. ${formatRupiah(v.value)}` : formatRupiah(v.value));

export function VoucherManager({ vouchers, brands, categories, nowIso }: { vouchers: VoucherRow[]; brands: { id: number; name: string }[]; categories: { id: number; name: string }[]; nowIso: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<VoucherDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, run] = useTransition();
  const now = new Date(nowIso).getTime();
  const blank = (): VoucherDraft => ({ id: null, used: 0, code: "", title: "", description: "", type: "nominal", value: "", maxDiscount: "", minSpend: "0", start: toWibInput(new Date(nowIso)), end: toWibInput(new Date(now + 30 * 86_400_000)), quota: "", quotaPerCustomer: "1", brandIds: [], categoryIds: [], stackWithFlash: false, isActive: true });
  const fromRow = (v: VoucherRow): VoucherDraft => ({ id: v.id, used: v.used, code: v.code, title: v.title, description: v.description, type: v.type, value: String(v.value), maxDiscount: v.maxDiscount == null ? "" : String(v.maxDiscount), minSpend: String(v.minSpend), start: toWibInput(new Date(v.startsAt)), end: toWibInput(new Date(v.endsAt)), quota: v.quota == null ? "" : String(v.quota), quotaPerCustomer: String(v.quotaPerCustomer), brandIds: v.scope.brandIds ?? [], categoryIds: v.scope.categoryIds ?? [], stackWithFlash: v.stackWithFlash, isActive: v.isActive });
  const toForm = (d: VoucherDraft) => ({ code: d.code.trim().toUpperCase(), title: d.title, description: d.description, type: d.type, value: Number(d.value), maxDiscount: d.maxDiscount ? Number(d.maxDiscount) : null, minSpend: Number(d.minSpend || 0), quota: d.quota ? Number(d.quota) : null, quotaPerCustomer: Number(d.quotaPerCustomer || 1), brandIds: d.brandIds, categoryIds: d.categoryIds, stackWithFlash: d.stackWithFlash, isActive: d.isActive });
  const save = () =>
    run(async () => {
      if (!draft) return;
      const s = fromWibInput(draft.start);
      const e = fromWibInput(draft.end);
      const form = toForm(draft);
      const err = validateVoucher({ ...form, startsAt: s ?? new Date(NaN), endsAt: e ?? new Date(NaN) });
      if (err) return setError(err);
      const r = await saveVoucherAction(draft.id, { ...form, startsAt: s!.toISOString(), endsAt: e!.toISOString() });
      if (!r.ok) return setError(r.message);
      setDraft(null);
      setNotice({ ok: true, text: `Voucher ${form.code} tersimpan.` });
      router.refresh();
    });
  const toggle = (id: number, list: number[]) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-abu-hangat">Menonaktifkan voucher tidak menghapus riwayat pemakaiannya.</p>
        <Button size="sm" onClick={() => (setError(null), setDraft(blank()))}>
          <Plus /> Buat voucher
        </Button>
      </div>
      <NoticeLine notice={notice} />
      <section className="overflow-x-auto rounded-xl border border-garis bg-putih">
        <table className="w-full min-w-[820px] text-sm" data-testid="tabel-voucher">
          <thead className="bg-porselen/60 text-left text-xs text-abu-hangat">
            <tr>
              <th className="px-3 py-2 font-semibold">Kode</th>
              <th className="px-3 py-2 font-semibold">Nilai</th>
              <th className="px-3 py-2 font-semibold">Periode</th>
              <th className="px-3 py-2 font-semibold">Dipakai</th>
              <th className="px-3 py-2 font-semibold">Total potongan</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {vouchers.map((v) => {
              const expired = new Date(v.endsAt).getTime() <= now;
              return (
                <tr key={v.id} className={cn(!v.isActive && "opacity-60")}>
                  <td className="px-3 py-2">
                    <span className="block font-mono font-semibold">{v.code}</span>
                    <span className="block text-xs text-abu-hangat">{v.title}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block">{voucherValue(v)}</span>
                    <span className="block text-xs text-abu-hangat">{v.minSpend ? `Min. ${formatRupiah(v.minSpend)}` : "Tanpa minimal"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatDateWib(new Date(v.startsAt))} sampai {formatDateWib(new Date(v.endsAt))}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatNumber(v.redeemed)}
                    {v.quota != null ? <span className="text-xs text-abu-hangat"> / {formatNumber(v.quota)} (sisa {formatNumber(v.remaining ?? 0)})</span> : <span className="text-xs text-abu-hangat"> / tanpa batas</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatRupiah(v.totalDiscount)}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", !v.isActive ? "bg-garis/60 text-abu-hangat" : expired ? "bg-[#FBEEDC] text-[#8A5512]" : "bg-[#E5F2EA] text-sukses")}>{!v.isActive ? "Nonaktif" : expired ? "Berakhir" : "Aktif"}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => (setError(null), setDraft(fromRow(v)))} className="inline-grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-label={`Ubah voucher ${v.code}`}>
                      <Pencil className="size-4" />
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const r = await setVoucherActiveAction(v.id, !v.isActive);
                          setNotice(r.ok ? { ok: true, text: `Voucher ${v.code} ${v.isActive ? "dinonaktifkan" : "diaktifkan"}.` } : { ok: false, text: r.message });
                          router.refresh();
                        })
                      }
                    >
                      {v.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <Sheet open={draft != null} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? `Ubah voucher ${draft.code}` : "Buat voucher"}>
        {draft ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Kode">
              <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} disabled={draft.used > 0} className={cn(fieldClass, "font-mono uppercase")} aria-label="Kode voucher" />
              {draft.used > 0 ? <span className="mt-1 block text-xs text-abu-hangat">Kode yang sudah dipakai tidak bisa diganti.</span> : null}
            </Field>
            <Field label="Judul">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={fieldClass} aria-label="Judul voucher" />
            </Field>
            <Field label="Deskripsi" className="sm:col-span-2">
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Tipe">
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as VoucherDraft["type"] })} className={fieldClass} aria-label="Tipe voucher">
                {Object.entries(TYPE_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={draft.type === "persen" ? "Persen potongan" : draft.type === "ongkir" ? "Potongan ongkir maksimal" : "Nilai potongan"}>
              <input inputMode="numeric" value={draft.value} onChange={(e) => setDraft({ ...draft, value: digits(e.target.value) })} className={fieldClass} aria-label="Nilai voucher" />
            </Field>
            {draft.type === "persen" ? (
              <Field label="Maksimal potongan">
                <input inputMode="numeric" value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: digits(e.target.value) })} className={fieldClass} aria-label="Maksimal potongan" />
              </Field>
            ) : null}
            <Field label="Minimal belanja">
              <input inputMode="numeric" value={draft.minSpend} onChange={(e) => setDraft({ ...draft, minSpend: digits(e.target.value) })} className={fieldClass} aria-label="Minimal belanja" />
            </Field>
            <Field label="Mulai (WIB)">
              <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={fieldClass} aria-label="Mulai voucher" />
            </Field>
            <Field label="Selesai (WIB)">
              <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={fieldClass} aria-label="Selesai voucher" />
            </Field>
            <Field label="Kuota total (kosongkan bila tanpa batas)">
              <input inputMode="numeric" value={draft.quota} onChange={(e) => setDraft({ ...draft, quota: digits(e.target.value) })} className={fieldClass} aria-label="Kuota voucher" />
            </Field>
            <Field label="Kuota per pembeli">
              <input inputMode="numeric" value={draft.quotaPerCustomer} onChange={(e) => setDraft({ ...draft, quotaPerCustomer: digits(e.target.value) })} className={fieldClass} aria-label="Kuota per pembeli" />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Khusus merek (opsional)</legend>
              <div className="flex flex-wrap gap-1.5">
                {brands.map((b) => (
                  <button key={b.id} type="button" onClick={() => setDraft({ ...draft, brandIds: toggle(b.id, draft.brandIds) })} aria-pressed={draft.brandIds.includes(b.id)} className={cn("h-8 rounded-pill border px-3 text-xs", draft.brandIds.includes(b.id) ? "border-kopi bg-kopi text-putih" : "border-garis")}>
                    {b.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Khusus kategori (opsional)</legend>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button key={c.id} type="button" onClick={() => setDraft({ ...draft, categoryIds: toggle(c.id, draft.categoryIds) })} aria-pressed={draft.categoryIds.includes(c.id)} className={cn("h-8 rounded-pill border px-3 text-xs", draft.categoryIds.includes(c.id) ? "border-kopi bg-kopi text-putih" : "border-garis")}>
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.stackWithFlash} onChange={(e) => setDraft({ ...draft, stackWithFlash: e.target.checked })} className="size-4 accent-aksen" /> Boleh dipakai bersama flash sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="size-4 accent-aksen" /> Aktif
            </label>
            {error ? (
              <p className="text-sm text-bahaya sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Simpan voucher
              </Button>
            </div>
          </form>
        ) : null}
      </Sheet>
    </div>
  );
}

// ---------- Banner dan PromoBar ----------

export type BannerRowView = { id: number; title: string; subtitle: string; ctaLabel: string; href: string; imageUrl: string | null; art: BannerArt | null; startsAt: string | null; endsAt: string | null; sortOrder: number; isActive: boolean };
type BannerDraft = { id: number | null; title: string; subtitle: string; ctaLabel: string; href: string; mode: "art" | "image"; imageUrl: string | null; art: BannerArt; start: string; end: string; isActive: boolean; sortOrder?: number };

const DEFAULT_ART: BannerArt = { items: [{ packaging: "lipstick", shade: "#B8475D", brandColor: "#C2416B", brandName: "Lumi" }], background: "#F4DCDF" };

// Bingkai pratinjau: konten dirender pada lebar asli lalu diskalakan supaya muat.
function ScaledFrame({ width, height, label, children }: { width: number; height: number; label: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-xs text-abu-hangat">{label}</figcaption>
      <div ref={box} className="w-full overflow-hidden rounded-lg border border-garis bg-porselen" style={{ height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </figure>
  );
}

export function BannerPreview({ banner }: { banner: { title: string; subtitle: string; ctaLabel: string; href: string; imageUrl: string | null; art: BannerArt | null } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]" data-testid="pratinjau-banner">
      <ScaledFrame width={375} height={243} label="HP 375 px">
        <div className="h-full p-4 pb-[19px]">
          <BannerCard banner={banner} />
        </div>
      </ScaledFrame>
      <ScaledFrame width={1440} height={420} label="Desktop 1440 px">
        <div className="mx-auto h-full max-w-[1280px] px-10 py-[30px]">
          <BannerCard banner={banner} />
        </div>
      </ScaledFrame>
    </div>
  );
}

export function BannerManager({ banners, photosEnabled, nowIso }: { banners: BannerRowView[]; photosEnabled: boolean; nowIso: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<BannerDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [removing, setRemoving] = useState<BannerRowView | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, run] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const now = new Date(nowIso).getTime();
  const fromRow = (b: BannerRowView): BannerDraft => ({ id: b.id, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, href: b.href, mode: b.imageUrl ? "image" : "art", imageUrl: b.imageUrl, art: b.art ?? DEFAULT_ART, start: toWibInput(b.startsAt ? new Date(b.startsAt) : null), end: toWibInput(b.endsAt ? new Date(b.endsAt) : null), isActive: b.isActive, sortOrder: b.sortOrder });
  const view = (d: BannerDraft) => ({ title: d.title || "Judul banner", subtitle: d.subtitle, ctaLabel: d.ctaLabel, href: d.href, imageUrl: d.mode === "image" ? d.imageUrl : null, art: d.mode === "art" ? d.art : null });
  const setItem = (i: number, patch: Partial<BannerArt["items"][number]>) => draft && setDraft({ ...draft, art: { ...draft.art, items: draft.art.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) } });
  const save = () =>
    run(async () => {
      if (!draft) return;
      const form = { title: draft.title, subtitle: draft.subtitle, ctaLabel: draft.ctaLabel, href: draft.href, imageUrl: draft.mode === "image" ? draft.imageUrl : null, art: draft.mode === "art" ? draft.art : null, isActive: draft.isActive, sortOrder: draft.sortOrder };
      const s = draft.start ? fromWibInput(draft.start) : null;
      const e = draft.end ? fromWibInput(draft.end) : null;
      const err = validateBanner({ ...form, startsAt: s, endsAt: e });
      if (err) return setError(err);
      const r = await saveBannerAction(draft.id, { ...form, startsAt: s?.toISOString() ?? null, endsAt: e?.toISOString() ?? null });
      if (!r.ok) return setError(r.message);
      setDraft(null);
      setNotice({ ok: true, text: "Banner tersimpan dan beranda diperbarui." });
      router.refresh();
    });
  const state = (b: BannerRowView) => (!b.isActive ? "Nonaktif" : b.endsAt && new Date(b.endsAt).getTime() <= now ? "Berakhir" : b.startsAt && new Date(b.startsAt).getTime() > now ? "Terjadwal" : "Tayang");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-abu-hangat">Banner tampil sebagai karusel di beranda sesuai urutan dan jadwalnya.</p>
        <Button size="sm" onClick={() => (setError(null), setDraft({ id: null, title: "", subtitle: "", ctaLabel: "Belanja sekarang", href: "/", mode: "art", imageUrl: null, art: DEFAULT_ART, start: "", end: "", isActive: true }))}>
          <Plus /> Buat banner
        </Button>
      </div>
      <NoticeLine notice={notice} />
      <ul className="space-y-2" data-testid="daftar-banner">
        {banners.map((b, i) => (
          <li key={b.id} className={cn("flex flex-col gap-3 rounded-xl border border-garis bg-putih p-3 sm:flex-row sm:items-center", !b.isActive && "opacity-60")}>
            <div className="aspect-[1200/360] w-full shrink-0 sm:w-56">
              <BannerCard banner={b} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.title}</p>
              <p className="text-xs text-abu-hangat">
                {state(b)} · {b.startsAt ? formatDateTimeWib(new Date(b.startsAt)) : "Mulai sekarang"} sampai {b.endsAt ? formatDateTimeWib(new Date(b.endsAt)) : "tanpa batas"} · ke <span className="font-mono">{b.href}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" disabled={i === 0 || pending} onClick={() => run(async () => void ((await moveBannerAction(b.id, -1)).ok && router.refresh()))} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen disabled:opacity-30" aria-label={`Naikkan ${b.title}`}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={i === banners.length - 1 || pending} onClick={() => run(async () => void ((await moveBannerAction(b.id, 1)).ok && router.refresh()))} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen disabled:opacity-30" aria-label={`Turunkan ${b.title}`}>
                <ArrowDown className="size-4" />
              </button>
              <button type="button" onClick={() => (setError(null), setDraft(fromRow(b)))} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-label={`Ubah ${b.title}`}>
                <Pencil className="size-4" />
              </button>
              <button type="button" onClick={() => setRemoving(b)} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus ${b.title}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Sheet open={draft != null} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Ubah banner" : "Buat banner"} wide>
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <BannerPreview banner={view(draft)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Judul">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} className={fieldClass} aria-label="Judul banner" />
              </Field>
              <Field label="Label tombol">
                <input value={draft.ctaLabel} onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })} maxLength={30} className={fieldClass} />
              </Field>
              <Field label="Teks" className="sm:col-span-2">
                <input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} maxLength={200} className={fieldClass} aria-label="Teks banner" />
              </Field>
              <Field label="Tautan (halaman toko)">
                <input value={draft.href} onChange={(e) => setDraft({ ...draft, href: e.target.value.trim() })} className={cn(fieldClass, "font-mono")} placeholder="/c/skincare" aria-label="Tautan banner" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Mulai (WIB, opsional)">
                  <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={fieldClass} />
                </Field>
                <Field label="Selesai (WIB, opsional)">
                  <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={fieldClass} />
                </Field>
              </div>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Visual</legend>
              <div className="mb-3 inline-flex rounded-lg border border-garis p-0.5 text-sm">
                {(["art", "image"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setDraft({ ...draft, mode: m })} aria-pressed={draft.mode === m} className={cn("rounded-md px-3 py-1.5", draft.mode === m ? "bg-kopi text-putih" : "")}>
                    {m === "art" ? "Komposisi ProductArt" : "Gambar"}
                  </button>
                ))}
              </div>
              {draft.mode === "art" ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    Latar
                    <input type="color" value={draft.art.background ?? "#F4DCDF"} onChange={(e) => setDraft({ ...draft, art: { ...draft.art, background: e.target.value.toUpperCase() } })} className="h-9 w-12 rounded border border-garis p-1" aria-label="Warna latar banner" />
                  </label>
                  {draft.art.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-garis p-2">
                      <select value={it.packaging} onChange={(e) => setItem(i, { packaging: e.target.value as Packaging })} className={fieldClass} aria-label={`Kemasan produk ${i + 1}`}>
                        {packagingValues.map((p) => (
                          <option key={p} value={p}>
                            {p.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      <input type="color" value={it.shade} onChange={(e) => setItem(i, { shade: e.target.value.toUpperCase() })} className="h-10 w-11 rounded border border-garis p-1" aria-label={`Warna isi produk ${i + 1}`} />
                      <input type="color" value={it.brandColor} onChange={(e) => setItem(i, { brandColor: e.target.value.toUpperCase() })} className="h-10 w-11 rounded border border-garis p-1" aria-label={`Warna merek produk ${i + 1}`} />
                      <input value={it.brandName} onChange={(e) => setItem(i, { brandName: e.target.value.slice(0, 20) })} className={fieldClass} aria-label={`Nama merek produk ${i + 1}`} />
                      <button type="button" disabled={draft.art.items.length <= 1} onClick={() => setDraft({ ...draft, art: { ...draft.art, items: draft.art.items.filter((_, k) => k !== i) } })} className="grid size-9 place-items-center rounded-lg text-abu-hangat hover:bg-porselen disabled:opacity-30" aria-label={`Hapus produk ${i + 1}`}>
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {draft.art.items.length < 3 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, art: { ...draft.art, items: [...draft.art.items, { packaging: "cushion", shade: "#DAB085", brandColor: "#B98A6A", brandName: "Pualam" }] } })}>
                      <Plus /> Tambah produk
                    </Button>
                  ) : null}
                </div>
              ) : photosEnabled ? (
                <div className="flex items-center gap-3">
                  {draft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.imageUrl} alt="Gambar banner" className="h-16 w-28 rounded-lg border border-garis object-cover" />
                  ) : null}
                  <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="animate-spin" /> : <Camera />} {draft.imageUrl ? "Ganti gambar" : "Unggah gambar"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      const r = await uploadAdminPhoto(f, "banner");
                      setUploading(false);
                      if (r.ok) setDraft((d) => (d ? { ...d, imageUrl: r.url } : d));
                      else setError(r.message);
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-abu-hangat">Unggah gambar belum tersedia di server ini. Pakai komposisi ProductArt, ya.</p>
              )}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="size-4 accent-aksen" /> Aktif
            </label>
            {error ? (
              <p className="text-sm text-bahaya" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Simpan banner
              </Button>
            </div>
          </form>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Hapus banner "${removing?.title ?? ""}"?`}
        description="Banner langsung hilang dari beranda. Kalau hanya ingin menyembunyikan sementara, nonaktifkan saja."
        confirmLabel="Hapus banner"
        danger
        onConfirm={async () => {
          if (!removing) return null;
          const r = await deleteBannerAction(removing.id);
          if (!r.ok) return r.message;
          setNotice({ ok: true, text: "Banner dihapus." });
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}

export function PromoBarEditor({ messages }: { messages: string[] }) {
  const router = useRouter();
  const [list, setList] = useState<string[]>(messages.length ? messages : [""]);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, run] = useTransition();
  return (
    <section className="rounded-xl border border-garis bg-putih p-4" aria-label="Pesan PromoBar">
      <h2 className="text-sm font-semibold">Pesan PromoBar</h2>
      <p className="mb-3 text-xs text-abu-hangat">Baris tipis di atas header toko. Pesan bergantian setiap beberapa detik. Maksimal 6 pesan, 80 karakter per pesan.</p>
      <div className="space-y-2">
        {list.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={m} maxLength={80} onChange={(e) => setList(list.map((x, k) => (k === i ? e.target.value : x)))} className={fieldClass} aria-label={`Pesan PromoBar ${i + 1}`} />
            <span className="w-12 shrink-0 text-right text-xs text-abu-hangat tabular-nums">{m.length}/80</span>
            <button type="button" onClick={() => setList(list.filter((_, k) => k !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-label={`Hapus pesan ${i + 1}`}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" disabled={list.length >= 6} onClick={() => setList([...list, ""])}>
          <Plus /> Tambah pesan
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await savePromoBarAction(list);
              setNotice(r.ok ? { ok: true, text: "PromoBar tersimpan." } : { ok: false, text: r.message });
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null} Simpan PromoBar
        </Button>
      </div>
      <div className="mt-3">
        <NoticeLine notice={notice} />
      </div>
    </section>
  );
}
