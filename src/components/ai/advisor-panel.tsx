"use client";

// Panel chat asisten (Fase 8C): satu pintu untuk rekomendasi, kuis kulit, rutinitas, padanan shade, cari dari video atau
// screenshot, lacak pesanan, ongkir, cabang, promo, dan bantuan. Dimuat terpisah saat tombol pertama kali dibuka.
// Riwayat percakapan hanya di sesi browser ini. Di HP terbuka sebagai sheet penuh; tombol kembali menutup chat.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { ImagePlus, Loader2, SendHorizontal, ShoppingBag, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, TypingDots } from "@/components/ui/chat-parts";
import { getCartViewAction } from "@/lib/cart/actions";
import { setCartCount } from "@/lib/cart/client-cart";
import { formatRupiah } from "@/lib/format";
import { shrinkImage } from "@/lib/image/shrink";
import { tandaiLangkah } from "@/lib/demo/panduan";
import { CHIP_PEMBUKA, CHIP_PRODUK, type Aksi, type Chip, type Kartu, type TanyaEvent } from "@/lib/tanya/kartu";
import { cn } from "@/lib/utils";
import { MEREK, kunciLokal } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import { KartuTanya } from "@/components/tanya/kartu-tanya";
import type { AdvisorOpenDetail } from "./advisor";

type Message = { role: "user" | "assistant"; text: string; intro?: string; kartu?: Kartu[]; chips?: Chip[]; status?: string; error?: boolean };

const STORAGE_KEY = kunciLokal("tanya");

function loadHistory(): Message[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-20).filter((m) => !m.status) : [];
  } catch {
    return [];
  }
}
function saveHistory(m: Message[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m.slice(-20)));
  } catch {
    // Penyimpanan sesi tidak tersedia: riwayat hanya di memori.
  }
}

type PanelProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  context: AdvisorOpenDetail;
  // Bertambah setiap kali panel dibuka, supaya riwayat dimuat ulang dan prompt awal diisi.
  bukaKe: number;
  resting: string | null;
  hasProfile: boolean;
  ai: boolean;
  aiFoto: boolean;
};

type Keranjang = { jumlah: number; subtotal: number };

