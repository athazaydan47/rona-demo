"use client";

import { useRef, useState } from "react";
import { ImageUp, Link2, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shrinkImage } from "@/lib/image/shrink";
import { cn } from "@/lib/utils";
import { MEREK } from "@/config/merek";
import { KartuProdukAi, type KartuAi } from "./kartu-produk-ai";
import { judulDupe } from "@/lib/tanya/kartu";
import { SumberVideoBlok } from "./sumber-video";

type DupeCard = KartuAi & { alasan: string; varianPilihan: number | null };
type Source = { platform: "tiktok" | "youtube"; url: string; title: string; author: string | null; authorUrl: string | null; thumbnailUrl: string | null };
type Result = { ok: true; sumber: Source | null; tipe: "cocok" | "mirip" | "tidak_ada_sejenis" | "tidak_dikenali"; namaTerbaca: string | null; jenisProduk: string | null; produk: DupeCard[] } | { ok: false; message: string; suggestScreenshot?: boolean };


export function DupeFinder() {
  const [tab, setTab] = useState<"link" | "gambar">("link");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (body: () => Promise<RequestInit>) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/dupe", { method: "POST", ...(await body()) });
      setResult((await res.json().catch(() => ({ ok: false, message: "Belum bisa diproses. Coba lagi, ya." }))) as Result);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Koneksi terputus. Coba lagi, ya." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-pill border border-garis bg-putih p-1" role="tablist" aria-label="Cara mencari">
        {(
          [
            ["link", "Tempel link", Link2],
            ["gambar", "Unggah screenshot", ImageUp],
          ] as const
        ).map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-semibold", tab === key ? "bg-kopi text-putih" : "text-kopi")}>
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "link" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) void run(async () => ({ headers: { "content-type": "application/json" }, body: JSON.stringify({ link: link.trim() }) }));
          }}
        >
          <label htmlFor="link-video" className="text-sm font-medium text-kopi">
            Link video TikTok atau YouTube
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="link-video" value={link} onChange={(e) => setLink(e.target.value.slice(0, 500))} inputMode="url" placeholder="https://www.tiktok.com/@kreator/video/..." className="h-11 min-w-0 flex-1 rounded-pill border border-garis bg-putih px-4 text-sm outline-none focus-visible:border-aksen" data-testid="input-link" />
            <Button type="submit" disabled={busy || !link.trim()} data-aksi-utama>
              {busy ? <Loader2 className="animate-spin" /> : <Search />} Cari yang mirip
            </Button>
          </div>
          <p className="text-xs text-abu-hangat">Link Instagram, Shopee, dan lainnya belum bisa dibuka; kirim screenshot-nya saja.</p>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-kopi">Screenshot produk (1 sampai 3 gambar)</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            data-testid="input-screenshot"
            onChange={(e) => {
              setFiles([...(e.target.files ?? [])].slice(0, 3));
              setResult(null);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImageUp /> Pilih gambar
            </Button>
            {files.map((f, i) => (
              <span key={i} className="inline-flex max-w-[180px] items-center gap-1 rounded-pill bg-porselen px-2.5 py-1 text-xs">
                <span className="truncate">{f.name}</span>
                <button type="button" aria-label={`Hapus ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <Button
              disabled={busy || !files.length}
              data-aksi-utama
              onClick={() =>
                void run(async () => {
                  const form = new FormData();
                  for (const f of files) form.append("gambar", await shrinkImage(f), "screenshot.jpg");
                  return { body: form };
                })
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : <Search />} Cari yang mirip
            </Button>
          </div>
          <p className="text-xs text-abu-hangat">Screenshot diperkecil di perangkatmu, diproses, lalu langsung dibuang. Tidak disimpan.</p>
        </div>
      )}

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-abu-hangat" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Membaca produknya dan mencari yang mirip di katalog {MEREK.nama}...
        </p>
      ) : null}

      {result ? (
        <section className="space-y-3" aria-live="polite" data-testid="hasil-dupe">
          {!result.ok ? (
            <div className="rounded-xl bg-[#FBEEDC] px-4 py-3 text-sm text-[#8A5512]" role="status">
              <p>{result.message}</p>
              {result.suggestScreenshot ? (
                <button type="button" onClick={() => setTab("gambar")} className="mt-1 font-semibold underline">
                  Kirim screenshot
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {result.sumber ? <SumberVideoBlok s={result.sumber} /> : null}
              <p className="font-serif text-xl text-kopi" data-testid="judul-hasil-dupe">
                {judulDupe(result)}
              </p>
              {result.tipe === "tidak_dikenali" ? <p className="text-sm text-abu-hangat">Coba kirim screenshot yang lebih jelas, dengan kemasan atau warna produk terlihat, ya.</p> : null}
              {result.produk.length ? (
                <ul className="grid gap-2 md:grid-cols-3">
                  {result.produk.map((p) => (
                    <KartuProdukAi key={p.id} p={p} sumber="cari_video" testId="kartu-dupe" alasanTestId="alasan-dupe" labelTambah="Tambah ke keranjang" />
                  ))}
                </ul>
              ) : null}
              <p className="text-[11px] text-abu-hangat">Dikenali dengan bantuan AI, bisa keliru. Produk, harga, dan stok diambil langsung dari katalog {MEREK.nama}.</p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
