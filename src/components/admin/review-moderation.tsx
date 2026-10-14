"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { EyeOff, Loader2, MessageSquareReply, Sparkles, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { bulkReplyDraftAction, draftReplyAction } from "@/lib/admin/ai-actions";
import { deleteReplyAction, hideReviewsAction, replyReviewAction, showReviewAction } from "@/lib/admin/moderation-actions";
import { cn } from "@/lib/utils";

export type ModerationRow = {
  id: number;
  productName: string;
  productSlug: string;
  shadeName: string | null;
  hex: string | null;
  authorName: string;
  rating: number;
  body: string;
  photos: string[];
  skinType: string | null;
  status: string;
  storeReply: string | null;
  repliedLabel: string | null;
  hiddenReason: string | null;
  createdLabel: string;
  verified: boolean;
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${n} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= n ? "fill-emas text-emas" : "text-garis")} aria-hidden />
      ))}
    </span>
  );
}

export function ReviewModeration({ rows, aiDrafts = false }: { rows: ModerationRow[]; aiDrafts?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [hiding, setHiding] = useState<number[] | null>(null);
  const [replying, setReplying] = useState<ModerationRow | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  // Draf AI: penanda "dibantu AI" hanya untuk log aktivitas. Antrean draf massal ditinjau satu per satu.
  const [aiAssisted, setAiAssisted] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [queue, setQueue] = useState<{ id: number; text: string }[]>([]);
  const unreplied = rows.filter((r) => r.status === "tampil" && !r.storeReply);
  const openReply = (r: ModerationRow, text?: string) => {
    setReplying(r);
    setReplyText(text ?? r.storeReply ?? "");
    setAiAssisted(Boolean(text));
    setReplyError(null);
  };
  const nextInQueue = (rest: { id: number; text: string }[]) => {
    setQueue(rest);
    const n = rest[0] ? rows.find((r) => r.id === rest[0].id) : null;
    if (n) openReply(n, rest[0].text);
    else setReplying(null);
  };
  const [removingReply, setRemovingReply] = useState<ModerationRow | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  const visible = rows.filter((r) => r.status === "tampil");
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-3">
      {notice ? (
        <p className={cn("rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-rona" checked={visible.length > 0 && visible.every((r) => selected.includes(r.id))} onChange={(e) => setSelected(e.target.checked ? visible.map((r) => r.id) : [])} aria-label="Pilih semua ulasan tayang di halaman ini" />
          Pilih semua yang tayang
        </label>
        {aiDrafts && unreplied.length ? (
          <Button
            size="sm"
            variant="outline"
            disabled={drafting}
            data-testid="draf-massal"
            onClick={async () => {
              setDrafting(true);
              const r = await bulkReplyDraftAction(unreplied.map((x) => x.id));
              setDrafting(false);
              if (!r.ok) return setNotice({ ok: false, text: r.message });
              const ready = r.drafts.filter((d): d is { id: number; text: string } => Boolean(d.text));
              if (!ready.length) return setNotice({ ok: false, text: "Belum ada draf yang bisa dibuat." });
              setNotice({ ok: true, text: `${ready.length} draf siap ditinjau satu per satu.` });
              nextInQueue(ready);
            }}
          >
            {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />} Buat draf untuk semua yang belum dibalas ({Math.min(unreplied.length, 8)})
          </Button>
        ) : null}
        {selected.length ? (
          <Button size="sm" variant="dark" onClick={() => setHiding(selected)} data-testid="sembunyikan-massal">
            <EyeOff /> Sembunyikan {selected.length} ulasan
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2" data-testid="daftar-ulasan">
        {rows.map((r) => (
          <li key={r.id} className={cn("rounded-xl border bg-putih p-3 sm:p-4", r.status === "tampil" ? "border-garis" : "border-dashed border-garis bg-porselen/50")} data-ulasan={r.id}>
            <div className="flex items-start gap-3">
              {r.status === "tampil" ? <input type="checkbox" className="mt-1 size-4 shrink-0 accent-rona" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Pilih ulasan ${r.authorName}`} /> : <span className="w-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars n={r.rating} />
                  <span className="text-sm font-semibold">{r.authorName}</span>
                  {r.verified ? <span className="text-[11px] text-sukses">Pembeli terverifikasi</span> : null}
                  {r.status !== "tampil" ? <Badge variant="netral">Tersembunyi</Badge> : null}
                  <span className="text-xs text-abu-hangat">{r.createdLabel}</span>
                </div>
                <a href={`/p/${r.productSlug}`} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1.5 text-xs text-abu-hangat hover:underline">
                  {r.hex ? <span className="size-3 rounded-full border border-garis" style={{ background: r.hex }} aria-hidden /> : null}
                  {r.productName}
                  {r.shadeName ? `, ${r.shadeName}` : ""}
                  {r.skinType ? ` · kulit ${r.skinType}` : ""}
                </a>
                <p className="mt-2 text-sm text-kopi">{r.body}</p>
                {r.photos.length ? (
                  <div className="mt-2 flex gap-2">
                    {r.photos.map((p, i) => (
                      <button key={p} type="button" onClick={() => setPhoto(p)} className="overflow-hidden rounded-lg border border-garis" aria-label={`Buka foto ${i + 1} dari ${r.authorName}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt="" className="size-16 object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {r.hiddenReason ? <p className="mt-2 text-xs text-abu-hangat">Disembunyikan: {r.hiddenReason}</p> : null}
                {r.storeReply ? (
                  <div className="mt-2 rounded-lg bg-blush/40 p-2.5 text-sm" data-testid="balasan-toko">
                    <p className="text-xs font-semibold text-rona">Balasan Rona Beauty{r.repliedLabel ? ` · ${r.repliedLabel}` : ""}</p>
                    <p className="mt-0.5 text-kopi/85">{r.storeReply}</p>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openReply(r)}>
                    <MessageSquareReply /> {r.storeReply ? "Ubah balasan" : "Balas"}
                  </Button>
                  {r.storeReply ? (
                    <Button size="sm" variant="ghost" onClick={() => setRemovingReply(r)}>
                      Hapus balasan
                    </Button>
                  ) : null}
                  {r.status === "tampil" ? (
                    <Button size="sm" variant="ghost" onClick={() => setHiding([r.id])}>
                      <EyeOff /> Sembunyikan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await showReviewAction(r.id);
                          setNotice(res.ok ? { ok: true, text: "Ulasan tampil lagi. Rating produk dihitung ulang." } : { ok: false, text: res.message });
                          router.refresh();
                        })
                      }
                    >
                      Tampilkan lagi
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
        {!rows.length ? <li className="rounded-xl border border-dashed border-garis p-8 text-center text-sm text-abu-hangat">Tidak ada ulasan yang cocok dengan filter ini.</li> : null}
      </ul>

      <ConfirmDialog
        open={hiding != null}
        onOpenChange={(o) => !o && setHiding(null)}
        title={hiding && hiding.length > 1 ? `Sembunyikan ${hiding.length} ulasan?` : "Sembunyikan ulasan ini?"}
        description="Ulasan tidak tampil lagi di halaman produk, dan rating rata-rata dihitung ulang. Alasanmu tercatat di log aktivitas."
        confirmLabel="Sembunyikan"
        danger
        input={{ label: "Alasan", placeholder: "Misal: berisi nomor telepon pribadi", minLength: 5, hint: "Minimal 5 karakter." }}
        onConfirm={async (reason) => {
          if (!hiding) return null;
          const res = await hideReviewsAction(hiding, reason);
          if (!res.ok) return res.message;
          setSelected((s) => s.filter((x) => !hiding.includes(x)));
          setNotice({ ok: true, text: `${res.changed} ulasan disembunyikan. Rating produk dihitung ulang.` });
          router.refresh();
          return null;
        }}
      />

      <ConfirmDialog
        open={removingReply != null}
        onOpenChange={(o) => !o && setRemovingReply(null)}
        title="Hapus balasan toko?"
        description="Balasan hilang dari halaman produk. Pembeli tidak diberi tahu."
        confirmLabel="Hapus balasan"
        danger
        onConfirm={async () => {
          if (!removingReply) return null;
          const res = await deleteReplyAction(removingReply.id);
          if (!res.ok) return res.message;
          setNotice({ ok: true, text: "Balasan dihapus." });
          router.refresh();
          return null;
        }}
      />

      <Dialog.Root open={replying != null} onOpenChange={(o) => !o && setReplying(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
          <Dialog.Content className="fixed inset-x-3 top-[10dvh] z-50 mx-auto max-w-lg rounded-card bg-putih p-5 shadow-lift outline-none" data-testid="dialog-balas">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="font-serif text-xl">
                {replying?.storeReply ? "Ubah balasan" : "Balas sebagai toko"}
                {queue.length ? <span className="ml-2 align-middle text-xs font-sans font-normal text-abu-hangat">Draf {queue.length} tersisa</span> : null}
              </Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-1 text-sm text-abu-hangat">Balasan tampil di bawah ulasan dengan label &quot;Balasan Rona Beauty&quot;. Balasan pertama memberi tahu pembeli lewat notifikasi.</Dialog.Description>
            {replying ? (
              <blockquote className="mt-3 rounded-lg bg-porselen p-3 text-sm">
                <Stars n={replying.rating} /> <span className="font-semibold">{replying.authorName}</span>
                <p className="mt-1 line-clamp-4 text-kopi/85">{replying.body}</p>
              </blockquote>
            ) : null}
            {aiDrafts ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={drafting || !replying}
                  data-testid="draf-ai"
                  onClick={async () => {
                    if (!replying) return;
                    setDrafting(true);
                    const r = await draftReplyAction(replying.id);
                    setDrafting(false);
                    if (!r.ok) return setReplyError(r.message);
                    setReplyText(r.text);
                    setAiAssisted(true);
                    setReplyError(null);
                  }}
                >
                  {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />} Buat draf dengan AI
                </Button>
                {aiAssisted ? <span className="text-[11px] text-abu-hangat">Draf AI, periksa dan ubah sebelum menyimpan.</span> : null}
              </div>
            ) : null}
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Balasan</span>
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, 1000))} rows={5} className="w-full rounded-lg border border-garis px-3 py-2 text-sm outline-none focus-visible:border-rona focus-visible:shadow-ring" aria-label="Isi balasan" placeholder="Terima kasih sudah berbagi, Kak..." />
              <span className="mt-1 block text-right text-xs text-abu-hangat tabular-nums">{replyText.length}/1000</span>
            </label>
            {replyError ? (
              <p className="text-sm text-bahaya" role="alert">
                {replyError}
              </p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              {queue.length ? (
                <Button variant="ghost" onClick={() => nextInQueue(queue.slice(1))}>
                  Lewati
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setReplying(null)}>
                  Batal
                </Button>
              )}
              <Button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    if (!replying) return;
                    const res = await replyReviewAction(replying.id, replyText, { aiAssisted });
                    if (!res.ok) return setReplyError(res.message);
                    if (queue.length) nextInQueue(queue.slice(1));
                    else setReplying(null);
                    setNotice({ ok: true, text: res.notified ? "Balasan tersimpan dan pembeli diberi tahu." : "Balasan tersimpan." });
                    router.refresh();
                  })
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : null} Simpan balasan
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={photo != null} onOpenChange={(o) => !o && setPhoto(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/80" />
          <Dialog.Content className="fixed inset-3 z-50 flex items-center justify-center outline-none" aria-describedby={undefined}>
            <Dialog.Title className="sr-only">Foto ulasan</Dialog.Title>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Foto ulasan" className="max-h-full max-w-full rounded-lg object-contain" />
            ) : null}
            <Dialog.Close className="absolute top-2 right-2 grid size-10 place-items-center rounded-full bg-putih/90" aria-label="Tutup foto">
              <X className="size-5" />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
