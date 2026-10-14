"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Camera, Copy, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { ProductArt, packagingLabels } from "@/components/product-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { packagingValues, type Packaging } from "@/db/schema/enums";
import { deleteProductAction, duplicateProductAction, saveProductAction } from "@/lib/admin/catalog-actions";
import { uploadAdminPhoto } from "@/lib/client/compress-image";
import { formatRupiah } from "@/lib/format";
import { discountPercent } from "@/lib/pricing";
import { cn, slugify } from "@/lib/utils";
import { fieldClass } from "./ui";

type Variant = { key: number; id: number | null; shadeName: string; hex: string; undertone: "warm" | "neutral" | "cool" | ""; depth: string; sku: string; skuTouched: boolean; barcode: string; weightGram: string; normalPrice: string; salePrice: string; isActive: boolean };
export type ProductFormValue = {
  name: string;
  slug: string;
  brandId: number;
  categoryId: number;
  packaging: Packaging;
  shortDescription: string;
  benefits: string;
  ingredients: string;
  howToUse: string;
  activeIngredients: string;
  skinTypes: string[];
  skinConcerns: string[];
  finish: "" | "matte" | "satin" | "glowy";
  spf: string;
  bpom: string;
  netto: string;
  imageUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  status: "aktif" | "draf" | "arsip";
  variants: Omit<Variant, "key" | "skuTouched">[];
};

type Brand = { id: number; name: string; color: string };
type CategoryGroup = { id: number; name: string; children: { id: number; name: string }[] };

const SKIN = ["normal", "kering", "berminyak", "kombinasi", "sensitif"];
const CONCERNS = ["jerawat", "kusam", "pori", "penuaan", "dehidrasi"];
const TABS = [
  ["info", "Info"],
  ["varian", "Varian"],
  ["deskripsi", "Deskripsi"],
  ["seo", "SEO dan status"],
] as const;

function withoutVariants(p: ProductFormValue): Omit<ProductFormValue, "variants"> {
  const copy: Partial<ProductFormValue> = { ...p };
  delete copy.variants;
  return copy as Omit<ProductFormValue, "variants">;
}

let seq = 1;
const toRow = (v: Omit<Variant, "key" | "skuTouched">): Variant => ({ ...v, key: seq++, skuTouched: Boolean(v.sku) });
const emptyVariant = (): Variant => ({ key: seq++, id: null, shadeName: "", hex: "#D9A98B", undertone: "", depth: "", sku: "", skuTouched: false, barcode: "", weightGram: "100", normalPrice: "", salePrice: "", isActive: true });
const autoSku = (brand: string, productId: number | null, i: number) => `${brand.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "RONA"}-${String(productId ?? 0).padStart(3, "0")}-${String(i + 1).padStart(2, "0")}`;

function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium text-kopi">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-bahaya">{error}</span> : hint ? <span className="mt-1 block text-xs text-abu-hangat">{hint}</span> : null}
    </label>
  );
}

const textarea = "w-full rounded-lg border border-garis bg-putih px-3 py-2 text-sm text-kopi outline-none focus-visible:border-rona";

