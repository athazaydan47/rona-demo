"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Info, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OpeningHours } from "@/db/schema/catalog";
import { saveLocationAction, saveSettingsAction } from "@/lib/admin/catalog-actions";
import { formatDateWib, formatRupiah, wibDate } from "@/lib/format";
import { PAYMENT_METHOD_KEYS, SHIPPING_COURIERS, ZONES, type PaymentMethodKey, type StoreSettings } from "@/lib/settings";
import { couriers as COURIERS, zoneLabels, type CourierCode } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { fieldClass } from "./ui";

const PAYMENT_LABELS: Record<PaymentMethodKey, string> = { qris: "QRIS", va_bca: "VA BCA", va_bni: "VA BNI", va_bri: "VA BRI", va_mandiri: "VA Mandiri", bayar_di_toko: "Bayar di toko (ambil)" };
const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "sen", label: "Senin" },
  { key: "sel", label: "Selasa" },
  { key: "rab", label: "Rabu" },
  { key: "kam", label: "Kamis" },
  { key: "jum", label: "Jumat" },
  { key: "sab", label: "Sabtu" },
  { key: "min", label: "Minggu" },
];
const courierLabel = (code: string) => {
  const c = COURIERS.find((x) => x.code === code);
  return c ? `${c.name} ${c.service}`.trim() : code;
};
// "15.00" di pengaturan, "15:00" di input jam.
const toTime = (v: string) => v.replace(".", ":");
const fromTime = (v: string) => v.replace(":", ".");
const digits = (v: string) => v.replace(/\D/g, "");

type Notice = { ok: boolean; text: string } | null;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-garis bg-putih p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-abu-hangat">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-abu-hangat">{hint}</span> : null}
    </label>
  );
}

