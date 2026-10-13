"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ImageOff, Loader2, Sparkles, Star, X } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { HelpText, Label } from "@/components/ui/input";
import { submitReviewAction } from "@/lib/account/actions";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;
const MIN_LENGTH = 20;
const SKIN = [
  ["normal", "Normal"],
  ["kering", "Kering"],
  ["berminyak", "Berminyak"],
  ["kombinasi", "Kombinasi"],
  ["sensitif", "Sensitif"],
] as const;
const STAR_LABELS = ["", "Kurang", "Biasa", "Lumayan", "Suka", "Suka banget"];

type Item = { orderItemId: number; orderNumber: string; productName: string; productSlug: string; shadeName: string; showShade: boolean; packaging: Parameters<typeof ProductArt>[0]["packaging"]; hex: string; brandName: string; brandColor: string };

// Kompres di browser: sisi terpanjang 1600 px, WebP (JPEG bila browser tidak bisa membuat WebP).
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  const webp = await toBlob("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg", 0.85);
  if (!jpeg) throw new Error("Foto tidak bisa diproses.");
  return jpeg;
}

export function ReviewThanks({ productName, productSlug, orderNumber, bonus }: { productName: string; productSlug: string; orderNumber: string; bonus: number }) {
  return (
    <div className="rounded-card border border-garis bg-putih p-6 text-center" role="status">
      <CheckCircle2 className="mx-auto size-10 text-sukses" aria-hidden />
      <h2 className="mt-3 font-serif text-2xl text-kopi">Terima kasih atas ulasanmu!</h2>
      <p className="mt-1 text-sm text-abu-hangat">Ulasanmu untuk {productName} sudah tayang di halaman produk.</p>
      {bonus > 0 ? (
        <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-pill bg-[#FBF4E6] px-4 py-2 text-sm font-semibold text-kopi" data-testid="bonus-ulasan">
          <Sparkles className="size-4 text-emas" aria-hidden /> +{bonus} poin bonus ulasan pertama
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href={`/p/${productSlug}#ulasan`}>Lihat di halaman produk</Link>
        </Button>
        <Button asChild>
          <Link href={`/pesanan/${orderNumber}`}>Kembali ke pesanan</Link>
        </Button>
      </div>
    </div>
  );
}

export function ReviewForm({ item, defaultSkin, photosEnabled }: { item: Item; defaultSkin: string | null; photosEnabled: boolean }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [skin, setSkin] = useState(defaultSkin ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [done, setDone] = useState<{ bonus: number; slug: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError(null);
    setUploading(true);
    try {
      for (const file of [...files].slice(0, 3 - photos.length)) {
        if (!file.type.startsWith("image/")) {
          setPhotoError("Pilih file gambar, ya.");
          continue;
        }
        const blob = await compress(file);
        const fd = new FormData();
        fd.append("foto", new File([blob], blob.type === "image/webp" ? "foto.webp" : "foto.jpg", { type: blob.type }));
        const res = await fetch("/api/ulasan/foto", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string };
        if (!data.ok || !data.url) setPhotoError(data.message ?? "Foto gagal diunggah.");
        else setPhotos((p) => [...p, data.url!].slice(0, 3));
      }
    } catch {
      setPhotoError("Foto tidak bisa diproses. Coba foto lain.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (done) return <ReviewThanks productName={item.productName} productSlug={done.slug} orderNumber={item.orderNumber} bonus={done.bonus} />;

  const tooShort = body.trim().length < MIN_LENGTH;
  return (
    <form
      className="space-y-5 rounded-card border border-garis bg-putih p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Pilih jumlah bintang dulu.");
        if (tooShort) return setError(`Ceritakan sedikit lagi, minimal ${MIN_LENGTH} karakter.`);
        start(async () => {
          setError(null);
          const r = await submitReviewAction({ orderItemId: item.orderItemId, rating, body, skinType: skin || null, photos });
          if (!r.ok) setError(r.message);
          else setDone({ bonus: r.bonus, slug: r.productSlug });
        });
      }}
    >
      <div className="flex items-center gap-4">
        <span className="w-16 shrink-0 overflow-hidden rounded-xl">
          <ProductArt packaging={item.packaging} shade={item.hex} brandColor={item.brandColor} brandName={item.brandName} title={item.productName} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-abu-hangat">{item.brandName}</p>
          <p className="font-medium text-kopi">{item.productName}</p>
          {item.showShade ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-abu-hangat">
              <span className="size-3 rounded-full border border-garis" style={{ background: item.hex }} aria-hidden /> Shade {item.shadeName}
            </p>
          ) : null}
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-kopi">Nilai produk ini</legend>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Bintang">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} bintang`} onClick={() => setRating(n)} className="rounded-full p-1 transition-transform hover:scale-110">
              <Star className={cn("size-8", n <= rating ? "fill-emas text-emas" : "text-garis")} />
            </button>
          ))}
          <span className="ml-2 text-sm text-abu-hangat">{STAR_LABELS[rating]}</span>
        </div>
      </fieldset>

      <div>
        <Label htmlFor="ul-teks">Ceritakan pengalamanmu</Label>
        <textarea
          id="ul-teks"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1500))}
          rows={5}
          placeholder="Teksturnya, ketahanannya, cocok tidak di kulitmu..."
          className="w-full rounded-[16px] border border-garis bg-putih px-4 py-3 text-base text-kopi outline-none focus-visible:border-rona focus-visible:shadow-ring"
        />
        <HelpText className="tabular-nums">{tooShort ? `Minimal ${MIN_LENGTH} karakter (${body.trim().length}/${MIN_LENGTH}).` : `${body.trim().length} karakter.`}</HelpText>
      </div>

      <div>
        <Label htmlFor="ul-kulit">Jenis kulitmu</Label>
        <select id="ul-kulit" value={skin} onChange={(e) => setSkin(e.target.value)} className="h-11 w-full max-w-xs rounded-pill border border-garis bg-putih px-4 text-base text-kopi outline-none focus-visible:border-rona focus-visible:shadow-ring">
          <option value="">Tidak disebutkan</option>
          {SKIN.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <HelpText>{defaultSkin ? "Terisi dari profil kulitmu, boleh diubah." : "Isi profil kulit di akun supaya terisi otomatis."}</HelpText>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-kopi">Foto (opsional, maksimal 3)</p>
        {photosEnabled ? (
          <>
            <div className="flex flex-wrap gap-2">
              {photos.map((url) => (
                <span key={url} className="relative size-20 overflow-hidden rounded-xl border border-garis">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto ulasan" className="size-full object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((x) => x !== url))} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-kopi/80 text-putih" aria-label="Hapus foto">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              {photos.length < 3 ? (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid size-20 place-items-center rounded-xl border-2 border-dashed border-garis text-abu-hangat hover:border-kopi/30">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                  <span className="sr-only">Tambah foto</span>
                </button>
              ) : null}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
            <HelpText>Foto dikecilkan otomatis sebelum diunggah.</HelpText>
            {photoError ? (
              <HelpText tone="error" role="alert">
                {photoError}
              </HelpText>
            ) : null}
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-porselen px-3 py-2 text-sm text-abu-hangat">
            <ImageOff className="size-4 shrink-0" aria-hidden /> Unggah foto sedang tidak tersedia. Ulasan teksmu tetap bisa dikirim.
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || uploading}>
        {pending ? <Loader2 className="animate-spin" /> : null} Kirim ulasan
      </Button>
    </form>
  );
}
