"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CreditCard, Home, Loader2, MapPin, Plus, QrCode, Sparkles, Store, Tag, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpText, Input, Label } from "@/components/ui/input";
import { quoteCheckoutAction, placeOrderAction, type CheckoutQuote } from "@/lib/checkout/actions";
import { setCartCount } from "@/lib/cart/client-cart";
import { formatNumber, formatRupiah } from "@/lib/format";
import { normalizePhone } from "@/lib/orders/rules";
import { districts, hasDistrictData, provinces, regencies } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { OrderSummary } from "./order-summary";

const MapPicker = dynamic(() => import("./map-picker").then((m) => m.MapPicker), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-card bg-porselen" /> });

type Method = "kirim" | "ambil";
type Pay = "qris" | "va_bca" | "va_bni" | "va_bri" | "va_mandiri" | "bayar_di_toko";
type CourierCode = "jne_reg" | "jne_yes" | "jnt_ez" | "sicepat_reg" | "instan";

type Form = {
  name: string;
  phone: string;
  email: string;
  method: Method;
  provinceCode: string;
  regencyCode: string;
  districtCode: string;
  districtText: string;
  postalCode: string;
  street: string;
  lat: number | null;
  lng: number | null;
  pickupSlug: string;
  courierCode: CourierCode | "";
  note: string;
  paymentMethod: Pay | "";
  voucherCode: string;
  addressId: number | null; // alamat tersimpan yang dipilih (pembeli yang masuk)
  saveAddress: boolean;
  addressLabel: string;
  usePoints: boolean;
};

export type CheckoutAccount = {
  name: string;
  phone: string;
  email: string | null;
  addresses: { id: number; label: string; recipient: string; phone: string; street: string; district: string; city: string; province: string; postalCode: string; provinceCode: string | null; regencyCode: string | null; districtCode: string | null; lat: number | null; lng: number | null; isPrimary: boolean }[];
  canSaveMore: boolean;
};

const STEPS = ["Penerima dan alamat", "Pengiriman", "Pembayaran"] as const;
const STEPS_SHORT = ["Alamat", "Kirim", "Bayar"] as const;

const PAYMENTS: { value: Pay; label: string; hint: string }[] = [
  { value: "qris", label: "QRIS", hint: "Scan dengan aplikasi bank atau dompet digital apa pun." },
  { value: "va_bca", label: "Virtual Account BCA", hint: "Bayar lewat m-BCA, KlikBCA, atau ATM." },
  { value: "va_bni", label: "Virtual Account BNI", hint: "Bayar lewat BNI Mobile, internet banking, atau ATM." },
  { value: "va_bri", label: "Virtual Account BRI", hint: "Bayar lewat BRImo, internet banking, atau ATM." },
  { value: "va_mandiri", label: "Virtual Account Mandiri", hint: "Bayar lewat Livin' by Mandiri atau ATM." },
];

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <HelpText tone="error" id={`${htmlFor}-error`} role="alert">
          {error}
        </HelpText>
      ) : hint ? (
        <HelpText>{hint}</HelpText>
      ) : null}
    </div>
  );
}

