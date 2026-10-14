"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { AlertTriangle, Bot, Loader2, Mic, SendHorizontal, Square, X } from "lucide-react";
import { useFloatingPosition } from "@/components/ai/floating-position";
import { Button } from "@/components/ui/button";
import { Bubble, TypingDots } from "@/components/ui/chat-parts";
import type { RoleSlug } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";

type Table = { kolom: string[]; baris: string[][] };
type Msg = {
  role: "user" | "assistant";
  text: string;
  status?: string;
  tabel?: Table | null;
  tautan?: { label: string; href: string }[];
  pilihan?: string[];
  angka?: { nilai: string; sumber: string }[];
  peringatan?: string | null;
  kind?: "jawab" | "langsung" | "tidak_tersedia" | "galat";
};

export const ASSISTANT_EVENT = "rona:asisten-open";
export const openAdminAssistant = (prompt?: string) => window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT, { detail: { prompt } }));

export const ROLE_CHIPS: Record<RoleSlug, string[]> = {
  owner: ["Omzet minggu ini dibanding minggu lalu", "Merek paling laku di Dinoyo bulan ini", "Varian habis yang paling banyak diminta"],
  admin_online: ["Produk terlaris minggu ini", "Pesanan yang perlu tindakan", "Cara membuat voucher"],
  staf_cabang: ["Stok cushion shade 02 di sini", "Pesanan ambil hari ini"],
  gudang: ["Saran transfer hari ini", "Stok yang menipis di Gudang Online"],
};

const KEY = "rona.asisten";
const load = (): Msg[] => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Msg[]) : [];
    return Array.isArray(v) ? v.slice(-30) : [];
  } catch {
    return [];
  }
};
const save = (m: Msg[]) => {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(m.slice(-30)));
  } catch {
    // riwayat hanya di memori
  }
};

