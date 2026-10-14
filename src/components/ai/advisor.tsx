"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { Clapperboard, Loader2, SendHorizontal, Sparkles, X } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { Bubble, TypingDots } from "@/components/ui/chat-parts";
import { PriceTag } from "@/components/ui/price-tag";
import type { Packaging } from "@/db/schema/enums";
import { addToCart } from "@/lib/cart/client-cart";
import { formatRupiah } from "@/lib/format";
import { tandaiLangkah } from "@/lib/demo/panduan";
import { cn } from "@/lib/utils";
import { useAiStatus } from "./ai-status";
import { useFloatingPosition, useHideOnScroll } from "./floating-position";

export const ADVISOR_OPEN_EVENT = "rona:advisor-open";
export type AdvisorOpenDetail = { productId?: number; productName?: string; prompt?: string };
export function openAdvisor(detail: AdvisorOpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<AdvisorOpenDetail>(ADVISOR_OPEN_EVENT, { detail }));
}

type CardVariant = { id: number; shadeName: string; hex: string; price: number; normalPrice: number; inStock: boolean };
type AdvisorCard = { id: number; name: string; slug: string; brandName: string; brandColor: string; packaging: Packaging; price: number; normalPrice: number; primaryHex: string; variantCount: number; variants: CardVariant[]; stokOnline: number; cabang: string[]; alasan?: string };
type Message = { role: "user" | "assistant"; text: string; intro?: string; products?: AdvisorCard[]; total?: number | null; status?: string; error?: boolean };

const SUGGESTIONS = ["Sunscreen untuk kulit berminyak", "Cari padanan shade cushion-ku", "Kado di bawah 200 ribu", "Ada di Rona Dinoyo?"];
const STORAGE_KEY = "rona.advisor";
const HIDDEN_PREFIXES = ["/checkout", "/bayar", "/admin"];

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