export function AdvisorPanel({ open, setOpen, context, bukaKe, resting, hasProfile, ai, aiFoto }: PanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [keranjang, setKeranjang] = useState<Keranjang | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    // Riwayat dan prompt awal dibaca dari luar React (sessionStorage, event) setiap kali panel dibuka.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadHistory());
    if (context.prompt && !context.kirim) setInput(context.prompt);
  }, [bukaKe, context.prompt, context.kirim]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  // Tombol kembali di HP menutup chat, bukan meninggalkan halaman: satu entri riwayat ditambahkan saat chat dibuka.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ ...(window.history.state ?? {}), tanyaRona: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.tanyaRona) window.history.back();
    };
  }, [open, setOpen]);

  const update = (patch: Partial<Message>) =>
    setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  const selesai = () =>
    setMessages((m) => {
      saveHistory(m);
      return m;
    });

  // Satu jalur untuk pesan teks dan aksi: NDJSON dari /api/ai/advisor.
  const jalankan = useCallback(
    async (userText: string, aksi: Aksi | null) => {
      if (busy) return;
      const history: Message[] = [...messagesRef.current, { role: "user", text: userText }];
      tandaiLangkah("advisor");
      setMessages([...history, { role: "assistant", text: "", status: aksi ? "Menyiapkan" : "Membaca pertanyaanmu" }]);
      setBusy(true);
      try {
        const res = await fetch("/api/ai/advisor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pesan: history.filter((h) => h.text).map((h) => ({ role: h.role, text: h.text })), produkId: context.productId ?? null, ...(aksi ? { aksi } : {}) }),
        });
        if (!res.ok || !res.body) {
          const d = (await res.json().catch(() => ({}))) as { message?: string };
          update({ text: d.message ?? `${MEREK.asisten.nama} sedang tidak bisa dihubungi. Coba lagi sebentar lagi, ya.`, status: undefined, error: true });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line) as TanyaEvent;
            if (e.type === "status") update({ status: e.text });
            if (e.type === "pembuka") update({ intro: e.text });
            if (e.type === "reset") {
              text = "";
              update({ text });
            }
            if (e.type === "delta") {
              text += e.text;
              update({ text, status: undefined });
            }
            // Teks akhir dari server menggantikan teks yang dialirkan (sama, kecuali ada kalimat yang dibuang).
            if (e.type === "done") update({ text: e.teks || text, kartu: e.kartu, chips: e.chips, status: undefined, error: e.ok === false });
          }
        }
      } catch {
        update({ text: "Koneksi terputus. Coba kirim lagi, ya.", status: undefined, error: true });
      } finally {
        setBusy(false);
        selesai();
      }
    },
    [busy, context.productId],
  );

  const send = (text: string) => {
    const q = text.trim().slice(0, 600);
    if (!q || busy) return;
    setInput("");
    void jalankan(q, null);
  };
  const aksi = (a: Aksi, label: string) => void jalankan(label, a);

  // Prompt contoh dari panduan demo dan halaman Tentang demo: langsung dikirim.
  const kirimOtomatis = useRef(0);
  useEffect(() => {
    if (!open || !context.kirim || !context.prompt || kirimOtomatis.current === bukaKe) return;
    kirimOtomatis.current = bukaKe;
    const t = window.setTimeout(() => send(context.prompt!), 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bukaKe, context.kirim, context.prompt]);

  // Screenshot (1 sampai 3) dari tombol lampiran atau kartu unggah: alur dupe yang sama dengan halaman Cari dari video.
  const kirimScreenshot = async (files: File[]) => {
    if (busy || !files.length) return;
    const label = files.length === 1 ? "Kirim 1 screenshot" : `Kirim ${files.length} screenshot`;
    setMessages((m) => [...m, { role: "user", text: label }, { role: "assistant", text: "", status: "Membaca screenshot-mu" }]);
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of files.slice(0, 3)) form.append("gambar", await shrinkImage(f), "screenshot.jpg");
      const res = await fetch("/api/ai/dupe", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & Omit<Extract<Kartu, { jenis: "dupe" }>, "jenis">;
      if (!d.ok) update({ text: d.message ?? "Screenshot belum bisa dibaca. Coba lagi, ya.", status: undefined, error: true });
      else update({ text: d.tipe === "tidak_dikenali" ? "Produknya belum bisa kami kenali. Coba screenshot yang menampilkan kemasan atau warnanya dengan jelas, ya." : "", kartu: [{ jenis: "dupe", sumber: null, tipe: d.tipe, namaTerbaca: d.namaTerbaca, jenisProduk: d.jenisProduk, produk: d.produk }], status: undefined });
    } catch (e) {
      update({ text: e instanceof Error ? e.message : "Screenshot belum bisa dikirim.", status: undefined, error: true });
    } finally {
      setBusy(false);
      selesai();
    }
  };

  const onTambah = async () => {
    const view = await getCartViewAction().catch(() => null);
    if (!view) return;
    setCartCount(view.count);
    setKeranjang({ jumlah: view.count, subtotal: view.pricing.subtotal });
  };

  const pembuka = (context.productId ? [...CHIP_PRODUK(context.productId), ...CHIP_PEMBUKA.filter((c) => c.aksi.jenis === "promo")] : CHIP_PEMBUKA).filter((c) => !("butuh" in c) || (c.butuh === "aiFoto" ? aiFoto : c.butuh === "multiCabang" ? fiturAktif("multiCabang") : true));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/30 md:bg-kopi/20" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-porselen outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:shadow-lift" data-testid="panel-advisor">
          <div className="flex items-start justify-between gap-3 border-b border-garis bg-putih px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-1.5 font-serif text-xl text-kopi">
                <Sparkles className="size-4 text-aksen" aria-hidden /> {MEREK.asisten.nama}
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-abu-hangat">{ai ? "Jawaban AI bisa keliru. " : ""}Produk, harga, stok, dan ongkir diambil langsung dari data {MEREK.nama}.</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-porselen" aria-label={`Tutup ${MEREK.asisten.nama}`}>
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4" aria-live="polite">
            {!messages.length ? (
              <div className="rounded-xl bg-putih p-4 text-sm text-kopi" data-testid="layar-pembuka">
                <p className="font-semibold">Hai, aku {MEREK.asisten.nama}. Mau dibantu apa?</p>
                <p className="mt-1 text-abu-hangat">{hasProfile ? "Jawabanku disesuaikan dengan profil kulitmu." : "Tanya soal produk, shade, ongkir, atau pesananmu. Ikut kuis singkat supaya rekomendasinya lebih pas."}</p>
                {context.productName ? <p className="mt-2 text-xs text-abu-hangat">Kamu sedang melihat {context.productName}.</p> : null}
                {!ai ? <p className="mt-2 text-xs text-abu-hangat">AI sedang tidak tersedia. Pilihan di bawah tetap bisa dipakai.</p> : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pembuka.map((c) => (
                    <button key={c.label} type="button" onClick={() => aksi(c.aksi, c.label)} className="rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-aksen/40" data-testid="chip-pembuka">
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <Bubble key={i} side="kanan" className="max-w-[85%]">
                  <p className="rounded-2xl rounded-br-md bg-kopi px-3.5 py-2 text-sm break-words text-putih">{m.text}</p>
                </Bubble>
              ) : (
                <Bubble key={i} className="max-w-full space-y-2" testId="jawaban-advisor">
                  {m.intro ? <p className="px-1 text-xs text-abu-hangat italic">{m.intro}</p> : null}
                  {m.status && !m.text ? <TypingDots status={m.status} /> : m.text ? <p className={cn("max-w-[95%] rounded-2xl rounded-bl-md bg-putih px-3.5 py-2 text-sm whitespace-pre-line text-kopi", m.error && "text-bahaya")}>{m.text}</p> : null}
                  {m.kartu?.map((k, j) => (
                    <KartuTanya key={j} kartu={k} aksi={aksi} onTambah={() => void onTambah()} kirimScreenshot={(f) => void kirimScreenshot(f)} sibuk={busy} />
                  ))}
                  {m.chips?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.chips.map((c) => (
                        <button key={c.label} type="button" disabled={busy} onClick={() => aksi(c.aksi, c.label)} className="rounded-pill border border-garis bg-putih px-3 py-1.5 text-xs font-medium hover:border-aksen/40 disabled:opacity-50" data-testid="chip-lanjut">
                          {c.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </Bubble>
              ),
            )}
          </div>
          {keranjang && keranjang.jumlah > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-garis bg-putih px-4 py-2 text-sm" data-testid="ringkasan-keranjang">
              <span className="flex items-center gap-1.5 text-kopi">
                <ShoppingBag className="size-4 text-aksen" aria-hidden /> {keranjang.jumlah} produk, <span className="font-semibold tabular-nums">{formatRupiah(keranjang.subtotal)}</span>
              </span>
              <span className="flex gap-2">
                <Link href="/keranjang" onClick={() => setOpen(false)} className="text-xs font-semibold text-aksen hover:underline">
                  Lihat keranjang
                </Link>
                <Link href="/checkout" onClick={() => setOpen(false)} className="text-xs font-semibold text-kopi hover:underline" data-testid="lanjut-checkout-chat">
                  Lanjut checkout
                </Link>
              </span>
            </div>
          ) : null}
          <form
            className="border-t border-garis bg-putih p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            {resting ? (
              <p className="mb-2 text-xs text-abu-hangat" role="status">
                {resting}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              {aiFoto ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    data-testid="lampiran-screenshot"
                    onChange={(e) => {
                      const files = [...(e.target.files ?? [])].slice(0, 3);
                      e.target.value = "";
                      void kirimScreenshot(files);
                    }}
                  />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="grid size-11 shrink-0 place-items-center rounded-full border border-garis text-kopi hover:bg-porselen disabled:opacity-50" aria-label="Lampirkan screenshot produk (1 sampai 3)">
                    <ImagePlus className="size-5" />
                  </button>
                </>
              ) : null}
              <input value={input} onChange={(e) => setInput(e.target.value.slice(0, 600))} placeholder={ai ? "Tanya produk, tempel link TikTok, atau lacak pesanan" : "Tulis kota, nomor pesanan, atau pilih di atas"} className="h-11 min-w-0 flex-1 rounded-pill border border-garis bg-porselen px-4 text-sm outline-none focus-visible:border-aksen" aria-label={`Pesan untuk ${MEREK.asisten.nama}`} disabled={busy} />
              <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Kirim">
                {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