export function SettingsForm({ initial, demoMode, products = [] }: { initial: StoreSettings; demoMode: boolean; products?: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [s, setS] = useState<StoreSettings>(initial);
  // Nilai terakhir yang tersimpan, untuk menandai ada perubahan yang belum disimpan.
  const [base, setBase] = useState<StoreSettings>(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, run] = useTransition();
  const dirty = JSON.stringify(s) !== JSON.stringify(base);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setRate = (code: (typeof SHIPPING_COURIERS)[number], zone: (typeof ZONES)[number], v: string) => setS({ ...s, couriers: { ...s.couriers, rates: { ...s.couriers.rates, [code]: { ...s.couriers.rates[code], [zone]: v === "" ? null : Number(v) } } } });

  const save = () =>
    run(async () => {
      const r = await saveSettingsAction(s);
      if (!r.ok) return setNotice({ ok: false, text: r.message });
      setBase(s);
      setNotice({ ok: true, text: "changed" in r && r.changed === 0 ? "Tidak ada perubahan." : "Pengaturan tersimpan. Toko langsung memakai nilai baru." });
      router.refresh();
    });

  return (
    <div className="space-y-4 pb-20">
      {demoMode ? (
        <p className="flex items-start gap-2 rounded-lg border border-garis bg-blush/40 px-3 py-2 text-sm text-rona-gelap" data-testid="catatan-demo-pengaturan">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Ini toko demo. Reset harian mengembalikan semua pengaturan, cabang, dan promo ke nilai bawaan.
        </p>
      ) : null}

      <Section title="Profil toko">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama toko">
            <input value={s.profile.name} onChange={(e) => setS({ ...s, profile: { ...s.profile, name: e.target.value } })} className={fieldClass} />
          </Field>
          <Field label="Tagline">
            <input value={s.profile.tagline} onChange={(e) => setS({ ...s, profile: { ...s.profile, tagline: e.target.value } })} className={fieldClass} />
          </Field>
          <Field label="WhatsApp" hint="Diawali 62, tanpa spasi.">
            <input inputMode="numeric" value={s.profile.whatsapp} onChange={(e) => setS({ ...s, profile: { ...s.profile, whatsapp: digits(e.target.value) } })} className={fieldClass} />
          </Field>
          <Field label="Email">
            <input type="email" value={s.profile.email} onChange={(e) => setS({ ...s, profile: { ...s.profile, email: e.target.value } })} className={fieldClass} />
          </Field>
          <Field label="Alamat kantor" className="sm:col-span-2">
            <input value={s.profile.address} onChange={(e) => setS({ ...s, profile: { ...s.profile, address: e.target.value } })} className={fieldClass} />
          </Field>
        </div>
      </Section>

      <Section title="Jam operasional" description="Dipakai untuk janji kirim hari ini, siap diambil, dan ketersediaan kurir instan.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cut-off kirim hari ini">
            <input type="time" step={900} value={toTime(s.cutoff.ship)} onChange={(e) => setS({ ...s, cutoff: { ...s.cutoff, ship: fromTime(e.target.value) } })} className={fieldClass} aria-label="Cut-off kirim" />
          </Field>
          <Field label="Cut-off siap diambil hari ini">
            <input type="time" step={900} value={toTime(s.cutoff.pickup)} onChange={(e) => setS({ ...s, cutoff: { ...s.cutoff, pickup: fromTime(e.target.value) } })} className={fieldClass} aria-label="Cut-off ambil" />
          </Field>
          <Field label="Kurir instan buka (jam)">
            <input inputMode="numeric" value={s.instant.open} onChange={(e) => setS({ ...s, instant: { ...s.instant, open: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Jam buka kurir instan" />
          </Field>
          <Field label="Kurir instan tutup (jam)">
            <input inputMode="numeric" value={s.instant.close} onChange={(e) => setS({ ...s, instant: { ...s.instant, close: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Jam tutup kurir instan" />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.cutoff.sundayOff} onChange={(e) => setS({ ...s, cutoff: { ...s.cutoff, sundayOff: e.target.checked } })} className="size-4 accent-rona" /> Gudang online libur hari Minggu
        </label>
      </Section>

      <Section title="Kurir dan tarif" description="Tarif per kg per zona. Kosongkan bila kurir tidak melayani zona itu.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[...SHIPPING_COURIERS, "ambil_di_toko" as const].map((code) => (
            <button key={code} type="button" onClick={() => setS({ ...s, couriers: { ...s.couriers, active: toggle<CourierCode>(s.couriers.active, code) } })} aria-pressed={s.couriers.active.includes(code)} className={cn("h-9 rounded-pill border px-3 text-sm", s.couriers.active.includes(code) ? "border-kopi bg-kopi text-putih" : "border-garis text-abu-hangat")}>
              {code === "ambil_di_toko" ? "Ambil di Toko" : courierLabel(code)}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-abu-hangat">
              <tr>
                <th className="py-1.5 pr-2 font-semibold">Kurir</th>
                {ZONES.map((z) => (
                  <th key={z} className="px-1 py-1.5 font-semibold">
                    {zoneLabels[z]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHIPPING_COURIERS.map((code) => (
                <tr key={code} className={cn(!s.couriers.active.includes(code) && "opacity-50")}>
                  <td className="py-1 pr-2 font-medium whitespace-nowrap">{courierLabel(code)}</td>
                  {ZONES.map((z) => (
                    <td key={z} className="px-1 py-1">
                      <input inputMode="numeric" value={s.couriers.rates[code][z] ?? ""} onChange={(e) => setRate(code, z, digits(e.target.value))} placeholder="tidak melayani" className={cn(fieldClass, "h-9 tabular-nums")} aria-label={`Tarif ${courierLabel(code)} ${zoneLabels[z]}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Metode bayar aktif">
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHOD_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => setS({ ...s, payments: toggle(s.payments, k) })} aria-pressed={s.payments.includes(k)} className={cn("h-9 rounded-pill border px-3 text-sm", s.payments.includes(k) ? "border-kopi bg-kopi text-putih" : "border-garis text-abu-hangat")}>
              {PAYMENT_LABELS[k]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Stok dan gratis ongkir">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ambang stok menipis" hint="Dashboard dan daftar stok menandai varian di bawah angka ini.">
            <input inputMode="numeric" value={s.lowStock} onChange={(e) => setS({ ...s, lowStock: Number(digits(e.target.value) || 0) })} className={fieldClass} aria-label="Ambang stok menipis" />
          </Field>
          <Field label="Gratis ongkir mulai belanja" hint={`Sekarang ${formatRupiah(s.freeShipping.threshold)}.`}>
            <input inputMode="numeric" value={s.freeShipping.threshold} onChange={(e) => setS({ ...s, freeShipping: { ...s.freeShipping, threshold: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Batas gratis ongkir" />
          </Field>
          <Field label="Potongan ongkir maksimal" hint={`Sekarang ${formatRupiah(s.freeShipping.cap)}.`}>
            <input inputMode="numeric" value={s.freeShipping.cap} onChange={(e) => setS({ ...s, freeShipping: { ...s.freeShipping, cap: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Nilai gratis ongkir" />
          </Field>
        </div>
      </Section>

      <Section title="Saran AI" description="Batas yang dipakai saran transfer stok dan saran flash sale. Saran tidak pernah mengubah data sendiri.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cabang akan habis bila stok cukup kurang dari (hari)">
            <input inputMode="numeric" value={s.saran.kurangHari} onChange={(e) => setS({ ...s, saran: { ...s.saran, kurangHari: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Batas hari kurang" />
          </Field>
          <Field label="Lokasi asal berlebih bila stok cukup lebih dari (hari)">
            <input inputMode="numeric" value={s.saran.lebihHari} onChange={(e) => setS({ ...s, saran: { ...s.saran, lebihHari: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Batas hari lebih" />
          </Field>
          <Field label="Diskon flash sale minimal (persen)">
            <input inputMode="numeric" value={s.saran.flashDiskonMin} onChange={(e) => setS({ ...s, saran: { ...s.saran, flashDiskonMin: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Diskon flash minimal" />
          </Field>
          <Field label="Diskon flash sale maksimal (persen)">
            <input inputMode="numeric" value={s.saran.flashDiskonMaks} onChange={(e) => setS({ ...s, saran: { ...s.saran, flashDiskonMaks: Number(digits(e.target.value) || 0) } })} className={fieldClass} aria-label="Diskon flash maksimal" />
          </Field>
        </div>
      </Section>

      <Section title="Panduan gaya bahasa" description="Acuan semua tulisan AI: deskripsi produk, SEO, balasan ulasan, dan Kabar Harian. Ubah sesuai suara tokomu.">
        <div className="grid gap-3">
          <Field label="Nada">
            <textarea rows={2} value={s.gaya.nada} onChange={(e) => setS({ ...s, gaya: { ...s.gaya, nada: e.target.value.slice(0, 400) } })} className={cn(fieldClass, "h-auto py-2")} aria-label="Nada tulisan" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sapaan">
              <input value={s.gaya.sapaan} onChange={(e) => setS({ ...s, gaya: { ...s.gaya, sapaan: e.target.value.slice(0, 20) } })} className={fieldClass} aria-label="Sapaan" />
            </Field>
            <Field label="Kata yang dipakai" hint="Pisahkan dengan koma.">
              <input value={s.gaya.kataDipakai.join(", ")} onChange={(e) => setS({ ...s, gaya: { ...s.gaya, kataDipakai: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30) } })} className={fieldClass} aria-label="Kata yang dipakai" />
            </Field>
            <Field label="Kata yang dihindari" hint="Pisahkan dengan koma.">
              <input value={s.gaya.kataDihindari.join(", ")} onChange={(e) => setS({ ...s, gaya: { ...s.gaya, kataDihindari: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30) } })} className={fieldClass} aria-label="Kata yang dihindari" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["ringkas", "Deskripsi singkat"],
                ["manfaat", "Tab Manfaat"],
                ["kandungan", "Tab Kandungan"],
                ["caraPakai", "Tab Cara Pakai"],
                ["metaJudul", "Judul meta"],
                ["metaDeskripsi", "Deskripsi meta"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={`${label} (karakter)`}>
                <input inputMode="numeric" value={s.gaya.panjang[k]} onChange={(e) => setS({ ...s, gaya: { ...s.gaya, panjang: { ...s.gaya.panjang, [k]: Number(digits(e.target.value) || 0) } } })} className={fieldClass} aria-label={`Panjang ${label}`} />
              </Field>
            ))}
          </div>
          <Field label="Contoh deskripsi terbaik (2 sampai 3 produk)" hint="AI meniru gaya dan susunan deskripsi produk ini.">
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <select key={i} value={s.gaya.contohProduk[i] ?? ""} onChange={(e) => {
                  const next = [...s.gaya.contohProduk];
                  next[i] = e.target.value;
                  setS({ ...s, gaya: { ...s.gaya, contohProduk: next.filter(Boolean).slice(0, 3) } });
                }} className={fieldClass} aria-label={`Contoh produk ${i + 1}`}>
                  <option value="">Tidak dipilih</option>
                  {products.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      {notice ? (
        <p className={cn("rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-garis bg-putih/95 px-4 py-2.5 backdrop-blur md:sticky md:bottom-0 md:rounded-xl md:border" data-bilah-bawah>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-abu-hangat">{dirty ? "Ada perubahan yang belum disimpan." : "Semua tersimpan."}</p>
          <div className="flex gap-2">
            {dirty ? (
              <Button variant="ghost" onClick={() => setS(base)}>
                Batalkan
              </Button>
            ) : null}
            <Button onClick={save} disabled={pending || !dirty}>
              {pending ? <Loader2 className="animate-spin" /> : null} Simpan pengaturan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type LocationView = { id: number; slug: string; name: string; type: string; address: string; district: string; city: string; phone: string; lat: number | null; lng: number | null; openingHours: OpeningHours | null; closedDates: string[]; canPickup: boolean };

const EMPTY_HOURS: OpeningHours = { sen: null, sel: null, rab: null, kam: null, jum: null, sab: null, min: null };

function LocationCard({ loc }: { loc: LocationView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ address: loc.address, district: loc.district, city: loc.city, phone: loc.phone, lat: loc.lat == null ? "" : String(loc.lat), lng: loc.lng == null ? "" : String(loc.lng), openingHours: loc.openingHours ?? EMPTY_HOURS, closedDates: loc.closedDates, canPickup: loc.canPickup });
  const [holiday, setHoliday] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, run] = useTransition();
  const setDay = (k: keyof OpeningHours, v: { open: string; close: string } | null) => setF({ ...f, openingHours: { ...f.openingHours, [k]: v } });
  const save = () =>
    run(async () => {
      const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
      const r = await saveLocationAction(loc.id, { address: f.address, district: f.district, city: f.city, phone: f.phone, lat: num(f.lat), lng: num(f.lng), openingHours: f.openingHours, closedDates: f.closedDates, canPickup: f.canPickup });
      setNotice(r.ok ? { ok: true, text: "Cabang tersimpan." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });
  const dateLabel = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return formatDateWib(wibDate(y, m, day, 12));
  };
  return (
    <li className="rounded-xl border border-garis bg-putih" data-cabang={loc.slug}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{loc.name}</span>
          <span className="block truncate text-xs text-abu-hangat">
            {loc.type === "gudang" ? "Gudang online" : f.canPickup ? "Toko, bisa ambil" : "Toko, ambil nonaktif"} · {f.address}
            {f.closedDates.length ? ` · ${f.closedDates.length} hari libur` : ""}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-garis p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Alamat" className="sm:col-span-2">
              <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={fieldClass} aria-label={`Alamat ${loc.name}`} />
            </Field>
            <Field label="Kecamatan">
              <input value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Telepon">
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Lintang (lat)">
              <input inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Bujur (lng)">
              <input inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          {loc.type === "toko" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.canPickup} onChange={(e) => setF({ ...f, canPickup: e.target.checked })} className="size-4 accent-rona" /> Bisa Ambil di Toko
            </label>
          ) : null}
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Jam buka</legend>
            <div className="space-y-1.5">
              {DAYS.map((d) => {
                const h = f.openingHours[d.key];
                return (
                  <div key={d.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex w-28 items-center gap-2">
                      <input type="checkbox" checked={Boolean(h)} onChange={(e) => setDay(d.key, e.target.checked ? { open: "09.00", close: "21.00" } : null)} className="size-4 accent-rona" />
                      {d.label}
                    </label>
                    {h ? (
                      <>
                        <input type="time" value={toTime(h.open)} onChange={(e) => setDay(d.key, { ...h, open: fromTime(e.target.value) })} className={cn(fieldClass, "h-9 w-28")} aria-label={`Buka ${d.label}`} />
                        <span className="text-abu-hangat">sampai</span>
                        <input type="time" value={toTime(h.close)} onChange={(e) => setDay(d.key, { ...h, close: fromTime(e.target.value) })} className={cn(fieldClass, "h-9 w-28")} aria-label={`Tutup ${d.label}`} />
                      </>
                    ) : (
                      <span className="text-abu-hangat">Tutup</span>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Hari libur</legend>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} className={cn(fieldClass, "h-9 w-44")} aria-label={`Tanggal libur ${loc.name}`} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!holiday}
                onClick={() => {
                  setF({ ...f, closedDates: [...new Set([...f.closedDates, holiday])].sort() });
                  setHoliday("");
                }}
              >
                <Plus /> Tambah libur
              </Button>
            </div>
            {f.closedDates.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {f.closedDates.map((d) => (
                  <li key={d} className="inline-flex items-center gap-1 rounded-pill bg-porselen px-2.5 py-1 text-xs">
                    {dateLabel(d)}
                    <button type="button" onClick={() => setF({ ...f, closedDates: f.closedDates.filter((x) => x !== d) })} aria-label={`Hapus libur ${dateLabel(d)}`}>
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-abu-hangat">Belum ada hari libur khusus. Pada hari libur, cabang dianggap tutup untuk stok dan Ambil di Toko.</p>
            )}
          </fieldset>
          {notice ? (
            <p className={cn("rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
              {notice.text}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Simpan cabang
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function LocationsEditor({ locations }: { locations: LocationView[] }) {
  return (
    <ul className="space-y-2" aria-label="Cabang">
      {locations.map((l) => (
        <LocationCard key={l.id} loc={l} />
      ))}
    </ul>
  );
}
