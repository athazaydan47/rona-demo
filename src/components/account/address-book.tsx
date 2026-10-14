"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Home, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { deleteAddressAction, saveAddressAction, setPrimaryAddressAction } from "@/lib/account/actions";
import { districts, hasDistrictData, provinces, regencies } from "@/lib/regions";
import { cn } from "@/lib/utils";

const MapPicker = dynamic(() => import("@/components/checkout/map-picker").then((m) => m.MapPicker), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-card bg-porselen" /> });

export type SavedAddress = {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  provinceCode: string | null;
  regencyCode: string | null;
  districtCode: string | null;
  postalCode: string;
  street: string;
  lat: number | null;
  lng: number | null;
  isPrimary: boolean;
};

type Draft = {
  label: string;
  recipient: string;
  phone: string;
  provinceCode: string;
  regencyCode: string;
  districtCode: string;
  districtText: string;
  postalCode: string;
  street: string;
  lat: number | null;
  lng: number | null;
  isPrimary: boolean;
};

const selectClass = "h-11 w-full rounded-pill border border-garis bg-putih px-4 text-base text-kopi outline-none focus-visible:border-aksen focus-visible:shadow-ring aria-invalid:border-bahaya disabled:opacity-60";

function toDraft(a: SavedAddress | null, defaults: { name: string; phone: string }): Draft {
  if (!a) return { label: "Rumah", recipient: defaults.name, phone: defaults.phone, provinceCode: "", regencyCode: "", districtCode: "", districtText: "", postalCode: "", street: "", lat: null, lng: null, isPrimary: false };
  const jatim = a.provinceCode ? hasDistrictData(a.provinceCode) : false;
  return {
    label: a.label,
    recipient: a.recipient,
    phone: a.phone,
    provinceCode: a.provinceCode ?? "",
    regencyCode: a.regencyCode ?? "",
    districtCode: jatim ? (a.districtCode ?? "") : "",
    districtText: jatim ? "" : a.district,
    postalCode: a.postalCode,
    street: a.street,
    lat: a.lat,
    lng: a.lng,
    isPrimary: a.isPrimary,
  };
}

function AddressForm({ initial, id, onDone, onCancel, isOnly }: { initial: Draft; id: number | null; onDone: () => void; onCancel: () => void; isOnly: boolean }) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [showMap, setShowMap] = useState(initial.lat != null);
  const [pending, start] = useTransition();
  const provinceList = useMemo(() => provinces(), []);
  const regencyList = useMemo(() => (d.provinceCode ? regencies(d.provinceCode) : []), [d.provinceCode]);
  const districtList = useMemo(() => (d.regencyCode && hasDistrictData(d.provinceCode) ? districts(d.regencyCode) : []), [d.regencyCode, d.provinceCode]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const err = (f: string) => (error?.field === f ? error.message : undefined);

  return (
    <form
      className="rounded-card border border-kopi/20 bg-putih p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await saveAddressAction(id, { ...d, districtCode: d.districtCode || null, districtText: d.districtText || null });
          if (!r.ok) setError({ field: r.field, message: r.message });
          else onDone();
        });
      }}
    >
      <h2 className="font-serif text-xl text-kopi">{id ? "Ubah alamat" : "Alamat baru"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="al-label">Nama alamat</Label>
          <Input id="al-label" value={d.label} onChange={(e) => set("label", e.target.value.slice(0, 30))} placeholder="Rumah, Kantor, Kos" />
        </div>
        <div>
          <Label htmlFor="al-nama">Nama penerima</Label>
          <Input id="al-nama" value={d.recipient} onChange={(e) => set("recipient", e.target.value)} aria-invalid={err("recipient") ? true : undefined} />
          {err("recipient") ? <HelpText tone="error">{err("recipient")}</HelpText> : null}
        </div>
        <div>
          <Label htmlFor="al-wa">Nomor WhatsApp penerima</Label>
          <Input id="al-wa" value={d.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" aria-invalid={err("phone") ? true : undefined} />
          {err("phone") ? <HelpText tone="error">{err("phone")}</HelpText> : null}
        </div>
        <div>
          <Label htmlFor="al-prov">Provinsi</Label>
          <select id="al-prov" className={selectClass} value={d.provinceCode} onChange={(e) => setD((x) => ({ ...x, provinceCode: e.target.value, regencyCode: "", districtCode: "", districtText: "" }))}>
            <option value="">Pilih provinsi</option>
            {provinceList.map((p) => (
              <option key={p.kode} value={p.kode}>
                {p.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="al-kota">Kota atau kabupaten</Label>
          <select id="al-kota" className={selectClass} value={d.regencyCode} disabled={!d.provinceCode} aria-invalid={err("regencyCode") ? true : undefined} onChange={(e) => setD((x) => ({ ...x, regencyCode: e.target.value, districtCode: "" }))}>
            <option value="">Pilih kota atau kabupaten</option>
            {regencyList.map((r) => (
              <option key={r.kode} value={r.kode}>
                {r.nama}
              </option>
            ))}
          </select>
          {err("regencyCode") ? <HelpText tone="error">{err("regencyCode")}</HelpText> : null}
        </div>
        <div>
          <Label htmlFor="al-kec">Kecamatan</Label>
          {hasDistrictData(d.provinceCode) || !d.provinceCode ? (
            <select id="al-kec" className={selectClass} value={d.districtCode} disabled={!d.regencyCode} aria-invalid={err("district") ? true : undefined} onChange={(e) => set("districtCode", e.target.value)}>
              <option value="">Pilih kecamatan</option>
              {districtList.map((x) => (
                <option key={x.kode} value={x.kode}>
                  {x.nama}
                </option>
              ))}
            </select>
          ) : (
            <Input id="al-kec" value={d.districtText} onChange={(e) => set("districtText", e.target.value)} placeholder="Tulis nama kecamatan" aria-invalid={err("district") ? true : undefined} />
          )}
          {err("district") ? <HelpText tone="error">{err("district")}</HelpText> : null}
        </div>
        <div>
          <Label htmlFor="al-pos">Kode pos</Label>
          <Input id="al-pos" value={d.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" aria-invalid={err("postalCode") ? true : undefined} />
          {err("postalCode") ? <HelpText tone="error">{err("postalCode")}</HelpText> : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="al-jalan">Alamat lengkap</Label>
          <textarea
            id="al-jalan"
            value={d.street}
            onChange={(e) => set("street", e.target.value)}
            rows={3}
            aria-invalid={err("street") ? true : undefined}
            className="w-full rounded-[16px] border border-garis bg-putih px-4 py-3 text-base text-kopi outline-none focus-visible:border-aksen focus-visible:shadow-ring aria-invalid:border-bahaya"
          />
          {err("street") ? <HelpText tone="error">{err("street")}</HelpText> : <HelpText>Nama jalan, nomor rumah, RT/RW, patokan.</HelpText>}
        </div>
        <div className="sm:col-span-2">
          {showMap ? (
            <div className="space-y-2">
              <MapPicker
                lat={d.lat}
                lng={d.lng}
                onChange={(lat, lng) => setD((x) => ({ ...x, lat, lng }))}
              />
              <p className="text-xs text-abu-hangat">{d.lat != null ? `Titik tersimpan: ${d.lat}, ${d.lng}` : "Ketuk peta atau geser pin ke lokasi rumahmu."}</p>
            </div>
          ) : (
            <button type="button" onClick={() => setShowMap(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-aksen hover:underline">
              <MapPin className="size-4" /> Tandai lokasi di peta (opsional)
            </button>
          )}
        </div>
        {!isOnly && !initial.isPrimary ? (
          <label className="inline-flex items-center gap-2 text-sm text-kopi sm:col-span-2">
            <input type="checkbox" className="size-4 accent-[var(--color-aksen)]" checked={d.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} /> Jadikan alamat utama
          </label>
        ) : null}
      </div>
      {error && !error.field ? (
        <p className="mt-3 text-sm text-bahaya" role="alert">
          {error.message}
        </p>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Simpan alamat
        </Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses, max, defaults }: { addresses: SavedAddress[]; max: number; defaults: { name: string; phone: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "baru" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Gagal. Coba lagi.");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-card bg-[#F7E3E1] px-4 py-3 text-sm text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
      {addresses.map((a) =>
        editing === a.id ? (
          <AddressForm key={a.id} id={a.id} initial={toDraft(a, defaults)} onDone={done} onCancel={() => setEditing(null)} isOnly={addresses.length === 1} />
        ) : (
          <article key={a.id} className={cn("rounded-card border bg-putih p-4", a.isPrimary ? "border-kopi/30" : "border-garis")} data-testid="kartu-alamat">
            <div className="flex items-start gap-3">
              <Home className="mt-0.5 size-5 shrink-0 text-aksen" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-kopi">
                  {a.label} {a.isPrimary ? <Badge variant="sukses">Utama</Badge> : null}
                </p>
                <p className="text-sm text-kopi">
                  {a.recipient} · {a.phone}
                </p>
                <p className="text-sm text-abu-hangat">
                  {a.street}, {a.district}, {a.city}, {a.province} {a.postalCode}
                </p>
                {a.lat != null ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-abu-hangat">
                    <MapPin className="size-3" aria-hidden /> Titik peta tersimpan
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-garis pt-3">
              <Button size="sm" variant="outline" onClick={() => setEditing(a.id)}>
                <Pencil /> Ubah
              </Button>
              {!a.isPrimary ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setPrimaryAddressAction(a.id))}>
                  <Star /> Jadikan utama
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="text-bahaya"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Hapus alamat "${a.label}"?`)) run(() => deleteAddressAction(a.id));
                }}
              >
                <Trash2 /> Hapus
              </Button>
            </div>
          </article>
        ),
      )}
      {editing === "baru" ? (
        <AddressForm id={null} initial={toDraft(null, defaults)} onDone={done} onCancel={() => setEditing(null)} isOnly={addresses.length === 0} />
      ) : addresses.length < max ? (
        <Button variant="outline" className="w-full border-dashed" onClick={() => setEditing("baru")}>
          <Plus /> Tambah alamat ({addresses.length}/{max})
        </Button>
      ) : (
        <p className="text-center text-sm text-abu-hangat">Sudah {max} alamat, batas maksimal. Hapus salah satu untuk menambah.</p>
      )}
    </div>
  );
}