function ProductResult({ p }: { p: AdvisorCard }) {
  const [variantId, setVariantId] = useState(p.variants.find((v) => v.inStock)?.id ?? p.variants[0]?.id);
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const v = p.variants.find((x) => x.id === variantId) ?? p.variants[0];
  return (
    <li className="flex gap-3 rounded-xl border border-garis bg-putih p-2.5" data-testid="kartu-advisor">
      <Link href={`/p/${p.slug}`} className="w-16 shrink-0 overflow-hidden rounded-lg">
        <ProductArt packaging={p.packaging} shade={v?.hex ?? p.primaryHex} brandColor={p.brandColor} brandName={p.brandName} title={p.name} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{p.brandName}</p>
        <Link href={`/p/${p.slug}`} className="line-clamp-2 text-sm font-semibold text-kopi hover:underline">
          {p.name}
        </Link>
        <PriceTag price={v?.price ?? p.price} normalPrice={v?.normalPrice ?? p.normalPrice} size="sm" />
        {p.alasan ? (
          <p className="text-xs text-kopi/80" data-testid="alasan-advisor">
            {p.alasan}
          </p>
        ) : null}
        <p className="text-[11px] text-abu-hangat">{p.stokOnline > 0 ? `Stok online ${p.stokOnline}` : p.cabang.length ? `Ada di ${p.cabang.slice(0, 2).join(", ")}` : "Sedang habis"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {p.variantCount > 1 ? (
            <select value={variantId} onChange={(e) => setVariantId(Number(e.target.value))} className="h-8 max-w-[140px] rounded-lg border border-garis bg-putih px-2 text-xs" aria-label={`Pilih shade ${p.name}`}>
              {p.variants.map((x) => (
                <option key={x.id} value={x.id} disabled={!x.inStock}>
                  {x.shadeName}
                  {x.inStock ? "" : " (habis)"}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            size="sm"
            disabled={!v?.inStock || state === "busy"}
            onClick={async () => {
              if (!v) return;
              setState("busy");
              const r = await addToCart(v.id, 1, { source: "advisor", openDrawer: false });
              setState(r.ok ? "ok" : "fail");
              setMsg(r.ok ? "Masuk keranjang" : (r.message ?? "Gagal"));
            }}
          >
            {state === "busy" ? <Loader2 className="animate-spin" /> : null} {v?.inStock ? "Tambah" : "Habis"}
          </Button>
          {msg ? (
            <span className={cn("text-[11px]", state === "ok" ? "text-sukses" : "text-bahaya")} role="status">
              {msg}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AdvisorLauncher() {
  const pathname = usePathname();
  const status = useAiStatus();
  const available = status.tersedia;
  const resting = status.istirahat ? (status.pesanIstirahat ?? "Sedang istirahat, coba lagi besok.") : null;
  const hasProfile = status.profil;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState<AdvisorOpenDetail>({});
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hidden = HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));
  const pos = useFloatingPosition(buttonRef, available && !hidden, { mobile: 16, desktop: 24 });
  const scrolledAway = useHideOnScroll(available && !hidden && !open);
  const away = Boolean(pos?.covered || scrolledAway);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<AdvisorOpenDetail>).detail ?? {};
      setContext(d);
      setMessages(loadHistory());
      setOpen(true);
      if (d.prompt) setInput(d.prompt);
    };
    window.addEventListener(ADVISOR_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ADVISOR_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  if (!available) return null;

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
        update({ text: d.message ?? "Rona Advisor sedang tidak bisa dihubungi. Coba lagi sebentar lagi, ya.", status: undefined, error: true });
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
    <>
      {!hidden ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            setContext({});
            setMessages(loadHistory());
            setOpen(true);
          }}
          // Posisi dihitung useFloatingPosition: selalu di atas bilah bawah yang menempel, dan disembunyikan sementara
          // bila akan menutupi tombol aksi utama.
          style={{ bottom: pos ? pos.bottom : undefined }}
          // Di HP berupa tombol bulat ikon saja (48 px) supaya tidak menutupi kartu; label teks hanya di desktop.
          // Menyingkir saat digulir ke bawah dan muncul lagi saat digulir ke atas.
          className={cn(
            "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 inline-flex size-12 items-center justify-center gap-2 rounded-full bg-kopi text-sm font-semibold text-putih shadow-lift transition-[transform,bottom,opacity] duration-300 hover:-translate-y-0.5 md:bottom-6 md:h-12 md:w-auto md:rounded-pill md:px-4",
            away && "pointer-events-none translate-y-3 opacity-0",
          )}
          aria-hidden={away || undefined}
          tabIndex={away ? -1 : undefined}
          aria-label="Buka Rona Advisor"
          title="Tanya Rona"
          data-testid="tombol-advisor"
        >
          <Sparkles className="size-5 text-emas md:size-4" aria-hidden /> <span className="hidden md:inline">Tanya Rona</span>
        </button>
      ) : null}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/30 md:bg-kopi/20" />
          <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-porselen outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:shadow-lift" data-testid="panel-advisor">
            <div className="flex items-start justify-between gap-3 border-b border-garis bg-putih px-4 py-3">
              <div>
                <Dialog.Title className="flex items-center gap-1.5 font-serif text-xl text-kopi">
                  <Sparkles className="size-4 text-rona" aria-hidden /> Rona Advisor
                </Dialog.Title>
                <Dialog.Description className="text-[11px] text-abu-hangat">Jawaban AI bisa keliru. Produk dan harga diambil langsung dari katalog Rona.</Dialog.Description>
              </div>
              <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup Rona Advisor">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {!messages.length ? (
                <div className="rounded-xl bg-putih p-4 text-sm text-kopi">
                  <p className="font-semibold">Hai, mau cari apa hari ini?</p>
                  <p className="mt-1 text-abu-hangat">
                    {hasProfile ? "Jawabanku disesuaikan dengan profil kulitmu." : "Aku bantu pilih produk dari katalog Rona. Ikut "}
                    {hasProfile ? null : (
                      <Link href="/kuis-kulit" className="font-semibold text-rona hover:underline">
                        Kuis Kulit
                      </Link>
                    )}
                    {hasProfile ? null : " supaya jawabannya lebih pas."}
                  </p>
                  {context.productName ? <p className="mt-2 text-xs text-abu-hangat">Kamu sedang melihat {context.productName}.</p> : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(context.productName ? [`Cocok untuk kulitku?`, `Ada di Rona Dinoyo?`, `Cari yang mirip tapi lebih murah`] : SUGGESTIONS).map((s) => (
                      <button key={s} type="button" disabled={Boolean(resting)} onClick={() => send(s)} className="rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-rona/40 disabled:opacity-50">
                        {s}
                      </button>
                    ))}
                    {context.productName ? null : (
                      <Link href="/cari-dari-video" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-rona/40" data-testid="chip-video">
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
                          <ProductResult key={p.id} p={p} />
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
                  <input value={input} onChange={(e) => setInput(e.target.value.slice(0, 600))} placeholder="Tanya soal produk, shade, atau stok" className="h-11 min-w-0 flex-1 rounded-pill border border-garis bg-porselen px-4 text-sm outline-none focus-visible:border-rona" aria-label="Pesan untuk Rona Advisor" disabled={busy} />
                  <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Kirim">
                    {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
                  </Button>
                </div>
              )}
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// Tombol "Tanya tentang produk ini" di halaman produk (hanya tampil bila Advisor tersedia).
export function AskAboutProduct({ productId, productName }: { productId: number; productName: string }) {
  const { tersedia } = useAiStatus();
  if (!tersedia) return null;
  return (
    <button type="button" onClick={() => openAdvisor({ productId, productName })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rona hover:underline" data-testid="tanya-produk">
      <Sparkles className="size-4" aria-hidden /> Tanya tentang produk ini
    </button>
  );
}
