"use client";

// Kartu chat asisten (Fase 8C): satu komponen per jenis hasil. Isinya selalu data server; kartu interaktif (kuis,
// pilih shade, lacak, pilih kota, unggah screenshot) mengirim aksi terstruktur yang ditangani berbasis aturan.
// Dirancang untuk lebar 375 px tanpa geser ke samping.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, Check, Clock, Copy, ExternalLink, ImageUp, Info, Loader2, MapPin, Moon, Navigation, Package, Phone, ShoppingBag, Sun, Truck, Zap } from "lucide-react";
import { KartuProdukAi } from "@/components/ai/kartu-produk-ai";
import { SumberVideoBlok } from "@/components/ai/sumber-video";
import { SkinFit } from "@/components/product/skin-fit";
import { FaceArt, FromPhotoBadge } from "@/components/quiz/skin-quiz";
import { PhotoAssist } from "@/components/quiz/photo-assist";
import { Button } from "@/components/ui/button";
import type { QuizSuggestion } from "@/lib/ai/skin-photo";
import { addManyToCart } from "@/lib/cart/client-cart";
import { formatRupiah } from "@/lib/format";
import { depthLabels, undertoneGuide } from "@/lib/shade";
import { saveQuizAction, shadeSourcesAction, type ShadeSourceProduct } from "@/lib/skin/actions";
import { BUDGET_OPTIONS, CONCERN_OPTIONS, ROUTINE_OPTIONS, SENSITIVITY_OPTIONS, SKIN_TYPE_OPTIONS } from "@/lib/skin/options";
import type { QuizAnswers } from "@/lib/skin/profile";
import { judulDupe, type Aksi, type Kartu, type LangkahRutinitas, type ProdukKartu } from "@/lib/tanya/kartu";
import { cn } from "@/lib/utils";
import { MEREK } from "@/config/merek";

export type KartuProps = { aksi: (a: Aksi, label: string) => void; onTambah: () => void; kirimScreenshot: (files: File[]) => void; sibuk: boolean };

const card = "rounded-xl border border-garis bg-putih p-3";
const chip = "inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium text-kopi hover:border-aksen/40 disabled:opacity-50";
const stokCatatan = (p: ProdukKartu) => (p.stokOnline > 0 ? `Stok online ${p.stokOnline}` : p.cabang.length ? `Ada di ${p.cabang.slice(0, 2).join(", ")}` : "Sedang habis");

function DaftarProduk({ produk, sumber, testId, alasanTestId, labelTambah, onTambah }: { produk: ProdukKartu[]; sumber: "advisor" | "cari_video" | "padanan_shade"; testId: string; alasanTestId: string; labelTambah: string; onTambah: () => void }) {
  return (
    <ul className="space-y-2">
      {produk.map((p) => (
        <KartuProdukAi key={`${p.id}-${p.varianPilihan ?? ""}`} p={p} sumber={sumber} testId={testId} alasanTestId={alasanTestId} labelTambah={labelTambah} ringkas catatan={stokCatatan(p)} onTambah={onTambah} />
      ))}
    </ul>
  );
}

// ---------- Unggah screenshot (1 sampai 3) ----------

function TombolScreenshot({ kirim, sibuk, label = "Kirim screenshot" }: { kirim: (files: File[]) => void; sibuk: boolean; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="input-screenshot-chat"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].slice(0, 3);
          if (files.length) kirim(files);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => ref.current?.click()}>
        <ImageUp /> {label}
      </Button>
    </>
  );
}

// ---------- Rutinitas ----------