function AnswerTable({ t }: { t: Table }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-garis bg-putih">
      <table className="w-full text-left text-xs" data-testid="tabel-asisten">
        <thead className="bg-porselen">
          <tr>
            {t.kolom.map((k) => (
              <th key={k} className="px-2 py-1.5 font-semibold whitespace-nowrap">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.baris.map((r, i) => (
            <tr key={i} className="border-t border-garis">
              {r.map((c, j) => (
                <td key={j} className={cn("px-2 py-1.5 align-top", /^(Rp|\d)/.test(c) && "text-right tabular-nums whitespace-nowrap")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Rekam suara maksimal 60 detik, lalu teks hasil transkripsi diserahkan ke kotak ketik (tidak terkirim otomatis).
function useRecorder(onText: (t: string) => void, onError: (m: string) => void) {
  const [state, setState] = useState<"idle" | "rekam" | "proses">("idle");
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  };
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return onError("Browser ini belum mendukung rekaman suara.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      rec.current = r;
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("proses");
        try {
          const form = new FormData();
          form.append("audio", new Blob(chunks, { type: r.mimeType || "audio/webm" }), "suara");
          const res = await fetch("/api/admin/asisten/transkripsi", { method: "POST", body: form });
          const d = (await res.json().catch(() => ({}))) as { ok?: boolean; teks?: string; message?: string };
          if (d.ok && d.teks) onText(d.teks);
          else onError(d.message ?? "Rekaman belum bisa diproses.");
        } catch {
          onError("Koneksi terputus. Ketik pertanyaanmu, ya.");
        } finally {
          setState("idle");
        }
      };
      r.start();
      setSeconds(0);
      setState("rekam");
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= 60) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      onError("Izin mikrofon ditolak. Ketik pertanyaanmu, ya.");
    }
  };
  useEffect(() => () => stop(), []);
  return { state, seconds, start, stop };
}

export function AssistantButton({ variant = "sidebar" }: { variant?: "sidebar" | "header" }) {
  if (variant === "header")
    return (
      <button type="button" onClick={() => openAdminAssistant()} className="grid size-10 place-items-center rounded-full hover:bg-blush/50" aria-label="Buka Asisten Admin" data-testid="asisten-header">
        <Bot className="size-5" />
      </button>
    );
  return (
    <button type="button" onClick={() => openAdminAssistant()} className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-rona/30 bg-blush/40 px-3 py-2 text-left text-sm font-semibold text-kopi hover:border-rona/60" data-testid="asisten-sidebar">
      <Bot className="size-4 text-rona" aria-hidden /> Asisten Admin
    </button>
  );
}

export function AdminAssistant({ role }: { role: RoleSlug }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const pos = useFloatingPosition(fabRef, true, { mobile: 16, desktop: 24 });
  const recorder = useRecorder(
    (t) => {
      setMicError(null);
      setInput((x) => (x ? `${x} ${t}` : t));
      inputRef.current?.focus();
    },
    (m) => setMicError(m),
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      setMessages(load());
      setOpen(true);
      const p = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (p) setInput(p);
    };
    window.addEventListener(ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_EVENT, onOpen);
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim().slice(0, 500);
    if (!q || busy) return;
    const history = [...messages, { role: "user" as const, text: q }];
    setMessages([...history, { role: "assistant", text: "", status: "Membaca pertanyaanmu" }]);
    setInput("");
    setBusy(true);
    const update = (patch: Partial<Msg>) =>
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });
    try {
      const res = await fetch("/api/admin/asisten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pesan: history.filter((h) => h.text).map((h) => ({ role: h.role, text: h.text })) }) });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { message?: string; alasan?: string };
        update({ text: d.message ?? "Asisten sedang tidak tersedia, coba lagi sebentar.", status: undefined, kind: d.alasan === "tidak_tersedia" ? "tidak_tersedia" : "galat" });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as { type: string; text?: string; teks?: string; status?: Msg["kind"]; tabel?: Table | null; tautan?: Msg["tautan"]; pilihan?: string[]; angka?: Msg["angka"]; peringatan?: string | null };
          if (e.type === "status") update({ status: e.text });
          if (e.type === "done") update({ text: e.teks ?? "", status: undefined, tabel: e.tabel, tautan: e.tautan, pilihan: e.pilihan, angka: e.angka, peringatan: e.peringatan, kind: e.status });
        }
      }
    } catch {
      update({ text: "Asisten sedang tidak tersedia, coba lagi sebentar.", status: undefined, kind: "tidak_tersedia" });
    } finally {
      setBusy(false);
      setMessages((m) => {
        save(m);
        return m;
      });
    }
  };

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => openAdminAssistant()}
        style={{ bottom: pos ? pos.bottom : undefined }}
        className={cn("fixed right-4 bottom-24 z-40 grid size-12 place-items-center rounded-full bg-kopi text-putih shadow-lift transition-[bottom,opacity] duration-200 lg:hidden", pos?.covered && "pointer-events-none opacity-0")}
        aria-label="Buka Asisten Admin"
        data-testid="asisten-fab"
      >
        <Bot className="size-5" aria-hidden />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/30" />
          <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-porselen outline-none lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[480px] lg:shadow-lift" data-testid="panel-asisten">
            <div className="flex items-start justify-between gap-3 border-b border-garis bg-putih px-4 py-3">
              <div>
                <Dialog.Title className="flex items-center gap-1.5 font-serif text-xl text-kopi">
                  <Bot className="size-5 text-rona" aria-hidden /> Asisten Admin
                </Dialog.Title>
                <Dialog.Description className="text-[11px] text-abu-hangat">Hanya membaca data sesuai izinmu. Angka diambil dari fungsi laporan dan stok yang sama dengan halaman admin.</Dialog.Description>
              </div>
              <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup Asisten Admin">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {!messages.length ? (
                <div className="rounded-xl bg-putih p-4 text-sm text-kopi">
                  <p className="font-semibold">Mau cek apa hari ini?</p>
                  <p className="mt-1 text-abu-hangat">Tanya omzet, stok, pesanan, atau cara pakai panel. Aku menyebut periode dan sumber angkanya.</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ROLE_CHIPS[role].map((c) => (
                      <button key={c} type="button" onClick={() => send(c)} className="rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-rona/40" data-testid="chip-asisten">
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <Bubble key={i} side="kanan" className="max-w-[85%]">
                    <p className="rounded-2xl rounded-br-md bg-kopi px-3.5 py-2 text-sm text-putih">{m.text}</p>
                  </Bubble>
                ) : (
                  <Bubble key={i} className="max-w-[98%] space-y-2" testId="jawaban-asisten">
                    {m.status && !m.text ? (
                      <TypingDots status={m.status} />
                    ) : m.kind === "tidak_tersedia" || m.kind === "galat" ? (
                      <p className="rounded-2xl border border-dashed border-garis bg-putih px-3.5 py-2 text-sm text-abu-hangat" role="status" data-testid="asisten-tidak-tersedia">
                        {m.text}
                      </p>
                    ) : (
                      <p className="rounded-2xl rounded-bl-md bg-putih px-3.5 py-2 text-sm whitespace-pre-line text-kopi">{m.text}</p>
                    )}
                    {m.peringatan ? (
                      <p className="flex items-start gap-1.5 rounded-lg bg-[#FBEEDC] px-3 py-2 text-xs text-[#8A5512]" data-testid="peringatan-angka">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {m.peringatan}
                      </p>
                    ) : null}
                    {m.pilihan?.length && i === messages.length - 1 ? (
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilihan cepat">
                        {m.pilihan.map((p) => (
                          <button key={p} type="button" onClick={() => send(p)} disabled={busy} className="rounded-pill border border-garis bg-porselen px-3 py-1.5 text-xs font-medium hover:border-rona/40 disabled:opacity-50" data-testid="pilihan-asisten">
                            {p}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {m.tabel ? <AnswerTable t={m.tabel} /> : null}
                    {m.tautan?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {m.tautan.map((t) => (
                          <Link key={t.href} href={t.href} onClick={() => setOpen(false)} className="rounded-pill border border-rona/30 bg-putih px-3 py-1 text-xs font-semibold text-rona hover:border-rona" data-testid="tautan-asisten">
                            {t.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {m.angka?.length ? (
                      <details className="text-[11px] text-abu-hangat">
                        <summary className="cursor-pointer">Sumber angka</summary>
                        <ul className="mt-1 space-y-0.5">
                          {m.angka.map((a, j) => (
                            <li key={j}>
                              {a.nilai}: <span className="font-mono">{a.sumber}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
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
              {micError ? <p className="mb-2 text-xs text-bahaya">{micError}</p> : null}
              {recorder.state === "rekam" ? <p className="mb-2 text-xs text-rona" role="status">Merekam {recorder.seconds} dari 60 detik. Tekan berhenti bila selesai.</p> : null}
              {recorder.state === "proses" ? <p className="mb-2 text-xs text-abu-hangat" role="status">Mengubah suara jadi teks...</p> : null}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Tanya data toko atau cara pakai"
                  className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-garis bg-porselen px-4 py-2.5 text-sm outline-none focus-visible:border-rona"
                  aria-label="Pertanyaan untuk Asisten Admin"
                  disabled={busy}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => (recorder.state === "rekam" ? recorder.stop() : void recorder.start())} disabled={busy || recorder.state === "proses"} aria-label={recorder.state === "rekam" ? "Berhenti merekam" : "Rekam pertanyaan dengan suara"}>
                  {recorder.state === "rekam" ? <Square /> : recorder.state === "proses" ? <Loader2 className="animate-spin" /> : <Mic />}
                </Button>
                <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Kirim pertanyaan">
                  {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// Tombol kecil yang membuka Asisten Admin dengan pertanyaan terisi (misal "Jelaskan saran transfer hari ini").
export function AskAssistantButton({ prompt, label }: { prompt: string; label: string }) {
  return (
    <button type="button" onClick={() => openAdminAssistant(prompt)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rona hover:underline">
      <Bot className="size-3.5" aria-hidden /> {label}
    </button>
  );
}
