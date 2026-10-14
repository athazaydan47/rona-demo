"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createFlashSlotAction, removeFlashItemAction, saveFlashItemAction, searchVariantsForPromoAction, setFlashSlotActiveAction } from "@/lib/admin/catalog-actions";
import { checkFlashItem, FLASH_PRESETS } from "@/lib/admin/promo-rules";
import type { PromoVariant } from "@/lib/admin/promo";
import { formatDateWib, formatRupiah, formatTimeWib, fromWibInput, pad2, toWibInput, toWibParts, weekdayNameId } from "@/lib/format";
import { effectivePrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { fieldClass } from "./ui";

export type FlashItemView = { id: number; variantId: number; flashPrice: number; quota: number; sold: number; maxPerCustomer: number; productName: string; shadeName: string; sku: string; hex: string; normalPrice: number; salePrice: number };
export type FlashSlotView = { id: number; name: string; source: string; isActive: boolean; startsAt: string; endsAt: string; items: FlashItemView[] };

const DAY = 86_400_000;
const time = (iso: string) => formatTimeWib(new Date(iso)).replace(" WIB", "");

export function PromoVariantPicker({ onPick }: { onPick: (v: PromoVariant) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PromoVariant[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      if (q.trim().length < 2) return setHits([]);
      const r = await searchVariantsForPromoAction(q).catch(() => []);
      if (my === seq.current) setHits(r);
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-abu-hangat" aria-hidden />
      <input value={q} onChange={(e) => (setQ(e.target.value), setOpen(true))} onFocus={() => setOpen(true)} placeholder="Nama produk, shade, atau SKU" aria-label="Cari varian promo" className={cn(fieldClass, "pl-9")} />
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
                <span className="text-xs text-abu-hangat tabular-nums">{formatRupiah(h.salePrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function slotState(s: FlashSlotView, now: number) {
  if (!s.isActive) return { label: "Nonaktif", cls: "bg-garis/60 text-abu-hangat" };
  if (new Date(s.endsAt).getTime() <= now) return { label: "Selesai", cls: "bg-garis/60 text-abu-hangat" };
  if (new Date(s.startsAt).getTime() <= now) return { label: "Berjalan", cls: "bg-[#E5F2EA] text-sukses" };
  return { label: "Terjadwal", cls: "bg-blush text-rona-gelap" };
}

type Draft = { variant: { variantId: number; productName: string; shadeName: string; hex: string; normalPrice: number; effective: number; onlineAvailable: number | null; sold?: number }; flashPrice: string; quota: string; maxPerCustomer: string };

// Draf dari saran flash sale (Fase 7B): varian, harga flash, dan kuota usulan. Dibawa sampai staf memilih slot dan
// menyimpan item; tidak ada yang tersimpan otomatis.
export type FlashSuggestionDraft = { variant: PromoVariant; flashPrice: number; quota: number; param: string };

export function FlashManager({ weekStart, slots, nowIso, defaultDate, initialSlot, justCreated, suggestion = null }: { weekStart: string; slots: FlashSlotView[]; nowIso: string; defaultDate: string; initialSlot?: number | null; justCreated?: boolean; suggestion?: FlashSuggestionDraft | null }) {
  const router = useRouter();
  const now = new Date(nowIso).getTime();
  const start = new Date(weekStart);
  const [selected, setSelected] = useState<number | null>(() => (initialSlot && slots.some((s) => s.id === initialSlot) ? initialSlot : (slots.find((s) => s.source === "admin" && new Date(s.endsAt).getTime() > now)?.id ?? null)));
  const slot = slots.find((s) => s.id === selected) ?? null;
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(() => (initialSlot && justCreated ? { ok: true, text: "Slot dibuat. Tambahkan produknya di bawah." } : null));
  const [pending, run] = useTransition();
  const [form, setForm] = useState<{ name: string; date: string; preset: string; start: string; end: string }>({ name: FLASH_PRESETS[0].name, date: defaultDate, preset: "0", start: "10:00", end: "12:00" });
  const [carry, setCarry] = useState<FlashSuggestionDraft | null>(suggestion);
  const toDraft = (c: FlashSuggestionDraft, slot: FlashSlotView | undefined): Draft | null =>
    slot && new Date(slot.endsAt).getTime() > now
      ? {
          variant: { variantId: c.variant.variantId, productName: c.variant.productName, shadeName: c.variant.shadeName, hex: c.variant.hex, normalPrice: c.variant.normalPrice, effective: effectivePrice({ normalPrice: c.variant.normalPrice, salePrice: c.variant.salePrice, promoPrice: c.variant.promoPrice, promoStartsAt: c.variant.promoStartsAt, promoEndsAt: c.variant.promoEndsAt }, new Date(slot.startsAt)).price, onlineAvailable: c.variant.onlineAvailable },
          flashPrice: String(c.flashPrice),
          quota: String(c.quota),
          maxPerCustomer: "2",
        }
      : null;
  const [draft, setDraft] = useState<Draft | null>(() => (suggestion ? toDraft(suggestion, slots.find((s) => s.id === selected)) : null));
  const [confirm, setConfirm] = useState<{ text: string; go: () => Promise<string | null> } | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  const dayKey = (d: Date) => toWibInput(d).slice(0, 10);
  const byDay = new Map<string, FlashSlotView[]>();
  for (const s of slots) {
    const k = dayKey(new Date(s.startsAt));
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const weekHref = (offset: number) => `/admin/promo?tab=flash&minggu=${dayKey(new Date(start.getTime() + offset * 7 * DAY))}`;

  const createSlot = () =>
    run(async () => {
      const p = form.preset === "custom" ? null : FLASH_PRESETS[Number(form.preset)];
      const s = fromWibInput(`${form.date}T${p ? p.start.replace(".", ":") : form.start}`);
      const e = fromWibInput(`${form.date}T${p ? p.end.replace(".", ":") : form.end}`);
      if (!s || !e) return setNotice({ ok: false, text: "Isi tanggal dan jam slot." });
      const r = await createFlashSlotAction({ name: form.name, startsAt: s.toISOString(), endsAt: e.toISOString() });
      if (!r.ok) return setNotice({ ok: false, text: r.message });
      // Buka minggu yang memuat slot baru dan langsung pilih slotnya.
      router.push(`/admin/promo?tab=flash&minggu=${form.date}&slot=${r.id}&dibuat=1${carry ? `&draf=${carry.param}` : ""}`);
    });

  const withConfirm = async (call: (confirmRunning: boolean) => Promise<{ ok: boolean; message?: string; needsConfirm?: boolean; warnings?: string[] }>, okText: string) => {
    const r = await call(false);
    if (!r.ok && r.needsConfirm) {
      setConfirm({
        text: r.message ?? "Slot ini sedang berjalan.",
        go: async () => {
          const again = await call(true);
          if (!again.ok) return again.message ?? "Gagal menyimpan.";
          setNotice({ ok: true, text: okText + (again.warnings?.length ? ` ${again.warnings.join(" ")}` : "") });
          setDraft(null);
          router.refresh();
          return null;
        },
      });
      return;
    }
    if (!r.ok) return setNotice({ ok: false, text: r.message ?? "Gagal menyimpan." });
    setNotice({ ok: true, text: okText + (r.warnings?.length ? ` ${r.warnings.join(" ")}` : "") });
    setDraft(null);
    setCarry(null);
    router.refresh();
  };

  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const check = draft ? checkFlashItem({ flashPrice: n(draft.flashPrice), quota: n(draft.quota), maxPerCustomer: n(draft.maxPerCustomer), effective: draft.variant.effective, normalPrice: draft.variant.normalPrice, onlineAvailable: draft.variant.onlineAvailable ?? Number.MAX_SAFE_INTEGER, sold: draft.variant.sold }) : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-garis bg-putih p-4" aria-label="Buat slot flash sale">
        <h2 className="mb-3 text-sm font-semibold">Buat slot</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.6fr_auto] lg:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nama slot</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} aria-label="Nama slot" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tanggal</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fieldClass} aria-label="Tanggal slot" />
          </label>
          <fieldset className="text-sm">
            <legend className="mb-1 font-medium">Jam</legend>
            <div className="flex flex-wrap gap-1.5">
              {FLASH_PRESETS.map((p, i) => (
                <button key={p.label} type="button" onClick={() => setForm({ ...form, preset: String(i), name: form.name === FLASH_PRESETS[Number(form.preset)]?.name || !form.name ? p.name : form.name })} className={cn("h-10 rounded-lg border px-3", form.preset === String(i) ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih")} aria-pressed={form.preset === String(i)}>
                  {p.start} sampai {p.end}
                </button>
              ))}
              <button type="button" onClick={() => setForm({ ...form, preset: "custom" })} className={cn("h-10 rounded-lg border px-3", form.preset === "custom" ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih")} aria-pressed={form.preset === "custom"}>
                Atur sendiri
              </button>
            </div>
            {form.preset === "custom" ? (
              <div className="mt-2 flex items-center gap-2">
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={cn(fieldClass, "w-32")} aria-label="Jam mulai" />
                <span className="text-abu-hangat">sampai</span>
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={cn(fieldClass, "w-32")} aria-label="Jam selesai" />
              </div>
            ) : null}
          </fieldset>
          <Button onClick={createSlot} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} Buat slot
          </Button>
        </div>
        <p className="mt-2 text-xs text-abu-hangat">Slot buatan admin selalu menang: slot otomatis yang bertabrakan dinonaktifkan dan tidak dibuat ulang.</p>
      </section>

      {carry ? (
        <p className="mb-3 rounded-xl bg-[#FBEEDC] px-4 py-2.5 text-sm text-[#8A5512]" role="status" data-testid="draf-flash">
          Draf dari saran flash sale: {carry.variant.productName} · {carry.variant.shadeName}, harga flash {formatRupiah(carry.flashPrice)}, kuota {carry.quota}. Pilih atau buat slot, periksa isiannya, lalu simpan sendiri.{" "}
          <button type="button" className="font-semibold underline" onClick={() => (setCarry(null), setDraft(null))}>
            Batalkan draf
          </button>
        </p>
      ) : null}
      {notice ? (
        <p className={cn("rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      ) : null}

      <section className="rounded-xl border border-garis bg-putih" aria-label="Kalender flash sale">
        <div className="flex items-center justify-between gap-2 border-b border-garis px-3 py-2">
          <Link href={weekHref(-1)} className="grid size-9 place-items-center rounded-lg hover:bg-porselen" aria-label="Minggu sebelumnya">
            <ChevronLeft className="size-4" />
          </Link>
          <p className="text-sm font-semibold">
            {formatDateWib(days[0])} sampai {formatDateWib(days[6])}
          </p>
          <Link href={weekHref(1)} className="grid size-9 place-items-center rounded-lg hover:bg-porselen" aria-label="Minggu berikutnya">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="grid divide-y divide-garis md:grid-cols-7 md:divide-x md:divide-y-0" data-testid="kalender-flash">
          {days.map((d) => {
            const p = toWibParts(d);
            const list = byDay.get(dayKey(d)) ?? [];
            const today = dayKey(d) === dayKey(new Date(now));
            return (
              <div key={dayKey(d)} className={cn("flex gap-3 p-2 md:block md:min-h-44", today && "bg-blush/30")}>
                <p className={cn("w-16 shrink-0 text-xs md:mb-2 md:w-auto", today ? "font-semibold text-rona" : "text-abu-hangat")}>
                  {weekdayNameId(p.weekday)} <span className="tabular-nums">{p.day}/{pad2(p.month)}</span>
                </p>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 md:block md:space-y-1.5">
                  {list.length ? (
                    list.map((s) => {
                      const st = slotState(s, now);
                      return (
                        <button key={s.id} type="button" onClick={() => (setSelected(s.id), setDraft(carry ? toDraft(carry, s) : null))} className={cn("block rounded-lg border px-2 py-1.5 text-left text-xs md:w-full", selected === s.id ? "border-rona ring-2 ring-rona/25" : "border-garis", !s.isActive && "opacity-60")} aria-pressed={selected === s.id} data-slot={s.id}>
                          <span className="block font-semibold tabular-nums">
                            {time(s.startsAt)} sampai {time(s.endsAt)}
                          </span>
                          <span className="block truncate">{s.name}</span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            <span className={cn("rounded px-1", s.source === "admin" ? "bg-kopi text-putih" : "bg-porselen text-abu-hangat")}>{s.source === "admin" ? "Admin" : "Otomatis"}</span>
                            <span className={cn("rounded px-1", st.cls)}>{st.label}</span>
                            <span className="text-abu-hangat">{s.items.length} item</span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-abu-hangat/70">Tidak ada slot</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {slot ? (
        <section className="rounded-xl border border-garis bg-putih" aria-label={`Item slot ${slot.name}`} data-testid="detail-slot">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-rona" aria-hidden /> {slot.name}
              </h2>
              <p className="text-xs text-abu-hangat">
                {formatDateWib(new Date(slot.startsAt))}, {time(slot.startsAt)} sampai {time(slot.endsAt)} WIB · {slot.source === "admin" ? "dibuat admin" : "dibuat otomatis"} · {slotState(slot, now).label}
              </p>
            </div>
            {new Date(slot.endsAt).getTime() > now ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => withConfirm((c) => setFlashSlotActiveAction(slot.id, !slot.isActive, c), slot.isActive ? "Slot dinonaktifkan." : "Slot diaktifkan."))}>
                {slot.isActive ? "Nonaktifkan slot" : "Aktifkan slot"}
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-porselen/60 text-left text-xs text-abu-hangat">
                <tr>
                  <th className="px-3 py-2 font-semibold">Produk</th>
                  <th className="px-3 py-2 font-semibold">Harga</th>
                  <th className="px-3 py-2 font-semibold">Kuota</th>
                  <th className="px-3 py-2 font-semibold">Maks/pembeli</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-garis">
                {slot.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="size-4 shrink-0 rounded-full border border-garis" style={{ background: it.hex }} aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{it.productName}</span>
                          <span className="block text-xs text-abu-hangat">{it.shadeName}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      <span className="block font-semibold text-rona">{formatRupiah(it.flashPrice)}</span>
                      <span className="text-xs text-abu-hangat line-through">{formatRupiah(it.normalPrice)}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {it.sold}/{it.quota} terjual
                    </td>
                    <td className="px-3 py-2 tabular-nums">{it.maxPerCustomer}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setDraft({ variant: { variantId: it.variantId, productName: it.productName, shadeName: it.shadeName, hex: it.hex, normalPrice: it.normalPrice, effective: it.salePrice, onlineAvailable: null, sold: it.sold }, flashPrice: String(it.flashPrice), quota: String(it.quota), maxPerCustomer: String(it.maxPerCustomer) })} className="inline-grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-label={`Ubah ${it.productName} ${it.shadeName}`}>
                        <Pencil className="size-4" />
                      </button>
                      {it.sold === 0 ? (
                        <button type="button" onClick={() => run(() => withConfirm((c) => removeFlashItemAction(it.id, c), "Item dihapus dari slot."))} className="inline-grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus ${it.productName} ${it.shadeName} dari slot`}>
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!slot.items.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-abu-hangat">
                      Belum ada produk di slot ini.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {new Date(slot.endsAt).getTime() > now ? (
            <div className="space-y-3 border-t border-garis p-4">
              <PromoVariantPicker
                onPick={(v) =>
                  setDraft({
                    variant: { variantId: v.variantId, productName: v.productName, shadeName: v.shadeName, hex: v.hex, normalPrice: v.normalPrice, effective: effectivePrice({ normalPrice: v.normalPrice, salePrice: v.salePrice, promoPrice: v.promoPrice, promoStartsAt: v.promoStartsAt, promoEndsAt: v.promoEndsAt }, new Date(slot.startsAt)).price, onlineAvailable: v.onlineAvailable },
                    flashPrice: "",
                    quota: String(Math.min(20, Math.max(1, v.onlineAvailable))),
                    maxPerCustomer: "2",
                  })
                }
              />
              {draft ? (
                <div className="rounded-lg border border-garis bg-porselen/40 p-3" data-testid="form-item-flash">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="size-4 rounded-full border border-garis" style={{ background: draft.variant.hex }} aria-hidden />
                    {draft.variant.productName} · {draft.variant.shadeName}
                    <span className="text-xs font-normal text-abu-hangat">
                      harga efektif saat slot mulai {formatRupiah(draft.variant.effective)}
                      {draft.variant.onlineAvailable != null ? `, stok online ${draft.variant.onlineAvailable}` : ""}
                    </span>
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Harga flash</span>
                      <input inputMode="numeric" value={draft.flashPrice} onChange={(e) => setDraft({ ...draft, flashPrice: e.target.value.replace(/\D/g, "") })} className={fieldClass} aria-label="Harga flash" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Kuota</span>
                      <input inputMode="numeric" value={draft.quota} onChange={(e) => setDraft({ ...draft, quota: e.target.value.replace(/\D/g, "") })} className={fieldClass} aria-label="Kuota flash" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Maks per pembeli</span>
                      <input inputMode="numeric" value={draft.maxPerCustomer} onChange={(e) => setDraft({ ...draft, maxPerCustomer: e.target.value.replace(/\D/g, "") })} className={fieldClass} aria-label="Maksimal per pembeli" />
                    </label>
                  </div>
                  {check && Number(draft.flashPrice) > 0 ? (
                    <p className="mt-3 flex flex-wrap items-baseline gap-2 text-sm" data-testid="pratinjau-flash">
                      <span className="text-abu-hangat line-through tabular-nums">{formatRupiah(draft.variant.normalPrice)}</span>
                      <span className="text-lg font-semibold text-rona tabular-nums">{formatRupiah(Number(draft.flashPrice))}</span>
                      {check.percent > 0 ? <span className="rounded bg-rona px-1.5 text-xs font-semibold text-putih">-{check.percent}%</span> : null}
                    </p>
                  ) : null}
                  {check?.errors.length && draft.flashPrice ? <p className="mt-2 text-sm text-bahaya">{check.errors[0]}</p> : null}
                  {check?.warnings.length ? <p className="mt-2 text-sm text-[#8A5512]">{check.warnings[0]}</p> : null}
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setDraft(null)}>
                      Batal
                    </Button>
                    <Button disabled={pending || Boolean(check?.errors.length)} onClick={() => run(() => withConfirm((c) => saveFlashItemAction({ slotId: slot.id, variantId: draft.variant.variantId, flashPrice: Number(draft.flashPrice), quota: Number(draft.quota), maxPerCustomer: Number(draft.maxPerCustomer), confirmRunning: c }), "Item slot tersimpan."))}>
                      {pending ? <Loader2 className="animate-spin" /> : null} Simpan item
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-garis p-6 text-center text-sm text-abu-hangat">Pilih slot di kalender untuk mengatur produknya.</p>
      )}

      <ConfirmDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)} title="Slot sedang berjalan" description={`${confirm?.text ?? ""} Perubahan ini dicatat di log.`} confirmLabel="Ya, ubah sekarang" danger onConfirm={async () => (confirm ? confirm.go() : null)} />
    </div>
  );
}