function KartuRutinitas({ data, onTambah }: { data: Extract<Kartu, { jenis: "rutinitas" }>["data"]; onTambah: () => void }) {
  const [mode, setMode] = useState(data.defaultMode);
  const [waktu, setWaktu] = useState<"pagi" | "malam">("pagi");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "fail"; msg?: string }>({ kind: "idle" });
  const steps: LangkahRutinitas[] = mode === "inti" ? data.inti : waktu === "pagi" ? data.pagi : data.malam;
  const main = (s: LangkahRutinitas[]) => s.map((x) => x.options[0]).filter(Boolean);
  const sum = (s: LangkahRutinitas[]) => [...new Map(main(s).map((p) => [p.variantId, p.price])).values()].reduce((a, b) => a + b, 0);
  const chosen = mode === "inti" ? main(data.inti) : [...main(data.pagi), ...main(data.malam)];
  const unique = [...new Map(chosen.map((p) => [p.variantId, p])).values()];
  const warnings = mode === "inti" ? data.intiWarnings : data.warnings;
  return (
    <div className={cn(card, "space-y-3")} data-testid="kartu-rutinitas">
      <p className="text-xs text-abu-hangat">{data.ringkasan}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pilihan rutinitas">
        {(
          [
            ["lengkap", "Lengkap", sum(data.pagi) + sum(data.malam)],
            ["inti", "Mulai dari yang penting", sum(data.inti)],
          ] as const
        ).map(([v, l, price]) => (
          <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn("rounded-pill border px-3 py-1.5 text-xs", mode === v ? "border-kopi bg-kopi text-putih" : "border-garis bg-porselen")} data-testid={`mode-${v}`}>
            <span className="font-semibold">{l}</span> <span className="tabular-nums opacity-80">{formatRupiah(price)}</span>
          </button>
        ))}
      </div>
      {mode === "lengkap" ? (
        <div className="flex gap-1.5" role="tablist" aria-label="Waktu pemakaian">
          {(["pagi", "malam"] as const).map((w) => (
            <button key={w} type="button" role="tab" aria-selected={waktu === w} onClick={() => setWaktu(w)} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold", waktu === w ? "bg-blush text-kopi" : "text-abu-hangat")}>
              {w === "pagi" ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />} {w === "pagi" ? "Pagi" : "Malam"}
              <span className="font-normal tabular-nums" data-testid={`subtotal-${w}`}>
                {formatRupiah(sum(w === "pagi" ? data.pagi : data.malam))}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-abu-hangat">Pembersih, pelembap, dan sunscreen dulu. Tambah serum atau toner nanti setelah kulitmu terbiasa.</p>
      )}
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const p = s.options[0];
          return (
            <li key={`${s.key}-${i}`} className="flex items-baseline gap-2 text-sm" data-testid="langkah-rutinitas">
              <span className="w-4 shrink-0 text-xs font-semibold text-abu-hangat">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{s.label}</span>
                <Link href={`/p/${p.slug}`} className="font-medium text-kopi hover:underline">
                  {p.name}
                </Link>
                {p.onlineStock <= 0 ? <span className="ml-1 text-[11px] text-bahaya">stok online habis</span> : null}
              </span>
              <span className="shrink-0 text-xs font-semibold text-kopi tabular-nums">{formatRupiah(p.price)}</span>
            </li>
          );
        })}
      </ol>
      {warnings.length ? (
        <ul className="space-y-1 rounded-lg bg-[#FBEEDC] px-3 py-2 text-xs text-[#8A5512]" data-testid="peringatan-bahan">
          {warnings.map((w) => (
            <li key={w.id} className="flex gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w.text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={state.kind === "busy"}
          data-testid="tambah-semua"
          onClick={async () => {
            setState({ kind: "busy" });
            const r = await addManyToCart(unique.filter((p) => p.onlineStock > 0).map((p) => ({ variantId: p.variantId, quantity: 1 })), { source: "rutinitas", openDrawer: false });
            setState({ kind: r.ok ? "ok" : "fail", msg: r.ok ? (r.message ?? "Semua masuk keranjang") : (r.message ?? "Gagal menambah") });
            if (r.ok) onTambah();
          }}
        >
          {state.kind === "busy" ? <Loader2 className="animate-spin" /> : <ShoppingBag />} Tambah semua ke keranjang
        </Button>
        <Link href="/rutinitas" className="text-xs font-semibold text-aksen hover:underline">
          Lihat versi lengkap
        </Link>
      </div>
      {state.msg ? (
        <p className={cn("text-xs", state.kind === "ok" ? "text-sukses" : "text-bahaya")} role="status">
          {state.msg}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Kuis kulit di chat ----------

type Langkah = { key: keyof QuizAnswers; tanya: string; multi?: boolean; opsi: { value: string | number; label: string; gambar?: React.ReactNode }[] };
const LANGKAH_KUIS: Langkah[] = [
  { key: "skinType", tanya: "Jenis kulitmu yang mana?", opsi: SKIN_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label, gambar: <FaceArt kind={o.value} className="size-6" /> })) },
  { key: "concerns", tanya: "Apa yang ingin kamu perbaiki? Boleh pilih sampai 3.", multi: true, opsi: CONCERN_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  { key: "sensitivity", tanya: "Seberapa sering kulitmu bereaksi pada produk baru?", opsi: SENSITIVITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  { key: "budget", tanya: "Budget per produk?", opsi: BUDGET_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  { key: "depth", tanya: "Warna kulitmu (lihat rahang di cahaya alami)?", opsi: depthLabels.map((d) => ({ value: d.depth, label: d.label, gambar: <span className="size-4 rounded-full border border-garis" style={{ background: d.hex }} aria-hidden /> })) },
  { key: "undertone", tanya: "Undertone kulitmu?", opsi: undertoneGuide.map((u) => ({ value: u.value, label: u.label, gambar: <span className="size-4 rounded-full border border-garis" style={{ background: u.hex }} aria-hidden /> })) },
  { key: "routine", tanya: "Rutinitasmu sekarang?", opsi: ROUTINE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
];

function KartuKuis({ awal, foto, aksi }: { awal: QuizAnswers; foto: boolean; aksi: KartuProps["aksi"] }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(awal);
  const [dariFoto, setDariFoto] = useState<Set<keyof QuizAnswers>>(new Set());
  const [modeFoto, setModeFoto] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const L = LANGKAH_KUIS[step];
  const set = (patch: Partial<QuizAnswers>) => {
    setA((x) => ({ ...x, ...patch }));
    setDariFoto((f) => {
      const n = new Set(f);
      for (const k of Object.keys(patch) as (keyof QuizAnswers)[]) n.delete(k);
      return n;
    });
  };
  const lanjut = () => setStep((s) => Math.min(LANGKAH_KUIS.length, s + 1));
  const simpan = () =>
    run(async () => {
      setError(null);
      const r = await saveQuizAction(a);
      if (!r.ok) {
        setError(r.message ?? "Gagal menyimpan.");
        setStep(0);
        return;
      }
      setSelesai(true);
      aksi({ jenis: "rutinitas" }, "Lihat rutinitasku");
    });
  if (selesai) return <p className={cn(card, "flex items-center gap-1.5 text-sm text-sukses")} data-testid="kuis-chat"><Check className="size-4" aria-hidden /> Profil kulitmu tersimpan.</p>;
  if (modeFoto)
    return (
      <div className={card} data-testid="kuis-chat">
        <PhotoAssist
          onApply={(s: QuizSuggestion) => {
            setA((x) => ({ ...x, ...s.answers }));
            setDariFoto(new Set(s.fromPhoto));
            setModeFoto(false);
            setStep(0);
          }}
          onManual={() => setModeFoto(false)}
        />
      </div>
    );
  return (
    <div className={cn(card, "space-y-2.5")} data-testid="kuis-chat">
      <div className="flex gap-1" aria-hidden>
        {LANGKAH_KUIS.map((s, i) => (
          <span key={s.key} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-aksen" : "bg-garis")} />
        ))}
      </div>
      {step < LANGKAH_KUIS.length ? (
        <>
          <p className="text-sm font-semibold text-kopi">
            {step + 1}. {L.tanya}
          </p>
          {dariFoto.has(L.key) ? (
            <p className="flex flex-wrap items-center gap-1 text-xs text-abu-hangat">
              <FromPhotoBadge /> Usulan dari fotomu sudah terpilih. Konfirmasi atau ganti.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {L.opsi.map((o) => {
              const v = a[L.key];
              const on = L.multi ? ((v as string[] | undefined) ?? []).includes(o.value as string) : v === o.value;
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  aria-pressed={on}
                  data-testid={`kuis-${L.key}-${o.value}`}
                  className={cn(chip, on && "border-kopi bg-kopi text-putih")}
                  onClick={() => {
                    if (L.multi) {
                      const cur = ((a[L.key] as string[] | undefined) ?? []).filter((x) => x !== o.value);
                      set({ [L.key]: on ? cur : [...cur, o.value as string].slice(0, 3) });
                    } else {
                      set({ [L.key]: o.value });
                      lanjut();
                    }
                  }}
                >
                  {o.gambar}
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {L.multi || dariFoto.has(L.key) ? (
              <Button size="sm" onClick={lanjut} data-testid="kuis-lanjut">
                {L.multi && !((a.concerns ?? []).length) ? "Lewati" : "Lanjut"}
              </Button>
            ) : (
              <button type="button" onClick={lanjut} className="text-xs font-semibold text-abu-hangat hover:text-kopi" data-testid="kuis-lewati">
                Lewati
              </button>
            )}
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="text-xs text-abu-hangat hover:text-kopi">
                Kembali
              </button>
            ) : null}
            {foto && step === 0 && !dariFoto.size ? (
              <button type="button" onClick={() => setModeFoto(true)} className={chip} data-testid="kuis-foto">
                <Camera className="size-3.5 text-aksen" aria-hidden /> Bantu isi dari foto
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-kopi">Sudah cukup. Simpan jawabanmu untuk menyusun rutinitas pagi dan malam.</p>
          <Button size="sm" disabled={pending} onClick={simpan} data-testid="kuis-simpan">
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Simpan dan lihat rutinitas
          </Button>
        </div>
      )}
      {error ? (
        <p className="text-xs text-bahaya" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-[11px] text-abu-hangat">Hasil kuis dipakai untuk saran produk, bukan diagnosis. Disimpan di profil yang sama dengan Kuis Kulit.</p>
    </div>
  );
}

// ---------- Pilih shade ----------

function PilihShade({ aksi }: { aksi: KartuProps["aksi"] }) {
  const [sources, setSources] = useState<ShadeSourceProduct[] | null>(null);
  const [produkId, setProdukId] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void shadeSourcesAction(null).then((s) => alive && setSources(s));
    return () => {
      alive = false;
    };
  }, []);
  const p = sources?.find((x) => x.id === produkId) ?? null;
  return (
    <div className={cn(card, "space-y-2")} data-testid="pilih-shade">
      {!sources ? (
        <p className="flex items-center gap-2 text-xs text-abu-hangat">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Memuat produk
        </p>
      ) : (
        <select value={produkId ?? ""} onChange={(e) => setProdukId(Number(e.target.value) || null)} className="h-10 w-full rounded-lg border border-garis bg-putih px-2 text-sm" aria-label="Produk yang biasa kamu pakai">
          <option value="">Pilih produk yang biasa kamu pakai</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {p ? (
        <div className="flex flex-wrap gap-1.5" aria-label={`Shade ${p.name}`}>
          {p.variants.map((v) => (
            <button key={v.id} type="button" className={chip} onClick={() => aksi({ jenis: "shade", varianId: v.id }, `${p.name}, shade ${v.shadeName}`)}>
              <span className="size-3.5 rounded-full border border-garis" style={{ background: v.hex }} aria-hidden /> {v.shadeName}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Lacak ----------

function FormLacak({ k, aksi, sibuk }: { k: Extract<Kartu, { jenis: "form_lacak" }>; aksi: KartuProps["aksi"]; sibuk: boolean }) {
  const [nomor, setNomor] = useState(k.nomor ?? "");
  const [wa, setWa] = useState("");
  return (
    <form
      className={cn(card, "space-y-2")}
      data-testid="form-lacak-chat"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nomor.trim()) return;
        // Nomor WA tidak ditampilkan di gelembung obrolan dan tidak masuk riwayat yang dikirim ke model.
        aksi({ jenis: "lacak", nomor: nomor.trim().toUpperCase(), ...(wa.trim() ? { wa: wa.trim() } : {}) }, `Lacak ${nomor.trim().toUpperCase()}`);
      }}
    >
      {k.pesanan?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {k.pesanan.map((p) => (
            <button key={p.nomor} type="button" className={chip} disabled={sibuk} onClick={() => aksi({ jenis: "lacak", nomor: p.nomor }, `Lacak ${p.nomor}`)}>
              <Package className="size-3.5" aria-hidden /> {p.nomor}
            </button>
          ))}
        </div>
      ) : null}
      <label className="block text-xs font-medium text-kopi">
        Nomor pesanan
        <input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder={`${MEREK.prefiksPesanan}-2610-000123`} autoCapitalize="characters" className="mt-1 h-10 w-full rounded-lg border border-garis bg-porselen px-3 text-sm uppercase" />
      </label>
      <label className="block text-xs font-medium text-kopi">
        Nomor WhatsApp saat memesan{k.masuk ? " (tidak perlu untuk pesanan di akunmu)" : ""}
        <input value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" className="mt-1 h-10 w-full rounded-lg border border-garis bg-porselen px-3 text-sm" />
      </label>
      <Button type="submit" size="sm" disabled={sibuk || !nomor.trim() || (!k.masuk && !wa.trim())} data-testid="kirim-lacak">
        Lacak
      </Button>
    </form>
  );
}

function KartuPesanan({ d }: { d: Extract<Kartu, { jenis: "pesanan" }>["data"] }) {
  return (
    <div className={cn(card, "space-y-2")} data-testid="kartu-pesanan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-kopi">{d.nomor}</p>
        <span className="rounded-pill bg-blush px-2.5 py-0.5 text-xs font-semibold text-kopi" data-testid="status-pesanan-chat">
          {d.statusLabel}
        </span>
      </div>
      <p className="text-xs text-abu-hangat">
        {d.metode === "ambil" ? `Ambil di ${d.cabang}` : `Kirim${d.kurir ? ` dengan ${d.kurir}` : ""}`}
        {d.resi ? `, resi ${d.resi}` : ""}. {d.jumlahBarang} barang, {formatRupiah(d.total)}. Dibuat {d.dibuat}.
      </p>
      <ol className="space-y-1 border-l-2 border-garis pl-3">
        {d.lini.map((l, i) => (
          <li key={i} className="text-xs">
            <span className="font-semibold text-kopi">{l.label}</span> <span className="text-abu-hangat">{l.waktu}</span>
          </li>
        ))}
      </ol>
      <Link href={d.href} className="inline-flex items-center gap-1 text-xs font-semibold text-aksen hover:underline">
        Buka halaman pesanan
      </Link>
    </div>
  );
}

// ---------- Ongkir ----------

function PilihKota({ k, aksi, sibuk }: { k: Extract<Kartu, { jenis: "pilih_kota" }>; aksi: KartuProps["aksi"]; sibuk: boolean }) {
  const [kota, setKota] = useState("");
  return (
    <div className={cn(card, "space-y-2")} data-testid="pilih-kota">
      <div className="flex flex-wrap gap-1.5">
        {k.pilihan.map((c) => (
          <button key={c.kode} type="button" className={chip} disabled={sibuk} onClick={() => aksi({ jenis: "ongkir", kode: c.kode }, `Ongkir ke ${c.nama}`)}>
            {c.nama}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (kota.trim()) aksi({ jenis: "ongkir", kota: kota.trim() }, `Ongkir ke ${kota.trim()}`);
        }}
      >
        <input value={kota} onChange={(e) => setKota(e.target.value.slice(0, 60))} placeholder="Kota atau kabupaten lain" aria-label="Kota tujuan" className="h-9 min-w-0 flex-1 rounded-lg border border-garis bg-porselen px-3 text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={sibuk || !kota.trim()}>
          Cek
        </Button>
      </form>
    </div>
  );
}

function KartuOngkir({ d }: { d: Extract<Kartu, { jenis: "ongkir" }>["data"] }) {
  return (
    <div className={cn(card, "space-y-2")} data-testid="kartu-ongkir">
      <p className="text-sm font-semibold text-kopi">
        {d.kota}
        {d.provinsi && d.provinsi !== d.kota ? `, ${d.provinsi}` : ""} <span className="text-xs font-normal text-abu-hangat">({d.zona})</span>
      </p>
      <ul className="divide-y divide-garis">
        {d.opsi.map((o, i) => (
          <li key={o.kode} className="flex items-center gap-2 py-1.5 text-sm" data-testid="opsi-ongkir">
            <Truck className={cn("size-4 shrink-0", i === 0 ? "text-aksen" : "text-abu-hangat")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-kopi">{o.nama}</span>
              <span className="block text-xs text-abu-hangat">{o.eta}</span>
            </span>
            <span className="font-semibold text-kopi tabular-nums">{formatRupiah(o.harga)}</span>
          </li>
        ))}
        {d.ambilDiToko ? (
          <li className="flex items-center gap-2 py-1.5 text-sm">
            <MapPin className="size-4 shrink-0 text-sukses" aria-hidden />
            <span className="min-w-0 flex-1 font-medium text-kopi">Ambil di Toko</span>
            <span className="font-semibold text-sukses">Gratis</span>
          </li>
        ) : null}
      </ul>
      <p className="text-[11px] text-abu-hangat">
        Untuk paket sekitar {d.beratGram} gram. {d.gratisOngkir} Angka pasti tampil di checkout.{" "}
        <Link href="/cek-ongkir" className="font-semibold text-aksen hover:underline">
          Hitung berat lain
        </Link>
      </p>
    </div>
  );
}

// ---------- Cabang, promo, info, cocok ----------

function KartuCabang({ cabang }: { cabang: Extract<Kartu, { jenis: "cabang" }>["cabang"] }) {
  return (
    <ul className="space-y-2" data-testid="kartu-cabang">
      {cabang.map((c) => (
        <li key={c.slug} className={cn(card, "space-y-1 text-sm")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-kopi">{c.nama}</p>
            <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-semibold", c.bukaSekarang ? "bg-[#E5F2EA] text-sukses" : "bg-garis/60 text-abu-hangat")}>{c.bukaSekarang ? "Buka sekarang" : "Tutup"}</span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-abu-hangat">
            <Clock className="size-3.5 shrink-0" aria-hidden /> {c.hariIni}
          </p>
          <p className="flex items-start gap-1.5 text-xs text-abu-hangat">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {c.alamat}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={c.rute} target="_blank" rel="noopener noreferrer" className={chip}>
              <Navigation className="size-3.5" aria-hidden /> Rute
            </a>
            {c.telepon ? (
              <a href={`tel:${c.telepon.replace(/[^\d+]/g, "")}`} className={chip}>
                <Phone className="size-3.5" aria-hidden /> Telepon
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function KartuPromo({ k, onTambah }: { k: Extract<Kartu, { jenis: "promo" }>; onTambah: () => void }) {
  const [disalin, setDisalin] = useState<string | null>(null);
  return (
    <div className="space-y-2" data-testid="kartu-promo">
      {k.flash ? (
        <div className={cn(card, "space-y-2")}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-kopi">
            <Zap className="size-4 text-aksen" aria-hidden /> {k.flash.nama}
          </p>
          <p className="text-xs text-abu-hangat">{k.flash.berjalan ? `Berakhir ${k.flash.selesai}` : `Mulai ${k.flash.mulai}`}</p>
          <DaftarProduk produk={k.flash.item.map((i) => ({ ...i.produk, alasan: k.flash!.berjalan ? `Harga flash ${formatRupiah(i.hargaFlash)}, sisa kuota ${i.sisa}` : `Harga flash nanti ${formatRupiah(i.hargaFlash)}` }))} sumber="advisor" testId="kartu-flash" alasanTestId="alasan-flash" labelTambah="Tambah" onTambah={onTambah} />
          <Link href="/flash-sale" className="text-xs font-semibold text-aksen hover:underline">
            Lihat semua flash sale
          </Link>
        </div>
      ) : null}
      {k.voucher.map((v) => (
        <div key={v.kode} className={cn(card, "flex items-start gap-2 text-sm")} data-testid="voucher-publik">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-kopi">{v.judul}</p>
            <p className="text-xs text-abu-hangat">{v.deskripsi}</p>
          </div>
          <button
            type="button"
            className={cn(chip, "shrink-0 font-semibold tracking-wide")}
            onClick={() => {
              void navigator.clipboard?.writeText(v.kode).catch(() => {});
              setDisalin(v.kode);
            }}
            aria-label={`Salin kode ${v.kode}`}
          >
            {disalin === v.kode ? <Check className="size-3.5 text-sukses" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {v.kode}
          </button>
        </div>
      ))}
    </div>
  );
}

export function KartuTanya({ kartu: k, aksi, onTambah, kirimScreenshot, sibuk }: KartuProps & { kartu: Kartu }) {
  switch (k.jenis) {
    case "produk":
      return (
        <div className="space-y-2">
          <DaftarProduk produk={k.produk} sumber="advisor" testId="kartu-advisor" alasanTestId="alasan-advisor" labelTambah="Tambah" onTambah={onTambah} />
          {k.total && k.produk.length > 1 ? (
            <p className="px-1 text-xs text-abu-hangat" data-testid="total-advisor">
              Total {k.produk.length} produk: <span className="font-semibold text-kopi tabular-nums">{formatRupiah(k.total)}</span>
            </p>
          ) : null}
        </div>
      );
    case "dupe":
      return (
        <div className="space-y-2" data-testid="hasil-dupe">
          {k.sumber ? <SumberVideoBlok s={k.sumber} /> : null}
          <p className="px-1 font-serif text-lg text-kopi" data-testid="judul-hasil-dupe">
            {judulDupe(k)}
          </p>
          {k.produk.length ? <DaftarProduk produk={k.produk} sumber="cari_video" testId="kartu-dupe" alasanTestId="alasan-dupe" labelTambah="Tambah ke keranjang" onTambah={onTambah} /> : null}
          <p className="px-1 text-[11px] text-abu-hangat">Dikenali dengan bantuan AI, bisa keliru. Produk, harga, dan stok diambil langsung dari katalog {MEREK.nama}.</p>
        </div>
      );
    case "unggah":
    case "video":
      return (
        <div className={cn(card, "space-y-2")} data-testid={k.jenis === "unggah" ? "kartu-unggah" : "kartu-video"}>
          <p className="text-sm text-kopi">{k.jenis === "unggah" ? k.alasan : "Tempel link TikTok atau YouTube di kolom pesan, atau kirim 1 sampai 3 screenshot produknya."}</p>
          <TombolScreenshot kirim={kirimScreenshot} sibuk={sibuk} />
          <p className="text-[11px] text-abu-hangat">Screenshot hanya diproses lalu dibuang, tidak disimpan.</p>
        </div>
      );
    case "rutinitas":
      return <KartuRutinitas data={k.data} onTambah={onTambah} />;
    case "kuis":
      return <KartuKuis awal={k.awal} foto={k.foto} aksi={aksi} />;
    case "shade":
      return (
        <div className="space-y-2" data-testid="kartu-shade">
          <p className="flex items-center gap-2 px-1 text-xs text-abu-hangat">
            <span className="size-4 rounded-full border border-garis" style={{ background: k.sumber.hex }} aria-hidden /> Shade-mu: {k.sumber.produk}, {k.sumber.shade}
          </p>
          <DaftarProduk produk={k.hasil.map((h) => h.produk)} sumber="padanan_shade" testId="hasil-shade" alasanTestId="alasan-shade" labelTambah="Tambah" onTambah={onTambah} />
        </div>
      );
    case "pilih_shade":
      return <PilihShade aksi={aksi} />;
    case "pesanan":
      return <KartuPesanan d={k.data} />;
    case "form_lacak":
      return <FormLacak k={k} aksi={aksi} sibuk={sibuk} />;
    case "ongkir":
      return <KartuOngkir d={k.data} />;
    case "pilih_kota":
      return <PilihKota k={k} aksi={aksi} sibuk={sibuk} />;
    case "cabang":
      return <KartuCabang cabang={k.cabang} />;
    case "promo":
      return <KartuPromo k={k} onTambah={onTambah} />;
    case "info":
      return (
        <div className={cn(card, "space-y-1.5 text-sm")} data-testid="kartu-info">
          {k.paragraf.length ? <p className="font-semibold text-kopi">{k.judul}</p> : null}
          {k.paragraf.map((p, i) => (
            <p key={i} className="text-kopi/90">
              {p}
            </p>
          ))}
          {k.tautan ? (
            <Link href={k.tautan.href} className="inline-flex items-center gap-1 text-xs font-semibold text-aksen hover:underline">
              {k.tautan.label} {k.tautan.href.startsWith("http") ? <ExternalLink className="size-3" aria-hidden /> : null}
            </Link>
          ) : null}
        </div>
      );
    case "cocok":
      return (
        <div className="space-y-1.5" data-testid="kartu-cocok">
          <Link href={`/p/${k.produk.slug}`} className="px-1 text-sm font-semibold text-kopi hover:underline">
            {k.produk.nama}
          </Link>
          <SkinFit fit={k.fit} />
        </div>
      );
  }
}
