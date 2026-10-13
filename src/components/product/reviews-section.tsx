"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Camera, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { RatingStars } from "@/components/ui/rating-stars";
import { ShadeSwatchArt } from "@/components/product-art";
import { skinTypeLabels } from "@/lib/catalog/filters";
import { formatDateWib } from "@/lib/format";
import type { ProductReview } from "@/lib/product/queries";
import { cn } from "@/lib/utils";

const HELPFUL_KEY = "rona.review-helpful";
const PAGE = 5;

function readHelpful(): number[] {
  try {
    const raw = window.localStorage.getItem(HELPFUL_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function ReviewsSection({ reviews, ratingAvg }: { reviews: ProductReview[]; ratingAvg: number }) {
  const [star, setStar] = useState<number | null>(null);
  const [skin, setSkin] = useState<string | null>(null);
  const [shade, setShade] = useState<string | null>(null);
  const [photoOnly, setPhotoOnly] = useState(false);
  const [sort, setSort] = useState<"terbaru" | "membantu">("terbaru");
  const [page, setPage] = useState(1);
  const [voted, setVoted] = useState<number[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setVoted(readHelpful()), 0);
    return () => window.clearTimeout(t);
  }, []);

  const total = reviews.length;
  const distribution = [5, 4, 3, 2, 1].map((s) => ({ star: s, count: reviews.filter((r) => r.rating === s).length }));
  const skins = [...new Set(reviews.map((r) => r.skinType).filter((s): s is string => Boolean(s)))];
  const shades = [...new Set(reviews.map((r) => r.shadeName).filter((s): s is string => Boolean(s)))];

  const filtered = useMemo(() => {
    const list = reviews.filter((r) => (star == null || r.rating === star) && (!skin || r.skinType === skin) && (!shade || r.shadeName === shade) && (!photoOnly || r.hasPhoto));
    const helpful = (r: ProductReview) => r.helpfulCount + (voted.includes(r.id) ? 1 : 0);
    return sort === "membantu" ? [...list].sort((a, b) => helpful(b) - helpful(a) || b.createdAt.localeCompare(a.createdAt)) : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [reviews, star, skin, shade, photoOnly, sort, voted]);
  const shown = filtered.slice(0, page * PAGE);

  const vote = (id: number) => {
    if (voted.includes(id)) return;
    const next = [...voted, id];
    setVoted(next);
    try {
      window.localStorage.setItem(HELPFUL_KEY, JSON.stringify(next));
    } catch {
      // abaikan
    }
  };

  if (total === 0) {
    return (
      <section aria-labelledby="ulasan-heading" className="rounded-card border border-dashed border-garis bg-putih p-6 text-center">
        <h2 id="ulasan-heading" className="font-serif text-2xl text-kopi">
          Ulasan
        </h2>
        <p className="mt-2 text-sm text-abu-hangat">Belum ada ulasan. Setelah pesananmu selesai, kamu bisa jadi yang pertama dan dapat bonus 50 poin.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="ulasan-heading">
      <h2 id="ulasan-heading" className="font-serif text-2xl text-kopi md:text-3xl">
        Ulasan pembeli
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="rounded-card border border-garis bg-putih p-5">
          <p className="font-serif text-5xl text-kopi tabular-nums">{ratingAvg.toFixed(1).replace(".", ",")}</p>
          <RatingStars value={ratingAvg} count={total} size="md" showValue={false} className="mt-1" />
          <p className="mt-1 text-xs text-abu-hangat">{total} ulasan</p>
          <ul className="mt-4 space-y-1.5">
            {distribution.map((d) => (
              <li key={d.star} className="flex items-center gap-2 text-xs text-abu-hangat tabular-nums">
                <button type="button" onClick={() => setStar(star === d.star ? null : d.star)} className={cn("w-7 text-left hover:text-kopi", star === d.star && "font-semibold text-kopi")} aria-pressed={star === d.star}>
                  {d.star}★
                </button>
                <span className="h-2 flex-1 overflow-hidden rounded-pill bg-porselen">
                  <span className="block h-full rounded-pill bg-emas" style={{ width: `${total ? (d.count / total) * 100 : 0}%` }} />
                </span>
                <span className="w-5 text-right">{d.count}</span>
              </li>
            ))}
          </ul>
          {/* Ruang ringkasan AI, tampil di Fase 7 */}
          <div hidden data-ai-review-summary className="mt-4 rounded-xl bg-porselen p-3 text-xs text-abu-hangat" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {skins.map((s) => (
              <Chip key={s} selected={skin === s} onClick={() => setSkin(skin === s ? null : s)}>
                Kulit {skinTypeLabels[s] ?? s}
              </Chip>
            ))}
            {shades.length > 1
              ? shades.slice(0, 6).map((s) => (
                  <Chip key={s} selected={shade === s} onClick={() => setShade(shade === s ? null : s)}>
                    {s}
                  </Chip>
                ))
              : null}
            <Chip selected={photoOnly} onClick={() => setPhotoOnly(!photoOnly)}>
              <Camera className="size-3.5" /> Dengan foto
            </Chip>
            <label className="ml-auto flex items-center gap-2 text-xs text-abu-hangat">
              Urutkan
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-pill border border-garis bg-putih px-3 text-sm text-kopi outline-none focus-visible:border-rona">
                <option value="terbaru">Terbaru</option>
                <option value="membantu">Paling membantu</option>
              </select>
            </label>
          </div>

          <ul className="mt-4 space-y-3" aria-live="polite">
            {shown.map((r) => {
              const helpful = r.helpfulCount + (voted.includes(r.id) ? 1 : 0);
              return (
                <li key={r.id} className="rounded-card border border-garis bg-putih p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <RatingStars value={r.rating} count={1} size="sm" showValue={false} showCount={false} />
                    <span className="text-sm font-semibold text-kopi">{r.authorName}</span>
                    {r.isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-[#DFF0E6] px-2 py-0.5 text-[11px] font-semibold text-sukses">
                        <BadgeCheck className="size-3" aria-hidden /> Pembeli terverifikasi
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-abu-hangat">{formatDateWib(new Date(r.createdAt))}</span>
                  </div>
                  <p className="mt-1 text-xs text-abu-hangat">
                    {r.skinType ? `Kulit ${skinTypeLabels[r.skinType] ?? r.skinType}` : ""}
                    {r.skinType && r.shadeName ? " · " : ""}
                    {r.shadeName ? `Shade ${r.shadeName}` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-kopi/90">{r.body}</p>
                  {r.photos.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.photos.map((src, i) => (
                        <a key={src} href={src} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-xl border border-garis">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Foto ulasan ${r.authorName} ${i + 1}`} loading="lazy" className="size-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : r.hasPhoto ? (
                    <div className="mt-3 w-28 overflow-hidden rounded-xl border border-garis">
                      <ShadeSwatchArt shade={r.hex ?? "#D9A98B"} texture="krim" title={`Foto ulasan ${r.authorName} (pengganti)`} />
                    </div>
                  ) : null}
                  {r.storeReply ? (
                    <div className="mt-3 rounded-xl bg-porselen p-3 text-sm">
                      <p className="text-xs font-semibold text-rona">Balasan Rona Beauty</p>
                      <p className="mt-0.5 text-kopi/85">{r.storeReply}</p>
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <button type="button" onClick={() => vote(r.id)} disabled={voted.includes(r.id)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors", voted.includes(r.id) ? "border-rona bg-blush text-rona-gelap" : "border-garis text-kopi hover:border-kopi/30")} aria-pressed={voted.includes(r.id)}>
                      <ThumbsUp className="size-3.5" /> Membantu{helpful > 0 ? ` (${helpful})` : ""}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 ? <p className="mt-4 text-sm text-abu-hangat">Tidak ada ulasan yang cocok dengan filter ini.</p> : null}
          {shown.length < filtered.length ? (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                Tampilkan {Math.min(PAGE, filtered.length - shown.length)} ulasan lagi
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