export function ProductForm({ id, initial, brands, categories, hasOrders, siteUrl, photosEnabled, initialMessage }: { id: number | null; initial: ProductFormValue; brands: Brand[]; categories: CategoryGroup[]; hasOrders: boolean; siteUrl: string; photosEnabled: boolean; initialMessage?: string }) {
  const router = useRouter();
  const [v, setV] = useState<Omit<ProductFormValue, "variants">>(() => withoutVariants(initial));
  const [rows, setRows] = useState<Variant[]>(() => (initial.variants.length ? initial.variants.map(toRow) : [emptyVariant()]));
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("info");
  const [previewKey, setPreviewKey] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(initialMessage ? { ok: true, text: initialMessage } : null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const brand = brands.find((b) => b.id === v.brandId) ?? brands[0];
  const preview = rows.find((r) => r.key === previewKey) ?? rows[0];
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));
  const setRow = (key: number, patch: Partial<Variant>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const skuOf = (r: Variant, i: number) => (r.skuTouched ? r.sku : r.sku || autoSku(brand?.name ?? "", id, i));
  const metaTitle = v.seoTitle || `${v.name || "Nama produk"} | Rona Beauty`;
  const metaDesc = v.seoDescription || v.shortDescription || "Deskripsi singkat produk tampil di sini.";
  const slug = v.slug || slugify(v.name);

  const tabErrors = useMemo(() => {
    const keys = Object.keys(errors);
    return {
      info: keys.some((k) => ["name", "brandId", "categoryId", "packaging", "spf"].includes(k)),
      varian: keys.some((k) => k.startsWith("variants")),
      deskripsi: false,
      seo: keys.some((k) => ["slug", "seoTitle", "seoDescription", "status"].includes(k)),
    };
  }, [errors]);

  const save = () =>
    start(async () => {
      setMessage(null);
      setErrors({});
      const payload = {
        name: v.name,
        slug,
        brandId: v.brandId,
        categoryId: v.categoryId,
        packaging: v.packaging,
        shortDescription: v.shortDescription,
        benefits: v.benefits,
        ingredients: v.ingredients,
        howToUse: v.howToUse,
        activeIngredients: v.activeIngredients.split(",").map((x) => x.trim()).filter(Boolean),
        skinTypes: v.skinTypes,
        skinConcerns: v.skinConcerns,
        finish: v.finish || null,
        spf: v.spf ? Number(v.spf) : null,
        bpom: v.bpom,
        netto: v.netto,
        imageUrl: v.imageUrl,
        seoTitle: v.seoTitle || null,
        seoDescription: v.seoDescription || null,
        status: v.status,
        variants: rows.map((r, i) => ({ id: r.id, shadeName: r.shadeName, hex: r.hex, undertone: r.undertone || null, depth: r.depth ? Number(r.depth) : null, sku: skuOf(r, i), barcode: r.barcode, weightGram: Number(r.weightGram) || 0, normalPrice: Number(r.normalPrice) || 0, salePrice: Number(r.salePrice) || 0, isActive: r.isActive })),
      };
      const r = await saveProductAction(id, payload);
      if (!r.ok) {
        setMessage({ ok: false, text: r.message });
        const issues = "issues" in r && Array.isArray(r.issues) ? (r.issues as { field: string; message: string }[]) : [];
        if (issues.length) {
          setErrors(Object.fromEntries(issues.map((x) => [x.field, x.message])));
          const first = issues[0].field;
          setTab(first.startsWith("variants") ? "varian" : ["slug", "seoTitle", "seoDescription", "status"].includes(first) ? "seo" : "info");
        }
        return;
      }
      setMessage({ ok: true, text: "Produk tersimpan." });
      // Formulir dipasang ulang dengan data baru dari server; pesan sukses dibawa lewat URL.
      if (!id) router.push(`/admin/produk/${r.id}?baru=1`);
      else {
        router.replace(`/admin/produk/${id}?disimpan=1`);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex gap-1.5" role="tablist" aria-label="Bagian formulir">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-sm", tab === k ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih")}>
                {label}
                {tabErrors[k] ? <span className="size-2 rounded-full bg-bahaya" aria-label="ada kesalahan" /> : null}
              </button>
            ))}
          </div>
        </div>

        {tab === "info" ? (
          <section className="grid gap-3 rounded-xl border border-garis bg-putih p-4 sm:grid-cols-2" aria-label="Info produk">
            <Field label="Nama produk" error={errors.name} className="sm:col-span-2">
              <input
                value={v.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
                className={fieldClass}
              />
            </Field>
            <Field label="Merek" error={errors.brandId}>
              <select value={v.brandId} onChange={(e) => set("brandId", Number(e.target.value))} className={fieldClass}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kategori" error={errors.categoryId}>
              <select value={v.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))} className={fieldClass}>
                <option value={0}>Pilih sub kategori</option>
                {categories.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Bentuk kemasan (ProductArt)" error={errors.packaging}>
              <select value={v.packaging} onChange={(e) => set("packaging", e.target.value as Packaging)} className={fieldClass}>
                {packagingValues.map((p) => (
                  <option key={p} value={p}>
                    {packagingLabels[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Finish">
              <select value={v.finish} onChange={(e) => set("finish", e.target.value as ProductFormValue["finish"])} className={fieldClass}>
                <option value="">Tidak ada</option>
                <option value="matte">Matte</option>
                <option value="satin">Satin</option>
                <option value="glowy">Glowy</option>
              </select>
            </Field>
            <Field label="SPF" error={errors.spf}>
              <input inputMode="numeric" value={v.spf} onChange={(e) => set("spf", e.target.value.replace(/\D/g, "").slice(0, 3))} className={fieldClass} />
            </Field>
            <Field label="Netto">
              <input value={v.netto} onChange={(e) => set("netto", e.target.value)} placeholder="Misal 15 g" className={fieldClass} />
            </Field>
            <Field label="Nomor BPOM">
              <input value={v.bpom} onChange={(e) => set("bpom", e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Bahan aktif" hint="Pisahkan dengan koma, misal Niacinamide, Ceramide." className="sm:col-span-2">
              <input value={v.activeIngredients} onChange={(e) => set("activeIngredients", e.target.value)} className={fieldClass} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Cocok untuk kulit</legend>
              <div className="flex flex-wrap gap-1.5">
                {SKIN.map((s) => {
                  const on = v.skinTypes.includes(s);
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => set("skinTypes", on ? v.skinTypes.filter((x) => x !== s) : [...v.skinTypes, s])} className={cn("h-8 rounded-pill border px-3 text-xs capitalize", on ? "border-kopi bg-kopi text-putih" : "border-garis")}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Masalah kulit</legend>
              <div className="flex flex-wrap gap-1.5">
                {CONCERNS.map((s) => {
                  const on = v.skinConcerns.includes(s);
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => set("skinConcerns", on ? v.skinConcerns.filter((x) => x !== s) : [...v.skinConcerns, s])} className={cn("h-8 rounded-pill border px-3 text-xs capitalize", on ? "border-kopi bg-kopi text-putih" : "border-garis")}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <p className="mb-1 text-sm font-medium">Foto produk (opsional)</p>
              {v.imageUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.imageUrl} alt="Foto produk" className="size-20 rounded-lg border border-garis object-cover" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => set("imageUrl", null)}>
                    <X /> Hapus foto
                  </Button>
                </div>
              ) : photosEnabled ? (
                <>
                  <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="animate-spin" /> : <Camera />} Unggah foto
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
                      const r = await uploadAdminPhoto(f, "produk");
                      setUploading(false);
                      if (r.ok) set("imageUrl", r.url);
                      else setMessage({ ok: false, text: r.message });
                    }}
                  />
                  <p className="mt-1 text-xs text-abu-hangat">Tanpa foto, toko memakai ilustrasi ProductArt.</p>
                </>
              ) : (
                <p className="text-xs text-abu-hangat">Unggah foto belum tersedia di server ini. Toko memakai ilustrasi ProductArt.</p>
              )}
            </div>
          </section>
        ) : null}

        {tab === "varian" ? (
          <section className="space-y-3" aria-label="Varian">
            {errors.variants ? <p className="text-sm text-bahaya">{errors.variants}</p> : null}
            {rows.map((r, i) => {
              const e = (k: string) => errors[`variants.${i}.${k}`];
              const pct = discountPercent(Number(r.normalPrice) || 0, Number(r.salePrice) || 0);
              return (
                <div key={r.key} className={cn("rounded-xl border bg-putih p-3", previewKey === r.key ? "border-kopi" : "border-garis")} data-testid="baris-varian">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setPreviewKey(r.key)} className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="size-5 rounded-full border border-garis" style={{ background: /^#[0-9a-f]{6}$/i.test(r.hex) ? r.hex : "#ffffff" }} aria-hidden />
                      Varian {i + 1}
                      {r.id ? null : <Badge variant="baru">Baru</Badge>}
                    </button>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={r.isActive} onChange={(ev) => setRow(r.key, { isActive: ev.target.checked })} className="size-4 accent-[var(--color-kopi)]" /> Aktif
                      </label>
                      <button type="button" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen hover:text-bahaya disabled:opacity-40" aria-label={`Hapus varian ${i + 1}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Field label="Nama shade" error={e("shadeName")} className="col-span-2">
                      <input value={r.shadeName} onChange={(ev) => setRow(r.key, { shadeName: ev.target.value })} placeholder="Misal 04N Langsat" aria-label={`Nama shade varian ${i + 1}`} className={fieldClass} />
                    </Field>
                    <Field label="Warna" error={e("hex")}>
                      <span className="flex gap-1.5">
                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(r.hex) ? r.hex : "#ffffff"} onChange={(ev) => setRow(r.key, { hex: ev.target.value.toUpperCase() })} aria-label={`Pilih warna varian ${i + 1}`} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-garis bg-putih p-1" />
                        <input value={r.hex} onChange={(ev) => setRow(r.key, { hex: ev.target.value.trim() })} aria-label={`Kode hex varian ${i + 1}`} className={cn(fieldClass, "font-mono uppercase")} />
                      </span>
                    </Field>
                    <Field label="Undertone">
                      <select value={r.undertone} onChange={(ev) => setRow(r.key, { undertone: ev.target.value as Variant["undertone"] })} className={fieldClass}>
                        <option value="">-</option>
                        <option value="warm">Warm</option>
                        <option value="neutral">Neutral</option>
                        <option value="cool">Cool</option>
                      </select>
                    </Field>
                    <Field label="Kedalaman 1-6" error={e("depth")}>
                      <select value={r.depth} onChange={(ev) => setRow(r.key, { depth: ev.target.value })} className={fieldClass}>
                        <option value="">-</option>
                        {[1, 2, 3, 4, 5, 6].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="SKU" error={e("sku")} hint={r.skuTouched ? undefined : "Dibuat otomatis, bisa diubah."}>
                      <input value={skuOf(r, i)} onChange={(ev) => setRow(r.key, { sku: ev.target.value.toUpperCase(), skuTouched: true })} aria-label={`SKU varian ${i + 1}`} className={cn(fieldClass, "font-mono")} />
                    </Field>
                    <Field label="Barcode">
                      <input value={r.barcode} onChange={(ev) => setRow(r.key, { barcode: ev.target.value })} className={cn(fieldClass, "font-mono")} />
                    </Field>
                    <Field label="Berat (gram)" error={e("weightGram")}>
                      <input inputMode="numeric" value={r.weightGram} onChange={(ev) => setRow(r.key, { weightGram: ev.target.value.replace(/\D/g, "").slice(0, 5) })} className={cn(fieldClass, "text-right tabular-nums")} />
                    </Field>
                    <Field label="Harga normal" error={e("normalPrice")}>
                      <input inputMode="numeric" value={r.normalPrice} onChange={(ev) => setRow(r.key, { normalPrice: ev.target.value.replace(/\D/g, "").slice(0, 9) })} aria-label={`Harga normal varian ${i + 1}`} className={cn(fieldClass, "text-right tabular-nums")} />
                    </Field>
                    <Field label="Harga jual" error={e("salePrice")} hint={pct > 0 ? `Diskon ${pct}% dari harga normal` : "Sama dengan harga normal"}>
                      <input inputMode="numeric" value={r.salePrice} onChange={(ev) => setRow(r.key, { salePrice: ev.target.value.replace(/\D/g, "").slice(0, 9) })} aria-label={`Harga jual varian ${i + 1}`} className={cn(fieldClass, "text-right tabular-nums")} />
                    </Field>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setRows((rs) => [...rs, { ...emptyVariant(), weightGram: rs[rs.length - 1]?.weightGram ?? "100", normalPrice: rs[rs.length - 1]?.normalPrice ?? "", salePrice: rs[rs.length - 1]?.salePrice ?? "" }])} disabled={rows.length >= 30}>
              <Plus /> Tambah varian
            </Button>
            <p className="text-xs text-abu-hangat">Varian baru otomatis mendapat stok 0 di semua lokasi. Isi stoknya lewat Stok, Stok masuk. Varian yang sudah pernah dipesan tidak dihapus, hanya dinonaktifkan.</p>
          </section>
        ) : null}

        {tab === "deskripsi" ? (
          <section className="space-y-3 rounded-xl border border-garis bg-putih p-4" aria-label="Deskripsi">
            <Field label="Deskripsi singkat" hint={`${v.shortDescription.length}/300`}>
              <textarea rows={2} value={v.shortDescription} onChange={(e) => set("shortDescription", e.target.value.slice(0, 300))} className={textarea} />
            </Field>
            <Field label="Tab Manfaat">
              <textarea rows={4} value={v.benefits} onChange={(e) => set("benefits", e.target.value)} className={textarea} />
            </Field>
            <Field label="Tab Kandungan">
              <textarea rows={4} value={v.ingredients} onChange={(e) => set("ingredients", e.target.value)} className={textarea} />
            </Field>
            <Field label="Tab Cara pakai">
              <textarea rows={3} value={v.howToUse} onChange={(e) => set("howToUse", e.target.value)} className={textarea} />
            </Field>
          </section>
        ) : null}

        {tab === "seo" ? (
          <section className="space-y-4 rounded-xl border border-garis bg-putih p-4" aria-label="SEO dan status">
            <Field label="Slug" error={errors.slug} hint={`Alamat produk: /p/${slug || "slug-produk"}`}>
              <input
                value={v.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
                className={cn(fieldClass, "font-mono")}
              />
            </Field>
            <Field label="Judul meta" error={errors.seoTitle} hint={<span className={cn("tabular-nums", metaTitle.length > 60 && "text-bahaya")}>{metaTitle.length}/60 karakter{v.seoTitle ? "" : " (otomatis dari nama)"}</span>}>
              <input value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value.slice(0, 120))} placeholder={`${v.name || "Nama produk"} | Rona Beauty`} className={fieldClass} />
            </Field>
            <Field label="Deskripsi meta" error={errors.seoDescription} hint={<span className={cn("tabular-nums", metaDesc.length > 160 && "text-bahaya")}>{metaDesc.length}/160 karakter{v.seoDescription ? "" : " (otomatis dari deskripsi singkat)"}</span>}>
              <textarea rows={2} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value.slice(0, 300))} className={textarea} />
            </Field>
            <div className="rounded-lg border border-garis bg-porselen/50 p-3" aria-label="Pratinjau hasil pencarian">
              <p className="text-xs text-abu-hangat">Pratinjau hasil pencarian</p>
              <p className="mt-1 truncate text-xs text-[#1a7f37]">{`${siteUrl.replace(/^https?:\/\//, "")} › p › ${slug || "slug-produk"}`}</p>
              <p className="truncate text-lg leading-snug text-[#1a0dab]">{metaTitle.slice(0, 60)}{metaTitle.length > 60 ? "..." : ""}</p>
              <p className="line-clamp-2 text-sm text-[#4d5156]">{metaDesc.slice(0, 160)}{metaDesc.length > 160 ? "..." : ""}</p>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Status</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status produk">
                {(["aktif", "draf", "arsip"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={v.status === s} onClick={() => set("status", s)} className={cn("rounded-lg border-2 px-3 py-2 text-left text-sm", v.status === s ? "border-kopi bg-porselen" : "border-garis")}>
                    <span className="block font-semibold capitalize">{s}</span>
                    <span className="block text-xs text-abu-hangat">{s === "aktif" ? "Tampil dan bisa dibeli" : s === "draf" ? "Belum tampil di toko" : "Disembunyikan, riwayat tetap ada"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        ) : null}

        <div className="sticky bottom-16 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-garis bg-putih/95 p-3 backdrop-blur lg:bottom-2">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Simpan produk
          </Button>
          {id ? (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await duplicateProductAction(id);
                    if (r.ok) router.push(`/admin/produk/${r.id}?baru=salinan`);
                    else setMessage({ ok: false, text: r.message });
                  })
                }
              >
                <Copy /> Duplikat
              </Button>
              {hasOrders ? (
                <Button variant="ghost" onClick={() => (set("status", "arsip"), setTab("seo"))}>
                  <Archive /> Arsipkan
                </Button>
              ) : (
                <Button variant="ghost" className="text-bahaya" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Hapus
                </Button>
              )}
            </>
          ) : null}
          <Link href="/admin/produk" className="ml-auto text-sm font-medium text-abu-hangat hover:text-kopi">
            Kembali ke daftar
          </Link>
          {message ? (
            <p className={cn("w-full text-sm", message.ok ? "text-sukses" : "text-bahaya")} role={message.ok ? "status" : "alert"}>
              {message.text}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start" aria-label="Pratinjau ProductArt">
        <div className="rounded-xl border border-garis bg-putih p-4">
          <p className="text-xs font-semibold tracking-wide text-abu-hangat uppercase">Pratinjau langsung</p>
          <div className="mx-auto mt-2 w-48" data-testid="pratinjau-productart">
            <ProductArt packaging={v.packaging} shade={/^#[0-9a-f]{6}$/i.test(preview?.hex ?? "") ? preview!.hex : "#D9A98B"} brandColor={brand?.color ?? "#B8475D"} brandName={brand?.name ?? "Rona"} title={`Pratinjau ${v.name}`} />
          </div>
          <p className="mt-2 text-center text-sm font-medium">{v.name || "Nama produk"}</p>
          <p className="text-center text-xs text-abu-hangat">
            {brand?.name} · {preview?.shadeName || "Shade"}
          </p>
          {preview && Number(preview.salePrice) > 0 ? (
            <p className="mt-1 text-center text-sm font-semibold tabular-nums">
              {formatRupiah(Number(preview.salePrice))}
              {Number(preview.normalPrice) > Number(preview.salePrice) ? <s className="ml-1.5 text-xs font-normal text-abu-hangat">{formatRupiah(Number(preview.normalPrice))}</s> : null}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {rows.map((r) => (
              <button key={r.key} type="button" onClick={() => setPreviewKey(r.key)} className={cn("size-7 rounded-full border-2", (previewKey ?? rows[0].key) === r.key ? "border-kopi" : "border-garis")} style={{ background: /^#[0-9a-f]{6}$/i.test(r.hex) ? r.hex : "#fff" }} aria-label={`Pratinjau ${r.shadeName || "varian"}`} />
            ))}
          </div>
        </div>
        {id && v.status === "aktif" ? (
          <Link href={`/p/${initial.slug}`} target="_blank" className="block text-center text-sm font-semibold text-rona hover:underline">
            Buka di toko
          </Link>
        ) : null}
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus produk ini?"
        description="Produk belum pernah dipesan, jadi bisa dihapus permanen beserta variannya."
        confirmLabel="Hapus permanen"
        danger
        onConfirm={async () => {
          if (!id) return null;
          const r = await deleteProductAction(id);
          if (!r.ok) return r.message;
          router.push("/admin/produk");
          return null;
        }}
      />
    </div>
  );
}
