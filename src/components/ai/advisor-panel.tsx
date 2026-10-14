"use client";

// Panel percakapan Advisor (Fase 8B): dimuat terpisah saat tombol Advisor pertama kali dibuka, supaya kode chat,
// dialog, dan kartu produk tidak ikut dimuat di setiap halaman.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Clapperboard, Loader2, SendHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, TypingDots } from "@/components/ui/chat-parts";
import { formatRupiah } from "@/lib/format";
import { tandaiLangkah } from "@/lib/demo/panduan";
import { cn } from "@/lib/utils";
import { MEREK, kunciLokal } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import type { AdvisorOpenDetail } from "./advisor";
import { KartuProdukAi, type KartuAi } from "./kartu-produk-ai";

type AdvisorCard = KartuAi & { cabang: string[] };
type Message = { role: "user" | "assistant"; text: string; intro?: string; products?: AdvisorCard[]; total?: number | null; status?: string; error?: boolean };

const SUGGESTIONS = ["Sunscreen untuk kulit berminyak", "Cari padanan shade cushion-ku", "Kado di bawah 200 ribu", "Ada di cabang terdekat?"];
const STORAGE_KEY = kunciLokal("advisor");

function loadHistory(): Message[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
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
};

export function AdvisorPanel({ open, setOpen, context, bukaKe, resting, hasProfile }: PanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Riwayat dan prompt awal dibaca dari luar React (sessionStorage, event) setiap kali panel dibuka.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadHistory());
    if (context.prompt) setInput(context.prompt);
  }, [bukaKe, context.prompt]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim().slice(0, 600);
    if (!q || busy) return;
    const history: Message[] = [...messages, { role: "user", text: q }];
    const pending: Message = { role: "assistant", text: "", status: "Membaca pertanyaanmu" };
    tandaiLangkah("advisor");
    setMessages([...history, pending]);
    setInput("");
    setBusy(true);
    const update = (patch: Partial<Message>) =>
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pesan: history.map((h) => ({ role: h.role, text: h.text })), produkId: context.productId ?? null }),
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
          const e = JSON.parse(line) as { type: string; text?: string; teks?: string; produk?: AdvisorCard[]; total?: number | null; ok?: boolean };
          if (e.type === "status") update({ status: e.text });
          if (e.type === "pembuka") update({ intro: e.text });
          if (e.type === "reset") {
            text = "";
            update({ text });
          }
          if (e.type === "delta") {
            text += e.text ?? "";
            update({ text, status: undefined });
          }
          // Teks akhir dari server menggantikan teks yang dialirkan (sama, kecuali ada kalimat yang dibuang).
          if (e.type === "done") update({ text: e.teks ?? text, products: e.produk ?? [], total: e.total ?? null, status: undefined, error: e.ok === false });
        }
      }
    } catch {
      update({ text: "Koneksi terputus. Coba kirim lagi, ya.", status: undefined, error: true });
    } finally {
      setBusy(false);
      setMessages((m) => {
        saveHistory(m);
        return m;
      });
    }
  };

  return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/30 md:bg-kopi/20" />
          <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-porselen outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:shadow-lift" data-testid="panel-advisor">
            <div className="flex items-start justify-between gap-3 border-b border-garis bg-putih px-4 py-3">
              <div>
                <Dialog.Title className="flex items-center gap-1.5 font-serif text-xl text-kopi">
                  <Sparkles className="size-4 text-aksen" aria-hidden /> {MEREK.asisten.nama}
                </Dialog.Title>
                <Dialog.Description className="text-[11px] text-abu-hangat">Jawaban AI bisa keliru. Produk dan harga diambil langsung dari katalog {MEREK.nama}.</Dialog.Description>
              </div>
              <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-porselen" aria-label={`Tutup ${MEREK.asisten.nama}`}>
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {!messages.length ? (
                <div className="rounded-xl bg-putih p-4 text-sm text-kopi">
                  <p className="font-semibold">Hai, mau cari apa hari ini?</p>
                  <p className="mt-1 text-abu-hangat">
                    {hasProfile ? "Jawabanku disesuaikan dengan profil kulitmu." : `Aku bantu pilih produk dari katalog ${MEREK.nama}. Ikut `}
                    {hasProfile ? null : (
                      <Link href="/kuis-kulit" className="font-semibold text-aksen hover:underline">
                        Kuis Kulit
                      </Link>
                    )}
                    {hasProfile ? null : " supaya jawabannya lebih pas."}
                  </p>
                  {context.productName ? <p className="mt-2 text-xs text-abu-hangat">Kamu sedang melihat {context.productName}.</p> : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(context.productName ? [`Cocok untuk kulitku?`, `Ada di cabang terdekat?`, `Cari yang mirip tapi lebih murah`] : SUGGESTIONS).map((s) => (
                      <button key={s} type="button" disabled={Boolean(resting)} onClick={() => send(s)} className="rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-aksen/40 disabled:opacity-50">
                        {s}
                      </button>
                    ))}
                    {context.productName || !fiturAktif("aiFotoLink") ? null : (
                      <Link href="/cari-dari-video" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-aksen/40" data-testid="chip-video">
                        <Clapperboard className="size-3.5" aria-hidden /> Lihat produk di video? Kirim link-nya
                      </Link>
                    )}
                  </div>
                </div>
              ) : null}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <Bubble key={i} side="kanan" className="max-w-[85%]">
                    <p className="rounded-2xl rounded-br-md bg-kopi px-3.5 py-2 text-sm text-putih">{m.text}</p>
                  </Bubble>
                ) : (
                  <Bubble key={i} className="max-w-[95%] space-y-2" testId="jawaban-advisor">
                    {m.intro ? <p className="px-1 text-xs text-abu-hangat italic">{m.intro}</p> : null}
                    {m.status && !m.text ? (
                      <TypingDots status={m.status} />
                    ) : (
                      <p className={cn("rounded-2xl rounded-bl-md bg-putih px-3.5 py-2 text-sm whitespace-pre-line text-kopi", m.error && "text-bahaya")}>{m.text}</p>
                    )}
                    {m.products?.length ? (
                      <ul className="space-y-2">
                        {m.products.map((p) => (
                          <KartuProdukAi
                            key={p.id}
                            p={p}
                            sumber="advisor"
                            testId="kartu-advisor"
                            alasanTestId="alasan-advisor"
                            labelTambah="Tambah"
                            ringkas
                            catatan={p.stokOnline > 0 ? `Stok online ${p.stokOnline}` : p.cabang.length ? `Ada di ${p.cabang.slice(0, 2).join(", ")}` : "Sedang habis"}
                          />
                        ))}
                      </ul>
                    ) : null}
                    {m.products && m.products.length > 1 && m.total ? (
                      <p className="px-1 text-xs text-abu-hangat" data-testid="total-advisor">
                        Total {m.products.length} produk: <span className="font-semibold text-kopi tabular-nums">{formatRupiah(m.total)}</span>
                      </p>
                    ) : null}
                  </Bubble>
                ),
              )}
            </div>
            <form
              className="border-t border-garis bg-putih p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              {resting ? (
                <p className="text-sm text-abu-hangat" role="status">
                  {resting}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value.slice(0, 600))} placeholder="Tanya soal produk, shade, atau stok" className="h-11 min-w-0 flex-1 rounded-pill border border-garis bg-porselen px-4 text-sm outline-none focus-visible:border-aksen" aria-label={`Pesan untuk ${MEREK.asisten.nama}`} disabled={busy} />
                  <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Kirim">
                    {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
                  </Button>
                </div>
              )}
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );
}