// Navigasi langkah yang sama di ketiga langkah: Kembali di kiri, tombol utama di kanan, satu baris.
function StepNav({ onBack, back, backAsLink, children }: { onBack?: () => void; back?: React.ReactNode; backAsLink?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {backAsLink ? (
        <Button variant="ghost" asChild className="shrink-0">
          {back}
        </Button>
      ) : (
        <Button variant="ghost" onClick={onBack} className="shrink-0">
          Kembali
        </Button>
      )}
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

const selectClass = "h-11 w-full rounded-pill border border-garis bg-putih px-4 text-base text-kopi outline-none focus-visible:border-rona focus-visible:shadow-ring aria-invalid:border-bahaya disabled:opacity-60";

// Isian alamat dari alamat tersimpan, supaya zona ongkir dan ringkasan langkah 2 tetap bekerja.
function fromSaved(a: CheckoutAccount["addresses"][number]): Partial<Form> {
  const inJatim = a.provinceCode ? hasDistrictData(a.provinceCode) : false;
  return {
    addressId: a.id,
    name: a.recipient,
    phone: a.phone,
    provinceCode: a.provinceCode ?? "",
    regencyCode: a.regencyCode ?? "",
    districtCode: inJatim ? (a.districtCode ?? "") : "",
    districtText: inJatim ? "" : a.district,
    postalCode: a.postalCode,
    street: a.street,
    lat: a.lat,
    lng: a.lng,
  };
}

export function CheckoutFlow({ initial, initialVoucher, account }: { initial: CheckoutQuote; initialVoucher: string | null; account: CheckoutAccount | null }) {
  const router = useRouter();
  const ids = useId();
  const [step, setStep] = useState(0);
  const primary = account?.addresses.find((a) => a.isPrimary && a.regencyCode) ?? account?.addresses.find((a) => a.regencyCode) ?? null;
  const [form, setForm] = useState<Form>(() => ({
    name: account?.name ?? "",
    phone: account?.phone ?? "",
    email: account?.email ?? "",
    method: "kirim",
    provinceCode: "",
    regencyCode: "",
    districtCode: "",
    districtText: "",
    postalCode: "",
    street: "",
    lat: null,
    lng: null,
    pickupSlug: "",
    courierCode: "",
    note: "",
    paymentMethod: "",
    voucherCode: initialVoucher ?? "",
    addressId: null,
    saveAddress: Boolean(account?.canSaveMore),
    addressLabel: "Rumah",
    usePoints: false,
    ...(primary ? fromSaved(primary) : {}),
  }));
  const [voucherInput, setVoucherInput] = useState(initialVoucher ?? "");
  const [quote, setQuote] = useState<CheckoutQuote>(initial);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [placing, startPlacing] = useTransition();
  const seq = useRef(0);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const refresh = useCallback(async (f: Form, withPhone: boolean) => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const q = await quoteCheckoutAction({
        method: f.method,
        regencyCode: f.method === "kirim" ? f.regencyCode || null : null,
        courierCode: f.method === "kirim" ? f.courierCode || null : null,
        voucherCode: f.voucherCode || null,
        phone: withPhone ? f.phone : null,
        usePoints: f.usePoints,
      });
      if (my === seq.current) setQuote(q);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  // Hitung ulang di server setiap kali hal yang memengaruhi harga berubah.
  useEffect(() => {
    const t = window.setTimeout(() => void refresh(form, step >= 1), 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.method, form.regencyCode, form.courierCode, form.voucherCode, form.usePoints, step, refresh]);

  const regencyList = useMemo(() => (form.provinceCode ? regencies(form.provinceCode) : []), [form.provinceCode]);
  const districtList = useMemo(() => (form.regencyCode && hasDistrictData(form.provinceCode) ? districts(form.regencyCode) : []), [form.regencyCode, form.provinceCode]);
  const provinceList = useMemo(() => provinces(), []);

  const cart = quote.cart;
  const pricing = quote.pricing;
  if (!cart || !pricing || cart.lines.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-garis bg-putih p-8 text-center">
        <p className="font-serif text-2xl text-kopi">Keranjangmu kosong</p>
        <p className="mt-1 text-sm text-abu-hangat">Tambahkan produk dulu sebelum checkout.</p>
        <Button asChild className="mt-4">
          <Link href="/c/semua">Belanja sekarang</Link>
        </Button>
      </div>
    );
  }

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Isi nama penerima.";
    if (!normalizePhone(form.phone)) e.phone = "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email tidak valid.";
    if (form.method === "kirim" && form.addressId != null) {
      if (!form.regencyCode) e.regencyCode = "Alamat ini perlu dilengkapi. Ubah di Akun, Alamat, atau pakai alamat baru.";
    } else if (form.method === "kirim") {
      if (!form.provinceCode) e.provinceCode = "Pilih provinsi.";
      if (!form.regencyCode) e.regencyCode = "Pilih kota atau kabupaten.";
      if (hasDistrictData(form.provinceCode) ? !form.districtCode : form.districtText.trim().length < 3) e.district = "Isi kecamatan.";
      if (!/^\d{5}$/.test(form.postalCode)) e.postalCode = "Kode pos harus 5 angka.";
      if (form.street.trim().length < 8) e.street = "Tulis alamat lengkap: jalan, nomor rumah, RT/RW.";
    } else if (!form.pickupSlug) e.pickupSlug = "Pilih cabang untuk mengambil pesanan.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (form.method === "kirim") {
      if (quote.warehouseShort.length) e.courierCode = "Stok gudang belum cukup untuk dikirim.";
      else if (!form.courierCode) e.courierCode = "Pilih kurir.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (to: number) => {
    setFormError(null);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    if (step === 0 && validateStep1()) go(1);
    else if (step === 1 && validateStep2()) {
      if (form.method === "kirim" && form.paymentMethod === "bayar_di_toko") set("paymentMethod", "");
      go(2);
    }
  };

  const place = () => {
    setFormError(null);
    if (!form.paymentMethod) {
      setErrors({ paymentMethod: "Pilih metode pembayaran." });
      return;
    }
    startPlacing(async () => {
      const r = await placeOrderAction({
        name: form.name,
        phone: form.phone,
        email: form.email,
        method: form.method,
        provinceCode: form.provinceCode || undefined,
        regencyCode: form.regencyCode || undefined,
        districtCode: form.districtCode || undefined,
        districtText: form.districtText || undefined,
        postalCode: form.postalCode || undefined,
        street: form.street || undefined,
        lat: form.lat,
        lng: form.lng,
        courierCode: form.method === "kirim" ? (form.courierCode as CourierCode) : null,
        pickupSlug: form.method === "ambil" ? form.pickupSlug : null,
        paymentMethod: form.paymentMethod as Pay,
        voucherCode: form.voucherCode || null,
        note: form.note,
        addressId: form.method === "kirim" ? form.addressId : null,
        saveAddress: Boolean(account) && form.addressId == null && form.saveAddress,
        addressLabel: form.addressLabel,
        usePoints: form.usePoints,
        expectedTotal: pricing.total,
      });
      if (r.ok) {
        setCartCount(0);
        router.push(r.paymentMethod === "bayar_di_toko" ? `/pesanan/${r.number}/sukses?t=${r.token}` : `/bayar/${r.number}?t=${r.token}`);
        return;
      }
      if (r.pricing) setQuote((q) => ({ ...q, pricing: r.pricing! }));
      if (r.field && ["name", "phone", "email", "regencyCode", "district", "postalCode", "street"].includes(r.field)) {
        setErrors({ [r.field]: r.message });
        go(0);
        return;
      }
      if (r.field === "voucherCode") setErrors({ voucherCode: r.message });
      setFormError(r.message);
      void refresh(form, true);
    });
  };

  const pickupChosen = quote.pickup.find((p) => p.slug === form.pickupSlug);

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-0">
      <div className="min-w-0">
        <ol className="mb-6 flex items-center gap-2" aria-label="Langkah checkout">
          {STEPS.map((label, i) => (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && go(i)}
                disabled={i > step}
                aria-current={i === step ? "step" : undefined}
                className={cn("flex min-w-0 items-center gap-2 text-left", i < step && "cursor-pointer")}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums", i < step ? "bg-sukses text-putih" : i === step ? "bg-kopi text-putih" : "bg-garis text-abu-hangat")}>
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("text-xs font-medium whitespace-nowrap sm:text-sm", i === step ? "text-kopi" : "text-abu-hangat")}>
                  <span className="sm:hidden">{STEPS_SHORT[i]}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
              {i < STEPS.length - 1 ? <span className="h-px min-w-3 flex-1 bg-garis" aria-hidden /> : null}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <section aria-labelledby={`${ids}-s1`} className="space-y-6">
            <h2 id={`${ids}-s1`} className="sr-only">
              Penerima dan alamat
            </h2>
            <div className="rounded-card border border-garis bg-putih p-5">
              <h3 className="font-serif text-xl text-kopi">Penerima</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nama penerima" htmlFor="co-name" error={errors.name}>
                  <Input id="co-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" aria-invalid={errors.name ? true : undefined} />
                </Field>
                <Field label="Nomor WhatsApp" htmlFor="co-phone" error={errors.phone} hint="Untuk kabar pesanan dan lacak tanpa login.">
                  <Input id="co-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" aria-invalid={errors.phone ? true : undefined} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Email (opsional)" htmlFor="co-email" error={errors.email}>
                    <Input id="co-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" aria-invalid={errors.email ? true : undefined} />
                  </Field>
                </div>
              </div>
            </div>

            <div className="rounded-card border border-garis bg-putih p-5">
              <h3 className="font-serif text-xl text-kopi">Cara menerima pesanan</h3>
              <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Cara menerima pesanan">
                {([
                  ["kirim", "Dikirim", "Ke alamatmu", Truck],
                  ["ambil", "Ambil di Toko", "Gratis, di cabang Malang", Store],
                ] as const)
                  .filter(([value]) => value === "kirim" || quote.pickupEnabled !== false)
                  .map(([value, label, hint, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.method === value}
                    onClick={() => set("method", value)}
                    className={cn("flex items-start gap-3 rounded-card border-2 p-4 text-left transition-colors", form.method === value ? "border-kopi bg-porselen" : "border-garis hover:border-kopi/30")}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-rona" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold text-kopi">{label}</span>
                      <span className="block text-xs text-abu-hangat">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              {form.method === "kirim" && account && account.addresses.length > 0 ? (
                <div className="mt-5">
                  <p className="text-sm font-medium text-kopi">Kirim ke</p>
                  <div className="mt-2 space-y-2" role="radiogroup" aria-label="Alamat tersimpan">
                    {account.addresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={form.addressId === a.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, ...fromSaved(a), courierCode: "" }));
                          setErrors({});
                        }}
                        className={cn("flex w-full items-start gap-3 rounded-card border-2 p-4 text-left transition-colors", form.addressId === a.id ? "border-kopi bg-porselen" : "border-garis hover:border-kopi/30")}
                      >
                        <Home className="mt-0.5 size-5 shrink-0 text-rona" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-kopi">
                            {a.label}
                            {a.isPrimary ? <Badge variant="sukses">Utama</Badge> : null}
                          </span>
                          <span className="block text-xs text-abu-hangat">
                            {a.recipient}, {a.phone}
                          </span>
                          <span className="block text-xs text-abu-hangat">
                            {a.street}, {a.district}, {a.city} {a.postalCode}
                          </span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.addressId == null}
                      onClick={() => setForm((f) => ({ ...f, addressId: null, provinceCode: "", regencyCode: "", districtCode: "", districtText: "", postalCode: "", street: "", lat: null, lng: null, courierCode: "", name: account.name, phone: account.phone }))}
                      className={cn("flex w-full items-center gap-3 rounded-card border-2 p-4 text-left text-sm font-semibold transition-colors", form.addressId == null ? "border-kopi bg-porselen text-kopi" : "border-dashed border-garis text-rona hover:border-kopi/30")}
                    >
                      <Plus className="size-5 shrink-0" aria-hidden /> Alamat baru
                    </button>
                  </div>
                  {errors.regencyCode && form.addressId != null ? (
                    <HelpText tone="error" role="alert">
                      {errors.regencyCode}
                    </HelpText>
                  ) : null}
                </div>
              ) : null}

              {form.method === "kirim" && form.addressId == null ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Provinsi" htmlFor="co-prov" error={errors.provinceCode}>
                    <select
                      id="co-prov"
                      className={selectClass}
                      value={form.provinceCode}
                      aria-invalid={errors.provinceCode ? true : undefined}
                      onChange={(e) => setForm((f) => ({ ...f, provinceCode: e.target.value, regencyCode: "", districtCode: "", districtText: "", courierCode: "" }))}
                    >
                      <option value="">Pilih provinsi</option>
                      {provinceList.map((p) => (
                        <option key={p.kode} value={p.kode}>
                          {p.nama}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Kota atau kabupaten" htmlFor="co-kota" error={errors.regencyCode}>
                    <select
                      id="co-kota"
                      className={selectClass}
                      value={form.regencyCode}
                      disabled={!form.provinceCode}
                      aria-invalid={errors.regencyCode ? true : undefined}
                      onChange={(e) => setForm((f) => ({ ...f, regencyCode: e.target.value, districtCode: "", courierCode: "" }))}
                    >
                      <option value="">Pilih kota atau kabupaten</option>
                      {regencyList.map((r) => (
                        <option key={r.kode} value={r.kode}>
                          {r.nama}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Kecamatan" htmlFor="co-kec" error={errors.district}>
                    {hasDistrictData(form.provinceCode) || !form.provinceCode ? (
                      <select id="co-kec" className={selectClass} value={form.districtCode} disabled={!form.regencyCode} aria-invalid={errors.district ? true : undefined} onChange={(e) => set("districtCode", e.target.value)}>
                        <option value="">Pilih kecamatan</option>
                        {districtList.map((d) => (
                          <option key={d.kode} value={d.kode}>
                            {d.nama}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input id="co-kec" value={form.districtText} onChange={(e) => set("districtText", e.target.value)} placeholder="Tulis nama kecamatan" aria-invalid={errors.district ? true : undefined} />
                    )}
                  </Field>
                  <Field label="Kode pos" htmlFor="co-pos" error={errors.postalCode}>
                    <Input id="co-pos" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" autoComplete="postal-code" aria-invalid={errors.postalCode ? true : undefined} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Alamat lengkap" htmlFor="co-street" error={errors.street} hint="Nama jalan, nomor rumah, RT/RW, patokan.">
                      <textarea
                        id="co-street"
                        value={form.street}
                        onChange={(e) => set("street", e.target.value)}
                        rows={3}
                        autoComplete="street-address"
                        aria-invalid={errors.street ? true : undefined}
                        className="w-full rounded-[16px] border border-garis bg-putih px-4 py-3 text-base text-kopi outline-none focus-visible:border-rona focus-visible:shadow-ring aria-invalid:border-bahaya"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    {showMap ? (
                      <div className="space-y-2">
                        <MapPicker
                          lat={form.lat}
                          lng={form.lng}
                          onChange={(lat, lng) => {
                            set("lat", lat);
                            set("lng", lng);
                          }}
                        />
                        <p className="text-xs text-abu-hangat">{form.lat != null ? `Titik tersimpan: ${form.lat}, ${form.lng}` : "Ketuk peta atau geser pin ke lokasi rumahmu."}</p>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowMap(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rona hover:underline">
                        <MapPin className="size-4" /> Tandai lokasi di peta (opsional)
                      </button>
                    )}
                  </div>
                  {account ? (
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                      <label className={cn("inline-flex items-center gap-2 text-sm text-kopi", !account.canSaveMore && "opacity-60")}>
                        <input type="checkbox" className="size-4 accent-[var(--color-rona)]" checked={form.saveAddress && account.canSaveMore} disabled={!account.canSaveMore} onChange={(e) => set("saveAddress", e.target.checked)} />
                        {account.canSaveMore ? "Simpan alamat ini ke akunku" : "Buku alamat penuh (maksimal 10)"}
                      </label>
                      {form.saveAddress && account.canSaveMore ? (
                        <Input aria-label="Nama alamat" value={form.addressLabel} onChange={(e) => set("addressLabel", e.target.value.slice(0, 30))} placeholder="Misal: Rumah, Kantor" className="h-9 max-w-44" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : form.method === "kirim" ? null : (
                <div className="mt-5">
                  <p className="text-sm text-abu-hangat">Hanya cabang yang stoknya cukup untuk semua produk di keranjangmu yang bisa dipilih.</p>
                  <div className="mt-3 space-y-2" role="radiogroup" aria-label="Pilih cabang">
                    {quote.pickup.map((p) => (
                      <button
                        key={p.slug}
                        type="button"
                        role="radio"
                        aria-checked={form.pickupSlug === p.slug}
                        aria-label={p.name}
                        disabled={!p.enough}
                        onClick={() => set("pickupSlug", p.slug)}
                        className={cn("flex w-full items-start gap-3 rounded-card border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55", form.pickupSlug === p.slug ? "border-kopi bg-porselen" : "border-garis hover:border-kopi/30")}
                      >
                        <Store className="mt-0.5 size-5 shrink-0 text-rona" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-kopi">{p.name}</span>
                          <span className="block text-xs text-abu-hangat">
                            {p.address}, {p.district} · <span className="whitespace-nowrap">{p.hoursLabel}</span>
                          </span>
                          <span className={cn("mt-1 block text-xs", p.enough ? "text-sukses" : "text-bahaya")}>{p.enough ? p.readyLabel : "Stok belum cukup untuk semua produk"}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {errors.pickupSlug ? (
                    <HelpText tone="error" role="alert">
                      {errors.pickupSlug}
                    </HelpText>
                  ) : null}
                </div>
              )}
            </div>
            <StepNav back={<Link href="/keranjang">Keranjang</Link>} backAsLink>
              <Button size="lg" onClick={next}>
                Lanjut ke pengiriman
              </Button>
            </StepNav>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-6" aria-label="Pengiriman">
            <div className="rounded-card border border-garis bg-putih p-5">
              {form.method === "kirim" ? (
                <>
                  <h3 className="font-serif text-xl text-kopi">Pilih kurir</h3>
                  <p className="mt-1 text-sm text-abu-hangat">
                    Ke {form.districtCode ? districts(form.regencyCode).find((d) => d.kode === form.districtCode)?.nama : form.districtText}, {regencies(form.provinceCode).find((r) => r.kode === form.regencyCode)?.nama}. Berat {pricing.weightGram} gram.
                  </p>
                  {quote.warehouseShort.length ? (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#FBEEDC] px-3 py-2 text-sm text-[#8A5512]" role="alert">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> Stok gudang untuk {quote.warehouseShort.join(", ")} belum cukup untuk dikirim. Pilih Ambil di Toko atau kurangi jumlahnya di keranjang.
                    </p>
                  ) : null}
                  <div className="mt-4 space-y-2" role="radiogroup" aria-label="Kurir">
                    {quote.couriers.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        role="radio"
                        aria-checked={form.courierCode === c.code}
                        aria-label={`${c.name} ${c.service}`}
                        aria-disabled={c.disabledNote ? true : undefined}
                        disabled={Boolean(c.disabledNote)}
                        onClick={() => set("courierCode", c.code as CourierCode)}
                        className={cn("flex w-full items-center gap-3 rounded-card border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55", form.courierCode === c.code ? "border-kopi bg-porselen" : "border-garis hover:border-kopi/30")}
                      >
                        <Truck className="size-5 shrink-0 text-rona" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-kopi">
                            {c.name} {c.service}
                            {c.shipsToday ? <Badge variant="sukses">Dikirim hari ini</Badge> : null}
                          </span>
                          <span className="block text-xs text-abu-hangat">{c.disabledNote ? <span className="text-peringatan">Di luar jam operasional. {c.disabledNote}.</span> : `Estimasi tiba ${c.etaLabel.toLowerCase()}`}</span>
                        </span>
                        <span className="text-right text-sm whitespace-nowrap tabular-nums">
                          {c.payable < c.cost ? <s className="block text-xs text-abu-hangat">{formatRupiah(c.cost)}</s> : null}
                          <span className="font-semibold text-kopi">{c.payable === 0 ? "Gratis" : formatRupiah(c.payable)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {errors.courierCode ? (
                    <HelpText tone="error" role="alert">
                      {errors.courierCode}
                    </HelpText>
                  ) : null}
                </>
              ) : (
                <>
                  <h3 className="font-serif text-xl text-kopi">Ambil di toko</h3>
                  {pickupChosen ? (
                    <div className="mt-3 rounded-card bg-porselen p-4 text-sm">
                      <p className="font-semibold text-kopi">{pickupChosen.name}</p>
                      <p className="text-abu-hangat">
                        {pickupChosen.address}, {pickupChosen.district}
                      </p>
                      <p className="mt-1 text-sukses">{pickupChosen.readyLabel}</p>
                    </div>
                  ) : null}
                </>
              )}
              <div className="mt-5">
                <Field label="Catatan untuk penjual (opsional)" htmlFor="co-note">
                  <textarea id="co-note" value={form.note} onChange={(e) => set("note", e.target.value.slice(0, 300))} rows={2} placeholder="Misal: tolong bungkus kado" className="w-full rounded-[16px] border border-garis bg-putih px-4 py-3 text-base text-kopi outline-none focus-visible:border-rona focus-visible:shadow-ring" />
                </Field>
              </div>
            </div>
            <StepNav onBack={() => go(0)}>
              <Button size="lg" onClick={next}>
                Lanjut ke pembayaran
              </Button>
            </StepNav>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-6" aria-label="Pembayaran">
            <div className="rounded-card border border-garis bg-putih p-5">
              <h3 className="font-serif text-xl text-kopi">Metode pembayaran</h3>
              <div className="mt-4 space-y-2" role="radiogroup" aria-label="Metode pembayaran">
                {[...PAYMENTS, ...(form.method === "ambil" ? [{ value: "bayar_di_toko" as Pay, label: "Bayar di Toko", hint: "Bayar di kasir saat mengambil, paling lambat jam tutup hari kerja berikutnya." }] : [])]
                  .filter((p) => !quote.payments || quote.payments.includes(p.value))
                  .map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={form.paymentMethod === p.value}
                    aria-label={p.label}
                    onClick={() => set("paymentMethod", p.value)}
                    className={cn("flex w-full items-center gap-3 rounded-card border-2 p-4 text-left transition-colors", form.paymentMethod === p.value ? "border-kopi bg-porselen" : "border-garis hover:border-kopi/30")}
                  >
                    {p.value === "qris" ? <QrCode className="size-5 shrink-0 text-rona" aria-hidden /> : p.value === "bayar_di_toko" ? <Store className="size-5 shrink-0 text-rona" aria-hidden /> : <CreditCard className="size-5 shrink-0 text-rona" aria-hidden />}
                    <span>
                      <span className="block text-sm font-semibold text-kopi">{p.label}</span>
                      <span className="block text-xs text-abu-hangat">{p.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              {errors.paymentMethod ? (
                <HelpText tone="error" role="alert">
                  {errors.paymentMethod}
                </HelpText>
              ) : null}
            </div>

            {quote.points && quote.points.balance > 0 ? (
              <div className="rounded-card border border-garis bg-putih p-5">
                <div className="flex items-center gap-3">
                  <Sparkles className="size-5 shrink-0 text-emas" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-kopi" id="co-poin-label">
                      {quote.points.usable > 0 ? `Pakai ${formatNumber(form.usePoints ? pricing.points.used || quote.points.usable : quote.points.usable)} poin, hemat ${formatRupiah(form.usePoints ? pricing.points.used || quote.points.usable : quote.points.usable)}` : "Poin belum bisa dipakai"}
                    </p>
                    <p className="text-xs text-abu-hangat">
                      Saldo {formatNumber(quote.points.balance)} poin. Maksimal 50% dari belanja setelah voucher.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.usePoints}
                    aria-labelledby="co-poin-label"
                    disabled={quote.points.usable <= 0}
                    onClick={() => set("usePoints", !form.usePoints)}
                    className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", form.usePoints ? "bg-sukses" : "bg-garis")}
                  >
                    <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-putih shadow transition-transform", form.usePoints && "translate-x-5")} />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-card border border-garis bg-putih p-5">
              <h3 className="font-serif text-xl text-kopi">Voucher</h3>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  set("voucherCode", voucherInput.trim().toUpperCase());
                }}
              >
                <label htmlFor="co-voucher" className="sr-only">
                  Kode voucher
                </label>
                <div className="relative min-w-0 flex-1">
                  <Tag className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-abu-hangat" aria-hidden />
                  <input id="co-voucher" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} placeholder="Kode voucher" autoComplete="off" className="h-11 w-full rounded-pill border border-garis bg-putih pr-3 pl-9 text-sm uppercase outline-none focus-visible:border-rona focus-visible:shadow-ring" />
                </div>
                {form.voucherCode ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setVoucherInput("");
                      set("voucherCode", "");
                    }}
                  >
                    Lepas
                  </Button>
                ) : (
                  <Button type="submit" variant="dark" disabled={!voucherInput.trim()}>
                    Pakai
                  </Button>
                )}
              </form>
              {pricing.voucher ? (
                <p className={cn("mt-1.5 text-xs", pricing.voucher.applied ? "text-sukses" : "text-bahaya")} role={pricing.voucher.applied ? "status" : "alert"}>
                  {pricing.voucher.message}
                </p>
              ) : errors.voucherCode ? (
                <p className="mt-1.5 text-xs text-bahaya" role="alert">
                  {errors.voucherCode}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="flex items-start gap-2 rounded-card bg-[#F7E3E1] px-4 py-3 text-sm text-bahaya" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formError}
              </p>
            ) : null}
            <StepNav onBack={() => go(1)}>
              <Button size="lg" onClick={place} disabled={placing || loading || (Boolean(form.voucherCode) && pricing.voucher?.applied === false)}>
                {placing ? <Loader2 className="animate-spin" /> : null} Buat Pesanan
                <span className="hidden sm:inline">, {formatRupiah(pricing.total)}</span>
              </Button>
            </StepNav>
            <p className="text-xs text-abu-hangat">Dengan membuat pesanan, kamu setuju dengan syarat belanja dan kebijakan retur Rona. Ini toko demo: tidak ada uang yang berpindah.</p>
          </section>
        ) : null}
      </div>

      <OrderSummary cart={cart} pricing={pricing} loading={loading} />
    </div>
  );
}
